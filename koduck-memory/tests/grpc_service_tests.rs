use std::time::Duration;

use koduck_memory::capability::MemoryGrpcService;
use koduck_memory::observe::RpcMetrics;
use koduck_memory::api::{
    AppendMemoryRequest, GetSessionRequest, GetSessionTranscriptRequest, MemoryEntry,
    MemoryServiceClient, MemoryServiceServer, QueryMemoryRequest, RequestMeta,
    RetrievePolicy, SummarizeMemoryRequest, UpsertSessionMetaRequest,
};
use koduck_memory::config::{
    AppConfig, AppSection, CapabilitiesSection, IndexSection, ObjectStoreSection,
    PostgresSection, RetrySection, ServerSection, SummarySection,
};
use koduck_memory::facts::MemoryFactRepository;
use koduck_memory::index::{InsertMemoryIndexRecord, MemoryIndexRepository};
use koduck_memory::memory_anchor::{MemoryUnitAnchorRepository, MemoryUnitAnchorType};
use koduck_memory::memory_unit::{InsertMemoryUnit, MemoryUnitKind, MemoryUnitRepository, MemoryUnitSummaryState};
use koduck_memory::reliability::TaskAttemptRepository;
use koduck_memory::retrieve::match_reason;
use koduck_memory::summary::MemorySummaryRepository;
use koduck_memory::session::{SessionRepository, UpsertSession, extra_to_jsonb};
use koduck_memory::store::RuntimeState;
use tokio::net::TcpListener;
use tokio_stream::wrappers::TcpListenerStream;
use tonic::transport::{Channel, Server};
use uuid::Uuid;

fn test_config() -> AppConfig {
    AppConfig {
        app: AppSection {
            name: "koduck-memory".to_string(),
            version: "0.1.0".to_string(),
            env: "test".to_string(),
        },
        server: ServerSection {
            grpc_addr: "127.0.0.1:50051".to_string(),
            metrics_addr: "127.0.0.1:9090".to_string(),
        },
        postgres: PostgresSection {
            dsn: "postgresql://ignored:ignored@localhost:5432/postgres".to_string(),
        },
        object_store: ObjectStoreSection {
            endpoint: "http://127.0.0.1:9000".to_string(),
            bucket: "koduck-memory-test".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            region: "ap-east-1".to_string(),
        },
        capabilities: CapabilitiesSection { ttl_secs: 60 },
        summary: SummarySection {
            async_enabled: false,
            llm_enabled: false,
            llm_provider: "minimax".to_string(),
            llm_api_key: String::new(),
            llm_base_url: "https://api.minimax.chat/v1".to_string(),
            llm_model: "MiniMax-M2.7".to_string(),
            llm_timeout_ms: 15_000,
        },
        retry: RetrySection {
            max_attempts: 3,
            initial_delay_ms: 500,
        },
        index: IndexSection {
            mode: "domain-first".to_string(),
        },
    }
}

fn assert_match_reasons_are_closed_set(reasons: &[String]) {
    assert!(
        reasons
            .iter()
            .all(|reason| match_reason::is_closed_set_value(reason)),
        "match_reasons must stay within closed set, got: {reasons:?}"
    );
}

#[tokio::test]
async fn server_can_register_and_start() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let incoming = TcpListenerStream::new(listener);

    let runtime = RuntimeState::initialize(&test_config()).await.unwrap();
    let service = MemoryGrpcService::new(test_config(), runtime, None, Arc::new(RpcMetrics::new()));
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        Server::builder()
            .add_service(MemoryServiceServer::new(service))
            .serve_with_incoming_shutdown(incoming, async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap();
    });

    let endpoint = format!("http://{addr}");
    let channel = Channel::from_shared(endpoint)
        .unwrap()
        .connect_timeout(Duration::from_secs(2))
        .connect()
        .await
        .unwrap();
    let mut client = MemoryServiceClient::new(channel);

    let response = client
        .get_capabilities(RequestMeta {
            request_id: "req-1".to_string(),
            session_id: "session-1".to_string(),
            user_id: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            trace_id: "trace-1".to_string(),
            idempotency_key: String::new(),
            deadline_ms: 1000,
            api_version: "memory.v1".to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert_eq!(response.service, "memory");
    assert_eq!(response.contract_versions, vec!["memory.v1".to_string()]);
    assert_eq!(response.features.get("session_meta"), Some(&"true".to_string()));
    assert_eq!(response.features.get("query_memory"), Some(&"true".to_string()));
    assert_eq!(response.features.get("append_memory"), Some(&"true".to_string()));
    assert_eq!(response.features.get("summary"), Some(&"true".to_string()));
    assert_eq!(
        response.features.get("domain_first_search"),
        Some(&"true".to_string())
    );
    assert_eq!(
        response.features.get("summary_search"),
        Some(&"true".to_string())
    );
    assert_eq!(
        response.features.get("retrieve_policy.default"),
        Some(&"domain-first".to_string())
    );
    assert_eq!(response.limits.get("max_top_k"), Some(&"20".to_string()));
    assert_eq!(response.limits.get("max_page_size"), Some(&"100".to_string()));
    assert_eq!(
        response.limits.get("recommended_timeout_ms"),
        Some(&"5000".to_string())
    );

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn get_session_returns_session_for_existing() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let incoming = TcpListenerStream::new(listener);

    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();

    // Seed a session via repository
    let session_id = Uuid::new_v4();
    let parent_id = Uuid::new_v4();
    let repo = SessionRepository::new(runtime.pool());
    let now = chrono::Utc::now();
    let mut extra_map = std::collections::HashMap::new();
    extra_map.insert("theme".to_string(), "dark".to_string());

    repo.upsert(&UpsertSession {
        session_id,
        tenant_id: "tenant-t32".to_string(),
        user_id: "user-t32".to_string(),
        parent_session_id: Some(parent_id),
        forked_from_session_id: None,
        title: "GetSession Test".to_string(),
        status: "active".to_string(),
        last_message_at: now,
        extra: extra_to_jsonb(&extra_map),
    })
    .await
    .unwrap();

    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        Server::builder()
            .add_service(MemoryServiceServer::new(service))
            .serve_with_incoming_shutdown(incoming, async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap();
    });

    let endpoint = format!("http://{addr}");
    let channel = Channel::from_shared(endpoint)
        .unwrap()
        .connect_timeout(Duration::from_secs(2))
        .connect()
        .await
        .unwrap();
    let mut client = MemoryServiceClient::new(channel);

    let response = client
        .get_session(GetSessionRequest {
            meta: Some(RequestMeta {
                request_id: "req-t32-1".to_string(),
                session_id: session_id.to_string(),
                user_id: "user-t32".to_string(),
                tenant_id: "tenant-t32".to_string(),
                trace_id: "trace-t32-1".to_string(),
                idempotency_key: String::new(),
                deadline_ms: 5000,
                api_version: "memory.v1".to_string(),
            }),
            session_id: session_id.to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    let session = response.session.unwrap();
    assert_eq!(session.session_id, session_id.to_string());
    assert_eq!(session.tenant_id, "tenant-t32");
    assert_eq!(session.user_id, "user-t32");
    assert_eq!(session.parent_session_id, parent_id.to_string());
    assert_eq!(session.forked_from_session_id, "");
    assert_eq!(session.title, "GetSession Test");
    assert_eq!(session.status, "active");
    assert_eq!(session.extra.get("theme"), Some(&"dark".to_string()));
    assert!(response.error.is_none());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn get_session_returns_not_found_for_missing() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let incoming = TcpListenerStream::new(listener);

    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        Server::builder()
            .add_service(MemoryServiceServer::new(service))
            .serve_with_incoming_shutdown(incoming, async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap();
    });

    let endpoint = format!("http://{addr}");
    let channel = Channel::from_shared(endpoint)
        .unwrap()
        .connect_timeout(Duration::from_secs(2))
        .connect()
        .await
        .unwrap();
    let mut client = MemoryServiceClient::new(channel);

    let missing_id = Uuid::new_v4();
    let response = client
        .get_session(GetSessionRequest {
            meta: Some(RequestMeta {
                request_id: "req-t32-2".to_string(),
                session_id: missing_id.to_string(),
                user_id: "user-t32".to_string(),
                tenant_id: "tenant-t32".to_string(),
                trace_id: "trace-t32-2".to_string(),
                idempotency_key: String::new(),
                deadline_ms: 5000,
                api_version: "memory.v1".to_string(),
            }),
            session_id: missing_id.to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(!response.ok);
    assert!(response.session.is_none());
    let error = response.error.unwrap();
    assert_eq!(error.code, "RESOURCE_NOT_FOUND");
    assert_eq!(error.message, "session not found");
    assert!(!error.retryable);
    assert_eq!(error.upstream, "koduck-memory");

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn get_session_transcript_returns_empty_for_session_without_entries() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let incoming = TcpListenerStream::new(listener);

    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();

    let session_id = Uuid::new_v4();
    let repo = SessionRepository::new(runtime.pool());
    repo.upsert(&UpsertSession {
        session_id,
        tenant_id: "tenant-t32".to_string(),
        user_id: "user-t32".to_string(),
        parent_session_id: None,
        forked_from_session_id: None,
        title: "Empty transcript".to_string(),
        status: "active".to_string(),
        last_message_at: chrono::Utc::now(),
        extra: extra_to_jsonb(&std::collections::HashMap::new()),
    })
    .await
    .unwrap();

    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        Server::builder()
            .add_service(MemoryServiceServer::new(service))
            .serve_with_incoming_shutdown(incoming, async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap();
    });

    let endpoint = format!("http://{addr}");
    let channel = Channel::from_shared(endpoint)
        .unwrap()
        .connect_timeout(Duration::from_secs(2))
        .connect()
        .await
        .unwrap();
    let mut client = MemoryServiceClient::new(channel);

    let response = client
        .get_session_transcript(GetSessionTranscriptRequest {
            meta: Some(RequestMeta {
                request_id: "req-transcript-empty".to_string(),
                session_id: session_id.to_string(),
                user_id: "user-t32".to_string(),
                tenant_id: "tenant-t32".to_string(),
                trace_id: "trace-transcript-empty".to_string(),
                idempotency_key: String::new(),
                deadline_ms: 5000,
                api_version: "memory.v1".to_string(),
            }),
            session_id: session_id.to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert!(response.entries.is_empty());
    assert!(response.transcript_text.is_empty());
    assert!(response.error.is_none());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn get_session_transcript_returns_unavailable_when_raw_content_missing() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let session_id = Uuid::new_v4();
    let mut client;
    let shutdown_tx;
    let server;

    {
        let repo = SessionRepository::new(runtime.pool());
        repo.upsert(&UpsertSession {
            session_id,
            tenant_id: "tenant-tx".to_string(),
            user_id: "user-tx".to_string(),
            parent_session_id: None,
            forked_from_session_id: None,
            title: "Transcript unavailable".to_string(),
            status: "active".to_string(),
            last_message_at: chrono::Utc::now(),
            extra: extra_to_jsonb(&std::collections::HashMap::new()),
        })
        .await
        .unwrap();
    }

    (client, shutdown_tx, server) = start_test_server(config, runtime).await;

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(RequestMeta {
                request_id: "req-transcript-missing-append".to_string(),
                session_id: session_id.to_string(),
                user_id: "user-tx".to_string(),
                tenant_id: "tenant-tx".to_string(),
                trace_id: "trace-transcript-missing-append".to_string(),
                idempotency_key: "idem-transcript-missing-append".to_string(),
                deadline_ms: 5000,
                api_version: "memory.v1".to_string(),
            }),
            session_id: session_id.to_string(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "hello transcript".to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let response = client
        .get_session_transcript(GetSessionTranscriptRequest {
            meta: Some(RequestMeta {
                request_id: "req-transcript-missing".to_string(),
                session_id: session_id.to_string(),
                user_id: "user-tx".to_string(),
                tenant_id: "tenant-tx".to_string(),
                trace_id: "trace-transcript-missing".to_string(),
                idempotency_key: String::new(),
                deadline_ms: 5000,
                api_version: "memory.v1".to_string(),
            }),
            session_id: session_id.to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(!response.ok);
    assert!(response.entries.is_empty());
    assert!(response.transcript_text.is_empty());
    let error = response.error.unwrap();
    assert_eq!(error.code, "RAW_CONTENT_UNAVAILABLE");
    assert!(error.degraded);

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

/// Helper: start a gRPC server and return (client, shutdown_sender, server_join_handle).
async fn start_test_server(
    config: AppConfig,
    runtime: RuntimeState,
) -> (
    MemoryServiceClient<Channel>,
    tokio::sync::oneshot::Sender<()>,
    tokio::task::JoinHandle<()>,
) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let incoming = TcpListenerStream::new(listener);
    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        Server::builder()
            .add_service(MemoryServiceServer::new(service))
            .serve_with_incoming_shutdown(incoming, async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap();
    });

    let endpoint = format!("http://{addr}");
    let channel = Channel::from_shared(endpoint)
        .unwrap()
        .connect_timeout(Duration::from_secs(2))
        .connect()
        .await
        .unwrap();
    let client = MemoryServiceClient::new(channel);

    (client, shutdown_tx, server)
}

fn write_meta_with_idempotency(request_id: &str, session_id: &str) -> RequestMeta {
    RequestMeta {
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
        user_id: "user-t33".to_string(),
        tenant_id: "tenant-t33".to_string(),
        trace_id: format!("trace-{request_id}"),
        idempotency_key: format!("idem-{request_id}"),
        deadline_ms: 5000,
        api_version: "memory.v1".to_string(),
    }
}

async fn wait_for_summary(
    repo: &MemorySummaryRepository,
    tenant_id: &str,
    session_id: Uuid,
) -> koduck_memory::summary::MemorySummary {
    for _ in 0..20 {
        if let Some(summary) = repo.latest_by_session(tenant_id, session_id).await.unwrap() {
            return summary;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("summary was not materialized in time");
}

async fn wait_for_facts(
    repo: &MemoryFactRepository,
    tenant_id: &str,
    session_id: Uuid,
) -> Vec<koduck_memory::facts::MemoryFact> {
    for _ in 0..20 {
        let facts = repo.list_by_session(tenant_id, session_id).await.unwrap();
        if !facts.is_empty() {
            return facts;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("facts were not materialized in time");
}

async fn wait_for_summary_projection(
    repo: &MemoryIndexRepository,
    tenant_id: &str,
    session_id: Uuid,
) -> Vec<koduck_memory::index::MemoryIndexRecord> {
    for _ in 0..20 {
        let records = repo
            .list_by_session(tenant_id, session_id, None, 20)
            .await
            .unwrap();
        if !records.is_empty() {
            return records;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("summary projection was not materialized in time");
}

async fn wait_for_memory_units(
    repo: &MemoryUnitRepository,
    tenant_id: &str,
    session_id: Uuid,
    expected_min: usize,
) -> Vec<koduck_memory::memory_unit::MemoryUnit> {
    for _ in 0..20 {
        let units = repo.list_by_session(tenant_id, session_id, 50).await.unwrap();
        if units.len() >= expected_min {
            return units;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("memory units were not materialized in time");
}

async fn wait_for_failed_task(
    repo: &TaskAttemptRepository,
    task_type: &str,
    request_id: &str,
) -> koduck_memory::reliability::TaskAttempt {
    for _ in 0..20 {
        let attempts = repo.list_failed(Some(task_type), 20).await.unwrap();
        if let Some(attempt) = attempts
            .into_iter()
            .find(|attempt| attempt.request_id.as_deref() == Some(request_id))
        {
            return attempt;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("failed task record was not persisted in time");
}

#[tokio::test]
async fn upsert_session_meta_creates_then_updates() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Create
    let create_resp = client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t33-create", &sid_str)),
            session_id: sid_str.clone(),
            title: "Initial Title".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();
    assert!(create_resp.ok);
    assert!(create_resp.error.is_none());

    // Update: change title, status, add extra
    let mut update_extra = std::collections::HashMap::new();
    update_extra.insert("model".to_string(), "gpt-4".to_string());

    let update_resp = client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t33-update", &sid_str)),
            session_id: sid_str.clone(),
            title: "Updated Title".to_string(),
            status: "archived".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000060000,
            extra: update_extra,
        })
        .await
        .unwrap()
        .into_inner();
    assert!(update_resp.ok);

    // Verify: only one session exists, with updated values
    let get_resp = client
        .get_session(GetSessionRequest {
            meta: Some(write_meta_with_idempotency("t33-get", &sid_str)),
            session_id: sid_str.clone(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(get_resp.ok);
    let session = get_resp.session.unwrap();
    assert_eq!(session.session_id, sid_str);
    assert_eq!(session.title, "Updated Title");
    assert_eq!(session.status, "archived");
    assert_eq!(session.extra.get("model"), Some(&"gpt-4".to_string()));
    assert_eq!(session.last_message_at, 1700000060000);
    // created_at should be from the first insert, updated_at should be later
    assert!(session.created_at <= session.updated_at);

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn upsert_session_meta_updates_last_message_at() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Create with explicit last_message_at
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t33-ts-1", &sid_str)),
            session_id: sid_str.clone(),
            title: "TS Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    // Update with a later last_message_at
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t33-ts-2", &sid_str)),
            session_id: sid_str.clone(),
            title: "TS Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000099999,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    // Verify last_message_at is updated
    let get_resp = client
        .get_session(GetSessionRequest {
            meta: Some(write_meta_with_idempotency("t33-ts-3", &sid_str)),
            session_id: sid_str.clone(),
        })
        .await
        .unwrap()
        .into_inner();

    let session = get_resp.session.unwrap();
    assert_eq!(session.last_message_at, 1700000099999);

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn upsert_session_meta_truth_owned_by_memory() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let repo = SessionRepository::new(runtime.pool());
    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Step 1: Create session directly via repo (simulating legacy write path)
    let original_ts = chrono::Utc::now();
    repo.upsert(&UpsertSession {
        session_id,
        tenant_id: "tenant-t33".to_string(),
        user_id: "user-t33".to_string(),
        parent_session_id: None,
        forked_from_session_id: None,
        title: "Legacy Title".to_string(),
        status: "active".to_string(),
        last_message_at: original_ts,
        extra: serde_json::json!({"source": "legacy"}),
    })
    .await
    .unwrap();

    let (mut client, shutdown_tx, server) =
        start_test_server(test_config(), RuntimeState::initialize(&test_config()).await.unwrap()).await;

    // Step 2: Update via gRPC UpsertSessionMeta (new canonical path)
    let mut gpc_extra = std::collections::HashMap::new();
    gpc_extra.insert("source".to_string(), "gRPC".to_string());
    gpc_extra.insert("version".to_string(), "v2".to_string());

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t33-truth-1", &sid_str)),
            session_id: sid_str.clone(),
            title: "gRPC Title".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000050000,
            extra: gpc_extra,
        })
        .await
        .unwrap()
        .into_inner();

    // Step 3: Verify via GetSession — gRPC values should be the truth
    let get_resp = client
        .get_session(GetSessionRequest {
            meta: Some(write_meta_with_idempotency("t33-truth-2", &sid_str)),
            session_id: sid_str.clone(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(get_resp.ok);
    let session = get_resp.session.unwrap();
    assert_eq!(session.title, "gRPC Title");
    assert_eq!(session.extra.get("source"), Some(&"gRPC".to_string()));
    assert_eq!(session.extra.get("version"), Some(&"v2".to_string()));
    assert_eq!(session.last_message_at, 1700000050000);

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

// ---- Task 4.2: AppendMemory tests ----

#[tokio::test]
async fn append_memory_inserts_entries_and_returns_count() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Seed a session
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t42-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Append Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    let mut meta1 = HashMap::new();
    meta1.insert("message_id".to_string(), "msg-001".to_string());
    let mut meta2 = HashMap::new();
    meta2.insert("message_id".to_string(), "msg-002".to_string());

    let resp = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t42-append-1", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "Hello, world!".to_string(),
                    timestamp: 1700000000000,
                    metadata: meta1,
                },
                MemoryEntry {
                    role: "assistant".to_string(),
                    content: "Hi there!".to_string(),
                    timestamp: 1700000001000,
                    metadata: meta2,
                },
            ],
        })
        .await
        .unwrap()
        .into_inner();

    assert!(resp.ok);
    assert_eq!(resp.appended_count, 2);
    assert!(resp.error.is_none());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_idempotent_duplicate_returns_zero() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Seed a session
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t42-idem-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Idempotency Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    let idem_key = "t42-idem-dup";
    let entries = vec![MemoryEntry {
        role: "user".to_string(),
        content: "test".to_string(),
        timestamp: 1700000000000,
        metadata: HashMap::new(),
    }];

    // First request
    let resp1 = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency(idem_key, &sid_str)),
            session_id: sid_str.clone(),
            entries: entries.clone(),
        })
        .await
        .unwrap()
        .into_inner();
    assert!(resp1.ok);
    assert_eq!(resp1.appended_count, 1);

    // Duplicate request (same idempotency_key)
    let resp2 = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency(idem_key, &sid_str)),
            session_id: sid_str.clone(),
            entries,
        })
        .await
        .unwrap()
        .into_inner();
    assert!(resp2.ok);
    assert_eq!(resp2.appended_count, 0);
    assert!(resp2.error.is_none());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_sequential_appends_increment_sequence() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Seed a session
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t42-seq-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Sequence Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    // First append: 2 entries → sequence 1, 2
    let resp1 = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t42-seq-1", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "first".to_string(),
                    timestamp: 1700000000000,
                    metadata: HashMap::new(),
                },
                MemoryEntry {
                    role: "assistant".to_string(),
                    content: "second".to_string(),
                    timestamp: 1700000001000,
                    metadata: HashMap::new(),
                },
            ],
        })
        .await
        .unwrap()
        .into_inner();
    assert!(resp1.ok);
    assert_eq!(resp1.appended_count, 2);

    // Second append: 1 entry → sequence 3
    let resp2 = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t42-seq-2", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "third".to_string(),
                timestamp: 1700000002000,
                metadata: HashMap::new(),
            }],
        })
        .await
        .unwrap()
        .into_inner();
    assert!(resp2.ok);
    assert_eq!(resp2.appended_count, 1);

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_empty_entries_returns_zero() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    // Seed a session
    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t42-empty-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Empty Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap()
        .into_inner();

    let resp = client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t42-empty", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![],
        })
        .await
        .unwrap()
        .into_inner();

    assert!(resp.ok);
    assert_eq!(resp.appended_count, 0);
    assert!(resp.error.is_none());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_concurrent_requests_keep_sequence_order() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime.clone(), None, Arc::new(RpcMetrics::new()));

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    let create_response = service
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t42-concurrent-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Concurrent Sequence Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: HashMap::new(),
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(create_response.ok);

    let barrier = std::sync::Arc::new(tokio::sync::Barrier::new(3));
    let mut handles = Vec::new();

    for idx in 0..2 {
        let mut metadata = HashMap::new();
        metadata.insert("message_id".to_string(), format!("concurrent-{idx}"));

        let request = AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency(
                &format!("t42-concurrent-{idx}"),
                &sid_str,
            )),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: if idx == 0 {
                    "user".to_string()
                } else {
                    "assistant".to_string()
                },
                content: format!("concurrent-content-{idx}"),
                timestamp: 1700000001000 + idx as i64,
                metadata,
            }],
        };

        let service = service.clone();
        let barrier = barrier.clone();
        handles.push(tokio::spawn(async move {
            barrier.wait().await;
            service
                .append_memory(Request::new(request))
                .await
                .unwrap()
                .into_inner()
        }));
    }

    barrier.wait().await;

    let mut total_appended = 0;
    for handle in handles {
        let response = handle.await.unwrap();
        assert!(response.ok);
        assert_eq!(response.appended_count, 1);
        total_appended += response.appended_count;
    }
    assert_eq!(total_appended, 2);

    let repo = MemoryEntryRepository::new(runtime.pool());
    let mut entries = repo
        .list_by_session("tenant-t33", session_id, None)
        .await
        .unwrap();

    assert_eq!(entries.len(), 2);
    entries.sort_by_key(|entry| entry.sequence_num);

    let sequence_numbers: Vec<i64> =
        entries.iter().map(|entry| entry.sequence_num).collect();
    assert_eq!(sequence_numbers, vec![1, 2]);
    assert_ne!(entries[0].id, entries[1].id);
}

#[tokio::test]
async fn append_memory_populates_l1_index_and_query_memory_reads_it() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime.clone(), None, Arc::new(RpcMetrics::new()));

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    let session_resp = service
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t51-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "L1 Index Test".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: HashMap::new(),
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(session_resp.ok);

    let mut metadata = HashMap::new();
    metadata.insert("message_id".to_string(), "msg-t51-1".to_string());

    let append_resp = service
        .append_memory(Request::new(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t51-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Need a concise quarterly planning checklist for the dev rollout"
                    .to_string(),
                timestamp: 1700000001000,
                metadata,
            }],
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(append_resp.ok);
    assert_eq!(append_resp.appended_count, 1);

    let index_repo = MemoryIndexRepository::new(runtime.pool());
    let records = index_repo
        .list_by_session("tenant-t33", session_id, None, 10)
        .await
        .unwrap();

    assert_eq!(records.len(), 1);
    let record = &records[0];
    assert_eq!(record.tenant_id, "tenant-t33");
    assert_eq!(record.session_id, session_id);
    assert_eq!(record.memory_kind, "user");
    assert_eq!(record.domain_class, "chat");
    assert!(record.summary.contains("quarterly planning checklist"));
    assert!(
        record
            .snippet
            .as_ref()
            .is_some_and(|snippet| snippet.contains("quarterly planning checklist"))
    );
    assert!(record.source_uri.starts_with("l0://pending/"));
    assert!(record.entry_id.is_some());

    let query_resp = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t51-query", &sid_str)),
            query_text: String::new(),
            session_id: sid_str,
            domain_class: "chat".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicyDomainFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(query_resp.ok);
    assert_eq!(query_resp.hits.len(), 1);
    let hit = &query_resp.hits[0];
    assert_eq!(hit.l0_uri, record.source_uri);
    assert!(hit.snippet.contains("quarterly planning checklist"));
    assert!(hit.match_reasons.contains(&"domain_hit".to_string()));
    assert!(hit.match_reasons.contains(&"session_scope_hit".to_string()));
    assert_match_reasons_are_closed_set(&hit.match_reasons);
}

#[tokio::test]
async fn append_memory_materializes_generic_memory_units() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let unit_repo = MemoryUnitRepository::new(runtime.pool());
    let anchor_repo = MemoryUnitAnchorRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t53-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Generic units".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t53-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "Need a rollout checklist".to_string(),
                    timestamp: 1700000000000,
                    metadata: std::collections::HashMap::new(),
                },
                MemoryEntry {
                    role: "assistant".to_string(),
                    content: "I will prepare a concise checklist".to_string(),
                    timestamp: 1700000001000,
                    metadata: std::collections::HashMap::new(),
                },
            ],
        })
        .await
        .unwrap();

    let mut units = wait_for_memory_units(&unit_repo, "tenant-t33", session_id, 2).await;
    units.sort_by_key(|unit| unit.entry_range_start);

    assert_eq!(units.len(), 2);
    assert!(units.iter().all(|unit| unit.memory_kind == MemoryUnitKind::GenericConversation));
    assert!(units.iter().all(|unit| unit.summary_state.summary_status == "pending"));
    assert_eq!(units[0].entry_range_start, 1);
    assert_eq!(units[0].entry_range_end, 1);
    assert_eq!(units[1].entry_range_start, 2);
    assert_eq!(units[1].entry_range_end, 2);

    let anchors = anchor_repo
        .list_by_memory_unit("tenant-t33", units[0].memory_unit_id)
        .await
        .unwrap();
    assert!(anchors.iter().any(|anchor| {
        anchor.anchor_type == MemoryUnitAnchorType::DiscourseAction
            && anchor.anchor_key == "other"
    }));

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn summarize_memory_materializes_summary_and_domain_class() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t71-seed-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Task follow-up session".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t71-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "Please track the rollout task".to_string(),
                    timestamp: 1700000000000,
                    metadata: std::collections::HashMap::new(),
                },
                MemoryEntry {
                    role: "assistant".to_string(),
                    content: "I will prepare the follow-up steps".to_string(),
                    timestamp: 1700000001000,
                    metadata: std::collections::HashMap::new(),
                },
            ],
        })
        .await
        .unwrap();

    let summarize = client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency("t71-summary", &sid_str)),
            session_id: sid_str.clone(),
            strategy: "session-rollup".to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(summarize.ok);
    assert!(summarize.error.is_none());
    assert!(summarize.summary.contains("accepted"));

    let stored = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    assert_eq!(stored.domain_class, "task");
    assert_eq!(stored.strategy, "session-rollup");
    assert!(stored.summary.contains("Task follow-up session"));

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn summarize_memory_domain_class_is_queryable_via_domain_first() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t71-query-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Task board".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t71-query-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Need a task summary".to_string(),
                timestamp: 1700000002000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency("t71-query-summary", &sid_str)),
            session_id: sid_str.clone(),
            strategy: String::new(),
        })
        .await
        .unwrap();

    let stored = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    assert_eq!(stored.domain_class, "task");

    let response = client
        .query_memory(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t71-query-memory", &sid_str)),
            session_id: sid_str.clone(),
            query_text: "task".to_string(),
            domain_class: "task".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: 1,
            page_token: String::new(),
            page_size: 0,
        })
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert!(
        response
            .hits
            .iter()
            .any(|hit| hit.l0_uri.starts_with("memory-summary://"))
    );
    assert!(
        response
            .hits
            .iter()
            .any(|hit| hit.match_reasons.contains(&"domain_hit".to_string()))
    );
    for hit in &response.hits {
        assert_match_reasons_are_closed_set(&hit.match_reasons);
    }

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn summarize_memory_extracts_candidate_facts_independently() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let fact_repo = MemoryFactRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t72-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Deployment preferences".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t72-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "I prefer concise rollout summaries".to_string(),
                    timestamp: 1700000000000,
                    metadata: std::collections::HashMap::new(),
                },
                MemoryEntry {
                    role: "user".to_string(),
                    content: "Please do not include raw secrets in logs".to_string(),
                    timestamp: 1700000001000,
                    metadata: std::collections::HashMap::new(),
                },
            ],
        })
        .await
        .unwrap();

    let summarize = client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency("t72-summary", &sid_str)),
            session_id: sid_str.clone(),
            strategy: "session-rollup".to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(summarize.ok);
    assert!(summarize.error.is_none());
    assert!(summarize.summary.contains("accepted"));

    let stored_summary = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    assert!(stored_summary.summary.contains("Deployment preferences"));

    let facts = wait_for_facts(&fact_repo, "tenant-t33", session_id).await;
    assert!(facts.iter().any(|fact| fact.fact_type == "session_focus"));
    assert!(facts.iter().any(|fact| fact.fact_type == "preference"));
    assert!(facts.iter().any(|fact| fact.fact_type == "constraint"));
    assert!(facts.iter().all(|fact| fact.domain_class == stored_summary.domain_class));

    let response = client
        .query_memory(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t72-query-memory", &sid_str)),
            session_id: sid_str,
            query_text: "rollout".to_string(),
            domain_class: stored_summary.domain_class.clone(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: 1,
            page_token: String::new(),
            page_size: 0,
        })
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert!(response.hits.iter().all(|hit| !hit.l0_uri.starts_with("memory-fact://")));

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn summarize_memory_materializes_summary_and_fact_units() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let fact_repo = MemoryFactRepository::new(runtime.pool());
    let unit_repo = MemoryUnitRepository::new(runtime.pool());
    let anchor_repo = MemoryUnitAnchorRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t73-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Fact units".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t73-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![
                MemoryEntry {
                    role: "user".to_string(),
                    content: "I prefer concise rollout summaries".to_string(),
                    timestamp: 1700000000000,
                    metadata: std::collections::HashMap::new(),
                },
                MemoryEntry {
                    role: "user".to_string(),
                    content: "Do not include raw secrets in logs".to_string(),
                    timestamp: 1700000001000,
                    metadata: std::collections::HashMap::new(),
                },
            ],
        })
        .await
        .unwrap();

    client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency("t73-summary", &sid_str)),
            session_id: sid_str.clone(),
            strategy: "session-rollup".to_string(),
        })
        .await
        .unwrap();

    let stored_summary = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    let facts = wait_for_facts(&fact_repo, "tenant-t33", session_id).await;
    let units = wait_for_memory_units(&unit_repo, "tenant-t33", session_id, 3).await;

    let summary_unit = units
        .iter()
        .find(|unit| unit.memory_kind == MemoryUnitKind::Summary)
        .expect("summary unit should exist");
    assert_eq!(
        summary_unit.domain_class_primary.as_deref(),
        Some(stored_summary.domain_class.as_str())
    );
    assert_eq!(summary_unit.entry_range_start, 1);
    assert_eq!(summary_unit.entry_range_end, 2);
    assert_eq!(summary_unit.memory_unit_id, session_id);
    assert_eq!(summary_unit.summary_state.summary_status, "ready");
    assert_eq!(
        summary_unit.summary_state.summary.as_deref(),
        Some(stored_summary.summary.as_str())
    );
    assert_eq!(
        summary_unit.source_uri,
        format!(
            "memory-summary://tenants/{}/sessions/{}/versions/{}",
            stored_summary.tenant_id, session_id, stored_summary.version
        )
    );

    let fact_units = units
        .iter()
        .filter(|unit| unit.memory_kind == MemoryUnitKind::Fact)
        .collect::<Vec<_>>();
    assert_eq!(fact_units.len(), facts.len());
    assert!(fact_units.iter().all(|unit| unit.entry_range_start == 1 && unit.entry_range_end == 2));
    assert!(fact_units.iter().all(|unit| unit.summary_state.summary_status == "pending"));
    assert!(fact_units.iter().all(|unit| {
        unit.domain_class_primary.as_deref() == Some(stored_summary.domain_class.as_str())
    }));

    let summary_anchors = anchor_repo
        .list_by_memory_unit("tenant-t33", summary_unit.memory_unit_id)
        .await
        .unwrap();
    assert!(summary_anchors.iter().any(|anchor| anchor.anchor_key == stored_summary.domain_class));
    assert!(summary_anchors.iter().any(|anchor| {
        anchor.anchor_type == MemoryUnitAnchorType::DiscourseAction
            && anchor.anchor_key == "other"
    }));

    for fact in &facts {
        let anchors = anchor_repo
            .list_by_memory_unit("tenant-t33", fact.id)
            .await
            .unwrap();
        assert!(anchors.iter().any(|anchor| anchor.anchor_key == stored_summary.domain_class));
        assert!(anchors.iter().any(|anchor| anchor.anchor_key == fact.fact_type));
        assert!(anchors.iter().any(|anchor| {
            anchor.anchor_type == MemoryUnitAnchorType::DiscourseAction
                && anchor.anchor_key == "other"
        }));
    }

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_materializes_discourse_action_anchor_for_comparison_prompt() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let unit_repo = MemoryUnitRepository::new(runtime.pool());
    let anchor_repo = MemoryUnitAnchorRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t53b-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Comparison units".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t53b-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Compare Rust vs Go for backend services".to_string(),
                timestamp: 1700000000000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let units = wait_for_memory_units(&unit_repo, "tenant-t33", session_id, 1).await;
    let anchors = anchor_repo
        .list_by_memory_unit("tenant-t33", units[0].memory_unit_id)
        .await
        .unwrap();

    assert!(anchors.iter().any(|anchor| {
        anchor.anchor_type == MemoryUnitAnchorType::DiscourseAction
            && anchor.anchor_key == "comparison"
    }));
    assert!(!anchors.iter().any(|anchor| {
        anchor.anchor_type == MemoryUnitAnchorType::DiscourseAction
            && anchor.anchor_key == "other"
    }));

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn append_memory_recomputes_session_level_summary_and_facts() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let fact_repo = MemoryFactRepository::new(runtime.pool());
    let index_repo = MemoryIndexRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t72b-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "People tracking".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t72b-append-1", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "First we discussed Karl Marx and Friedrich Engels".to_string(),
                timestamp: 1700000000000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let first_summary = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    let first_projection = wait_for_summary_projection(&index_repo, "tenant-t33", session_id).await;
    let first_facts = wait_for_facts(&fact_repo, "tenant-t33", session_id).await;

    assert_eq!(first_projection.len(), 1);
    assert_eq!(first_projection[0].memory_unit_id, Some(session_id));
    assert!(
        first_summary.summary.contains("Karl Marx")
            || first_summary.summary.contains("Friedrich Engels")
    );
    assert!(
        first_facts.iter().all(|fact| !fact.fact_text.contains("Lenin")),
        "first session facts should not contain future entities"
    );

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t72b-append-2", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Then the conversation expanded to Vladimir Lenin".to_string(),
                timestamp: 1700000001000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let mut updated_summary = None;
    for _ in 0..20 {
        let candidate = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
        if candidate.version > first_summary.version {
            updated_summary = Some(candidate);
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let updated_summary = updated_summary.expect("updated summary was not materialized in time");
    let updated_projection = wait_for_summary_projection(&index_repo, "tenant-t33", session_id).await;
    let mut updated_facts = None;
    for _ in 0..20 {
        let facts = fact_repo.list_by_session("tenant-t33", session_id).await.unwrap();
        if facts.iter().any(|fact| fact.fact_text.contains("Vladimir Lenin")) {
            updated_facts = Some(facts);
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    let updated_facts = updated_facts.expect("updated facts were not materialized in time");

    assert_eq!(updated_projection.len(), 1);
    assert_eq!(updated_projection[0].memory_unit_id, Some(session_id));
    assert_eq!(updated_projection[0].summary, updated_summary.summary);
    assert!(
        updated_summary.summary.contains("Karl Marx")
            || updated_summary.summary.contains("Friedrich Engels")
    );
    assert!(
        updated_summary.summary.contains("Vladimir Lenin")
            || updated_summary.summary.contains("Lenin")
    );
    assert!(
        updated_facts.iter().all(|fact| fact.session_id == session_id),
        "recomputed facts must remain session-scoped"
    );
    assert!(
        updated_facts.iter().any(|fact| fact.fact_text.contains("Vladimir Lenin")),
        "recomputed facts should reflect the latest session transcript"
    );

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn query_memory_summary_first_filters_candidates_with_session_scope() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();
    let other_session_id = Uuid::new_v4();
    let other_sid_str = other_session_id.to_string();

    for (request_id, target_session_id, title) in [
        ("t53-seed-1", sid_str.clone(), "Summary First Session"),
        ("t53-seed-2", other_sid_str.clone(), "Other Session"),
    ] {
        let resp = service
            .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
                meta: Some(write_meta_with_idempotency(request_id, &target_session_id)),
                session_id: target_session_id,
                title: title.to_string(),
                status: "active".to_string(),
                parent_session_id: String::new(),
                forked_from_session_id: String::new(),
                last_message_at: 1700000000000,
                extra: HashMap::new(),
            }))
            .await
            .unwrap()
            .into_inner();
        assert!(resp.ok);
    }

    let append_cases = [
        (
            "t53-append-keep",
            sid_str.clone(),
            "Need a release checklist for the dev rollout next week",
        ),
        (
            "t53-append-drop",
            sid_str.clone(),
            "Discussed lunch options and weekend travel plans",
        ),
        (
            "t53-append-other",
            other_sid_str.clone(),
            "Need a release checklist for the production rollout",
        ),
    ];

    for (request_id, target_session_id, content) in append_cases {
        let resp = service
            .append_memory(Request::new(AppendMemoryRequest {
                meta: Some(write_meta_with_idempotency(request_id, &target_session_id)),
                session_id: target_session_id,
                entries: vec![MemoryEntry {
                    role: "user".to_string(),
                    content: content.to_string(),
                    timestamp: 1700000001000,
                    metadata: HashMap::new(),
                }],
            }))
            .await
            .unwrap()
            .into_inner();
        assert!(resp.ok);
        assert_eq!(resp.appended_count, 1);
    }

    let response = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t53-query", &sid_str)),
            query_text: "release checklist rollout".to_string(),
            session_id: sid_str,
            domain_class: "chat".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicySummaryFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert_eq!(response.hits.len(), 1);

    let hit = &response.hits[0];
    assert!(hit.snippet.contains("release checklist"));
    assert!(hit.match_reasons.contains(&"domain_hit".to_string()));
    assert!(hit.match_reasons.contains(&"summary_hit".to_string()));
    assert!(hit.match_reasons.contains(&"session_scope_hit".to_string()));
    assert_match_reasons_are_closed_set(&hit.match_reasons);
}

#[tokio::test]
async fn query_memory_summary_first_keeps_recent_hits_when_summary_pending() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime, None, Arc::new(RpcMetrics::new()));

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    let session_resp = service
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t55-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Pending summary session".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: HashMap::new(),
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(session_resp.ok);

    let append_resp = service
        .append_memory(Request::new(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t55-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Need release checklist for next deployment".to_string(),
                timestamp: 1700000001000,
                metadata: HashMap::new(),
            }],
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(append_resp.ok);
    assert_eq!(append_resp.appended_count, 1);

    let response = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t55-query", &sid_str)),
            query_text: "release checklist deployment".to_string(),
            session_id: sid_str,
            domain_class: "chat".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicySummaryFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert!(!response.hits.is_empty());
    assert!(response
        .hits
        .iter()
        .any(|hit| hit.snippet.contains("release checklist")));
    assert!(response
        .hits
        .iter()
        .all(|hit| !hit.match_reasons.contains(&"summary_hit".to_string())));
    for hit in &response.hits {
        assert_match_reasons_are_closed_set(&hit.match_reasons);
    }
}

#[tokio::test]
async fn query_memory_summary_first_ignores_low_quality_ready_summary() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime.clone(), None, Arc::new(RpcMetrics::new()));
    let unit_repo = MemoryUnitRepository::new(runtime.pool());
    let index_repo = MemoryIndexRepository::new(runtime.pool());

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();
    let tenant_id = "tenant-t33";

    service
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t56-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Low quality summary session".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: HashMap::new(),
        }))
        .await
        .unwrap();

    service
        .append_memory(Request::new(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t56-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Need deployment checklist details".to_string(),
                timestamp: 1700000001000,
                metadata: HashMap::new(),
            }],
        }))
        .await
        .unwrap();

    let low_quality_summary_uri =
        format!("memory-summary://tenants/{tenant_id}/sessions/{session_id}/versions/1");
    let summary_unit = InsertMemoryUnit::new(
        tenant_id,
        session_id,
        1,
        1,
        low_quality_summary_uri.clone(),
    )
    .unwrap()
    .with_memory_unit_id(session_id)
    .with_memory_kind(MemoryUnitKind::Summary)
    .with_summary_state(MemoryUnitSummaryState::ready("todo: summarize later").unwrap())
    .with_time_bucket("2026-04");
    unit_repo.upsert(&summary_unit).await.unwrap();
    index_repo
        .insert(
            &InsertMemoryIndexRecord::new(
                tenant_id,
                session_id,
                "summary",
                "chat",
                "deployment checklist summary",
                low_quality_summary_uri,
            )
            .with_memory_unit_id(session_id)
            .with_snippet("deployment checklist summary"),
        )
        .await
        .unwrap();

    let response = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t56-query", &sid_str)),
            query_text: "deployment checklist".to_string(),
            session_id: sid_str,
            domain_class: "chat".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicySummaryFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert!(!response.hits.is_empty());
    assert!(response
        .hits
        .iter()
        .all(|hit| !hit.match_reasons.contains(&"summary_hit".to_string())));
}

#[tokio::test]
async fn query_memory_explicit_recall_returns_global_session_summaries() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime.clone(), None, Arc::new(RpcMetrics::new()));
    let index_repo = MemoryIndexRepository::new(runtime.pool());

    let first_session_id = Uuid::new_v4();
    let first_sid = first_session_id.to_string();
    let second_session_id = Uuid::new_v4();
    let second_sid = second_session_id.to_string();

    for (request_id, session_id, title) in [
        ("t57-seed-1", first_sid.clone(), "Recall session one"),
        ("t57-seed-2", second_sid.clone(), "Recall session two"),
    ] {
        let response = service
            .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
                meta: Some(write_meta_with_idempotency(request_id, &session_id)),
                session_id,
                title: title.to_string(),
                status: "active".to_string(),
                parent_session_id: String::new(),
                forked_from_session_id: String::new(),
                last_message_at: 1700000000000,
                extra: HashMap::new(),
            }))
            .await
            .unwrap()
            .into_inner();
        assert!(response.ok);
    }

    for (request_id, session_id, content) in [
        ("t57-append-1", first_sid.clone(), "We talked about Lu Xun and his essays."),
        ("t57-append-2", second_sid.clone(), "We compared Rust rollout plans with Go services."),
    ] {
        let response = service
            .append_memory(Request::new(AppendMemoryRequest {
                meta: Some(write_meta_with_idempotency(request_id, &session_id)),
                session_id,
                entries: vec![MemoryEntry {
                    role: "user".to_string(),
                    content: content.to_string(),
                    timestamp: 1700000001000,
                    metadata: HashMap::new(),
                }],
            }))
            .await
            .unwrap()
            .into_inner();
        assert!(response.ok);
    }

    let first_projection =
        wait_for_summary_projection(&index_repo, "tenant-t33", first_session_id).await;
    let second_projection =
        wait_for_summary_projection(&index_repo, "tenant-t33", second_session_id).await;
    assert!(!first_projection.is_empty());
    assert!(!second_projection.is_empty());

    let response = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t57-query", &first_sid)),
            query_text: "我们之前聊过什么".to_string(),
            session_id: String::new(),
            domain_class: "chat".to_string(),
            top_k: 10,
            query_intent: QueryIntent::Recall as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicyDomainFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(response.ok);
    assert_eq!(response.hits.len(), 2);
    assert!(response
        .hits
        .iter()
        .any(|hit| hit.session_id == first_sid && hit.snippet.contains("Lu Xun")));
    assert!(response
        .hits
        .iter()
        .any(|hit| hit.session_id == second_sid && hit.snippet.contains("Rust")));
    for hit in &response.hits {
        assert!(hit.match_reasons.contains(&"summary_hit".to_string()));
        assert!(hit.match_reasons.contains(&"recency_boost".to_string()));
        assert_match_reasons_are_closed_set(&hit.match_reasons);
    }
}

#[tokio::test]
async fn query_memory_falls_back_when_query_analyzer_fails() {
    let config = test_config();
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let service = MemoryGrpcService::new(config, runtime.clone(), None, Arc::new(RpcMetrics::new()));

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();

    let session_resp = service
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t54-seed", &sid_str)),
            session_id: sid_str.clone(),
            title: "Analyzer fallback".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: HashMap::new(),
        }))
        .await
        .unwrap()
        .into_inner();
    assert!(session_resp.ok);

    let query_resp = service
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(write_meta_with_idempotency("t54-query", &sid_str)),
            query_text: "remember what we discussed".to_string(),
            session_id: "not-a-uuid".to_string(),
            domain_class: "chat".to_string(),
            top_k: 5,
            query_intent: QueryIntent::Unspecified as i32,
            retrieve_policy: RetrievePolicy::RetrievePolicyDomainFirst as i32,
            page_token: String::new(),
            page_size: 0,
        }))
        .await
        .unwrap()
        .into_inner();

    assert!(query_resp.ok);
    assert!(query_resp.error.is_none());
}

#[tokio::test]
async fn summarize_memory_retries_fact_stage_without_blocking_summary() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    config.retry.max_attempts = 3;
    config.retry.initial_delay_ms = 10;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let fact_repo = MemoryFactRepository::new(runtime.pool());
    let attempt_repo = TaskAttemptRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();
    let request_id = "t73-facts-retry";

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t73-retry-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Retry facts".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t73-retry-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "I prefer terse updates".to_string(),
                timestamp: 1700000000000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let summarize = client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency(request_id, &sid_str)),
            session_id: sid_str.clone(),
            strategy: "test-fail-summary_facts_extract-once".to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(summarize.ok);
    let _ = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    let facts = wait_for_facts(&fact_repo, "tenant-t33", session_id).await;
    assert!(!facts.is_empty());

    let attempts = attempt_repo.list_by_request_id(request_id).await.unwrap();
    let fact_attempts: Vec<_> = attempts
        .into_iter()
        .filter(|attempt| attempt.task_type == "summary_facts_extract")
        .collect();
    assert_eq!(fact_attempts.len(), 2);
    assert!(fact_attempts.iter().all(|attempt| attempt.status == "succeeded"));
    let _ = shutdown_tx.send(());
    server.await.unwrap();
}

#[tokio::test]
async fn summarize_memory_records_failed_stage_for_compensation() {
    let mut config = test_config();
    config.summary.async_enabled = true;
    config.retry.max_attempts = 2;
    config.retry.initial_delay_ms = 10;
    let runtime = RuntimeState::initialize(&config).await.unwrap();
    let summary_repo = MemorySummaryRepository::new(runtime.pool());
    let fact_repo = MemoryFactRepository::new(runtime.pool());
    let attempt_repo = TaskAttemptRepository::new(runtime.pool());
    let (mut client, shutdown_tx, server) = start_test_server(config, runtime).await;

    let session_id = Uuid::new_v4();
    let sid_str = session_id.to_string();
    let request_id = "t73-facts-fail";

    client
        .upsert_session_meta(UpsertSessionMetaRequest {
            meta: Some(write_meta_with_idempotency("t73-fail-session", &sid_str)),
            session_id: sid_str.clone(),
            title: "Compensation facts".to_string(),
            status: "active".to_string(),
            parent_session_id: String::new(),
            forked_from_session_id: String::new(),
            last_message_at: 1700000000000,
            extra: [].into(),
        })
        .await
        .unwrap();

    client
        .append_memory(AppendMemoryRequest {
            meta: Some(write_meta_with_idempotency("t73-fail-append", &sid_str)),
            session_id: sid_str.clone(),
            entries: vec![MemoryEntry {
                role: "user".to_string(),
                content: "Do not leak secrets into rollout logs".to_string(),
                timestamp: 1700000000000,
                metadata: std::collections::HashMap::new(),
            }],
        })
        .await
        .unwrap();

    let summarize = client
        .summarize_memory(SummarizeMemoryRequest {
            meta: Some(write_meta_with_idempotency(request_id, &sid_str)),
            session_id: sid_str.clone(),
            strategy: "test-fail-summary_facts_extract-always".to_string(),
        })
        .await
        .unwrap()
        .into_inner();

    assert!(summarize.ok);

    let stored_summary = wait_for_summary(&summary_repo, "tenant-t33", session_id).await;
    assert!(stored_summary.summary.contains("Compensation facts"));

    let failed = wait_for_failed_task(&attempt_repo, "summary_facts_extract", request_id).await;
    assert_eq!(failed.status, "failed");
    assert_eq!(failed.request_id.as_deref(), Some(request_id));
    assert!(
        failed
            .error_message
            .as_deref()
            .unwrap_or_default()
            .contains("injected")
    );

    let facts = fact_repo.list_by_session("tenant-t33", session_id).await.unwrap();
    assert!(facts.is_empty());

    let _ = shutdown_tx.send(());
    server.await.unwrap();
}
