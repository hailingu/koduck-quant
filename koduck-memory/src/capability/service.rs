use std::collections::HashMap;

use tonic::{Request, Response, Status};

use crate::api::proto::contract::{Capability, ErrorDetail, RequestMeta};
use crate::api::proto::memory::{
    memory_service_server::MemoryService, AppendMemoryRequest, AppendMemoryResponse,
    GetSessionRequest, GetSessionResponse, QueryMemoryRequest, QueryMemoryResponse,
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
        features.insert("retrieve_policy.default".to_string(), "domain_first".to_string());

        let mut limits = HashMap::new();
        limits.insert("max_batch_entries".to_string(), "planned".to_string());
        limits.insert("summary_async".to_string(), "false".to_string());

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
        if meta.trace_id.trim().is_empty() {
            return Err(Status::invalid_argument("trace_id is required"));
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
        Self::validate_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
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
        Self::validate_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
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
        Self::validate_meta(request.get_ref().meta.as_ref().ok_or_else(|| {
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
