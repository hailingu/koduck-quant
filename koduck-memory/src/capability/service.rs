use std::collections::HashMap;

use tonic::{Request, Response, Status};

use crate::api::{
    AppendMemoryRequest, AppendMemoryResponse, Capability, ErrorDetail, GetSessionRequest,
    GetSessionResponse, MemoryService, QueryMemoryRequest, QueryMemoryResponse, RequestMeta,
    SummarizeMemoryRequest, SummarizeMemoryResponse, UpsertSessionMetaRequest,
    UpsertSessionMetaResponse,
};
use crate::config::AppConfig;
use crate::session::{SessionRepository, UpsertSession, extra_to_jsonb, parse_optional_uuid, parse_uuid};
use crate::store::RuntimeState;

const MAX_TOP_K: i32 = 20;
const MAX_PAGE_SIZE: i32 = 100;
const RECOMMENDED_TIMEOUT_MS: i64 = 5000;

#[derive(Clone)]
pub struct MemoryGrpcService {
    config: AppConfig,
    runtime: RuntimeState,
}

impl MemoryGrpcService {
    pub fn new(config: AppConfig, runtime: RuntimeState) -> Self {
        Self { config, runtime }
    }

    fn session_repo(&self) -> SessionRepository {
        SessionRepository::new(self.runtime.pool())
    }

    fn capability_response(&self) -> Capability {
        let mut features = HashMap::new();
        features.insert("session_meta".to_string(), "true".to_string());
        features.insert("query_memory".to_string(), "true".to_string());
        features.insert("append_memory".to_string(), "true".to_string());
        features.insert("summary".to_string(), "true".to_string());
        features.insert("domain_first_search".to_string(), "true".to_string());
        features.insert("summary_search".to_string(), "true".to_string());
        features.insert("append_mode".to_string(), "object_per_append".to_string());
        features.insert(
            "retrieve_policy.default".to_string(),
            self.config.index.mode.clone(),
        );
        features.insert(
            "summary_async".to_string(),
            self.config.summary.async_enabled.to_string(),
        );

        let mut limits = HashMap::new();
        limits.insert("max_top_k".to_string(), MAX_TOP_K.to_string());
        limits.insert("max_page_size".to_string(), MAX_PAGE_SIZE.to_string());
        limits.insert(
            "recommended_timeout_ms".to_string(),
            RECOMMENDED_TIMEOUT_MS.to_string(),
        );
        limits.insert(
            "capabilities_ttl_secs".to_string(),
            self.config.capabilities.ttl_secs.to_string(),
        );

        Capability {
            service: "memory".to_string(),
            contract_versions: vec!["memory.v1".to_string()],
            features,
            limits,
        }
    }

    fn not_implemented_error(method: &str) -> Option<ErrorDetail> {
        Some(ErrorDetail {
            code: "NOT_IMPLEMENTED".to_string(),
            message: format!("{method} is not implemented yet"),
            retryable: false,
            degraded: false,
            upstream: "koduck-memory".to_string(),
            retry_after_ms: 0,
        })
    }

    fn validate_meta(meta: &RequestMeta) -> Result<(), Status> {
        if meta.request_id.trim().is_empty() {
            return Err(Status::invalid_argument("request_id is required"));
        }
        if meta.session_id.trim().is_empty() {
            return Err(Status::invalid_argument("session_id is required"));
        }
        if meta.user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user_id is required"));
        }
        if meta.tenant_id.trim().is_empty() {
            return Err(Status::invalid_argument("tenant_id is required"));
        }
        if meta.trace_id.trim().is_empty() {
            return Err(Status::invalid_argument("trace_id is required"));
        }
        if meta.deadline_ms <= 0 {
            return Err(Status::invalid_argument("deadline_ms must be greater than 0"));
        }
        if meta.api_version.trim().is_empty() {
            return Err(Status::invalid_argument("api_version is required"));
        }
        Ok(())
    }

    fn validate_write_meta(meta: &RequestMeta) -> Result<(), Status> {
        Self::validate_meta(meta)?;
        if meta.idempotency_key.trim().is_empty() {
            return Err(Status::invalid_argument("idempotency_key is required"));
        }
        Ok(())
    }
}

#[tonic::async_trait]
impl MemoryService for MemoryGrpcService {
    async fn get_capabilities(
        &self,
        request: Request<RequestMeta>,
    ) -> Result<Response<Capability>, Status> {
        Self::validate_meta(request.get_ref())?;
        Ok(Response::new(self.capability_response()))
    }

    async fn upsert_session_meta(
        &self,
        request: Request<UpsertSessionMetaRequest>,
    ) -> Result<Response<UpsertSessionMetaResponse>, Status> {
        let req = request.get_ref();
        let meta = req
            .meta
            .as_ref()
            .ok_or_else(|| Status::invalid_argument("meta is required"))?;
        Self::validate_write_meta(meta)?;

        let session_id =
            parse_uuid(&req.session_id).map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        let last_message_at = if req.last_message_at > 0 {
            chrono::DateTime::from_timestamp_millis(req.last_message_at)
                .ok_or_else(|| Status::invalid_argument("invalid last_message_at"))?
        } else {
            chrono::Utc::now()
        };

        let upsert = UpsertSession {
            session_id,
            tenant_id: meta.tenant_id.clone(),
            user_id: meta.user_id.clone(),
            parent_session_id: parse_optional_uuid(&req.parent_session_id),
            forked_from_session_id: parse_optional_uuid(&req.forked_from_session_id),
            title: if req.title.is_empty() {
                "untitled".to_string()
            } else {
                req.title.clone()
            },
            status: if req.status.is_empty() {
                "active".to_string()
            } else {
                req.status.clone()
            },
            last_message_at,
            extra: extra_to_jsonb(&req.extra),
        };

        self.session_repo()
            .upsert(&upsert)
            .await
            .map_err(|e| Status::internal(format!("failed to upsert session: {e}")))?;

        Ok(Response::new(UpsertSessionMetaResponse {
            ok: true,
            error: None,
        }))
    }

    async fn get_session(
        &self,
        request: Request<GetSessionRequest>,
    ) -> Result<Response<GetSessionResponse>, Status> {
        let req = request.get_ref();
        let meta = req
            .meta
            .as_ref()
            .ok_or_else(|| Status::invalid_argument("meta is required"))?;
        Self::validate_meta(meta)?;

        let session_id =
            parse_uuid(&req.session_id).map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        match self
            .session_repo()
            .get_by_id(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to get session: {e}")))?
        {
            Some(session) => Ok(Response::new(GetSessionResponse {
                ok: true,
                session: Some(session.to_proto()),
                error: None,
            })),
            None => Ok(Response::new(GetSessionResponse {
                ok: false,
                session: None,
                error: Some(ErrorDetail {
                    code: "RESOURCE_NOT_FOUND".to_string(),
                    message: "session not found".to_string(),
                    retryable: false,
                    degraded: false,
                    upstream: "koduck-memory".to_string(),
                    retry_after_ms: 0,
                }),
            })),
        }
    }

    async fn query_memory(
        &self,
        request: Request<QueryMemoryRequest>,
    ) -> Result<Response<QueryMemoryResponse>, Status> {
        Self::validate_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
            Status::invalid_argument("meta is required")
        })?)?;
        Ok(Response::new(QueryMemoryResponse {
            ok: false,
            hits: Vec::new(),
            next_page_token: String::new(),
            error: Self::not_implemented_error("QueryMemory"),
        }))
    }

    async fn append_memory(
        &self,
        request: Request<AppendMemoryRequest>,
    ) -> Result<Response<AppendMemoryResponse>, Status> {
        Self::validate_write_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
            Status::invalid_argument("meta is required")
        })?)?;
        Ok(Response::new(AppendMemoryResponse {
            ok: false,
            appended_count: 0,
            error: Self::not_implemented_error("AppendMemory"),
        }))
    }

    async fn summarize_memory(
        &self,
        request: Request<SummarizeMemoryRequest>,
    ) -> Result<Response<SummarizeMemoryResponse>, Status> {
        Self::validate_write_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
            Status::invalid_argument("meta is required")
        })?)?;
        Ok(Response::new(SummarizeMemoryResponse {
            ok: false,
            summary: format!(
                "{} skeleton is ready; summarization will arrive in later phases",
                self.config.app.name
            ),
            error: Self::not_implemented_error("SummarizeMemory"),
        }))
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::MemoryGrpcService;
    use crate::api::{GetSessionRequest, MemoryServiceClient, MemoryServiceServer, RequestMeta};
    use crate::config::{
        AppConfig, AppSection, CapabilitiesSection, IndexSection, ObjectStoreSection,
        PostgresSection, ServerSection, SummarySection,
    };
    use crate::session::{SessionRepository, UpsertSession, extra_to_jsonb};
    use crate::store::RuntimeState;
    use tokio::net::TcpListener;
    use tokio_stream::wrappers::TcpListenerStream;
    use tonic::transport::{Channel, Server};
    use uuid::Uuid;

    fn valid_meta() -> RequestMeta {
        RequestMeta {
            request_id: "req-1".to_string(),
            session_id: "session-1".to_string(),
            user_id: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            trace_id: "trace-1".to_string(),
            idempotency_key: "idem-1".to_string(),
            deadline_ms: 5000,
            api_version: "memory.v1".to_string(),
        }
    }

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
            summary: SummarySection { async_enabled: false },
            index: IndexSection {
                mode: "domain-first".to_string(),
            },
        }
    }

    #[test]
    fn validate_meta_rejects_missing_tenant_id() {
        let mut meta = valid_meta();
        meta.tenant_id.clear();

        let error = MemoryGrpcService::validate_meta(&meta).unwrap_err();

        assert_eq!(error.code(), tonic::Code::InvalidArgument);
        assert_eq!(error.message(), "tenant_id is required");
    }

    #[test]
    fn validate_write_meta_requires_idempotency_key() {
        let mut meta = valid_meta();
        meta.idempotency_key.clear();

        let error = MemoryGrpcService::validate_write_meta(&meta).unwrap_err();

        assert_eq!(error.code(), tonic::Code::InvalidArgument);
        assert_eq!(error.message(), "idempotency_key is required");
    }

    #[tokio::test]
    async fn server_can_register_and_start() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let incoming = TcpListenerStream::new(listener);

        let runtime = RuntimeState::initialize(&test_config()).await.unwrap();
        let service = MemoryGrpcService::new(test_config(), runtime);
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

        let service = MemoryGrpcService::new(config, runtime);
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
        let service = MemoryGrpcService::new(config, runtime);
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
}
