use std::collections::HashMap;

use tonic::{Request, Response, Status};

use crate::api::{
    AppendMemoryRequest, AppendMemoryResponse, Capability, ErrorDetail, GetSessionRequest,
    GetSessionResponse, MemoryService, QueryMemoryRequest, QueryMemoryResponse, RequestMeta,
    SummarizeMemoryRequest, SummarizeMemoryResponse, UpsertSessionMetaRequest,
    UpsertSessionMetaResponse,
};
use crate::config::AppConfig;

#[derive(Clone)]
pub struct MemoryGrpcService {
    config: AppConfig,
}

impl MemoryGrpcService {
    pub fn from_config(config: &AppConfig) -> Self {
        Self {
            config: config.clone(),
        }
    }

    fn capability_response(&self) -> Capability {
        let mut features = HashMap::new();
        features.insert("session_truth".to_string(), "planned".to_string());
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
        limits.insert("max_batch_entries".to_string(), "planned".to_string());
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
            message: format!("{method} is not implemented in Task 1.1 skeleton"),
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
        Self::validate_write_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
            Status::invalid_argument("meta is required")
        })?)?;
        Ok(Response::new(UpsertSessionMetaResponse {
            ok: false,
            error: Self::not_implemented_error("UpsertSessionMeta"),
        }))
    }

    async fn get_session(
        &self,
        request: Request<GetSessionRequest>,
    ) -> Result<Response<GetSessionResponse>, Status> {
        Self::validate_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
            Status::invalid_argument("meta is required")
        })?)?;
        Ok(Response::new(GetSessionResponse {
            ok: false,
            session: None,
            error: Self::not_implemented_error("GetSession"),
        }))
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
    use crate::api::{MemoryServiceClient, MemoryServiceServer, RequestMeta};
    use crate::config::{
        AppConfig, AppSection, CapabilitiesSection, IndexSection, ObjectStoreSection,
        PostgresSection, ServerSection, SummarySection,
    };
    use tokio::net::TcpListener;
    use tokio_stream::wrappers::TcpListenerStream;
    use tonic::transport::{Channel, Server};

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
    async fn empty_server_can_register_and_start() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let incoming = TcpListenerStream::new(listener);
        let service = MemoryGrpcService::from_config(&test_config());
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
        assert_eq!(
            response.features.get("retrieve_policy.default"),
            Some(&"domain-first".to_string())
        );

        let _ = shutdown_tx.send(());
        server.await.unwrap();
    }
}
