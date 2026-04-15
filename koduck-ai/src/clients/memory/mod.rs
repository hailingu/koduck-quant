//! Memory service gRPC client helpers.

use std::{collections::HashMap, sync::Arc, time::Duration};

use tonic::{transport::Endpoint, Request};

use crate::{
    app::AppState,
    auth::AuthContext,
    reliability::{
        error::{AppError, ErrorCode, UpstreamService},
        error_mapper::{map_contract_error_detail, map_grpc_status, map_transport_error},
    },
};

pub use super::proto::{
    AppendMemoryRequest, AppendMemoryResponse, DeleteSessionRequest, DeleteSessionResponse,
    GetAllSessionIdsRequest, GetSessionIdsByNerRequest,
    GetSessionIdsLookupResponse, GetSessionRequest, GetSessionResponse,
    GetSessionTranscriptRequest, GetSessionTranscriptResponse, MemoryEntry, MemoryHit,
    MemoryService, MemoryServiceClient, MemoryServiceServer, QueryIntent, RetrievePolicy,
    SessionInfo, UpsertSessionMetaRequest, UpsertSessionMetaResponse,
};

const API_VERSION: &str = "v1";
const CONNECT_TIMEOUT_SECS: u64 = 3;

#[derive(Debug, Clone)]
pub struct MemoryRpcContext {
    pub request_id: String,
    pub session_id: String,
    pub trace_id: String,
    pub deadline_ms: u64,
    pub user_id: String,
    pub tenant_id: String,
}

impl MemoryRpcContext {
    pub fn from_auth(
        request_id: impl Into<String>,
        session_id: impl Into<String>,
        trace_id: impl Into<String>,
        deadline_ms: u64,
        auth_ctx: &AuthContext,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            session_id: session_id.into(),
            trace_id: trace_id.into(),
            deadline_ms,
            user_id: auth_ctx.user_id.clone(),
            tenant_id: auth_ctx.tenant_id.clone(),
        }
    }

    fn request_meta(&self, idempotency_key: impl Into<String>) -> crate::clients::proto::RequestMeta {
        crate::clients::proto::RequestMeta {
            request_id: self.request_id.clone(),
            session_id: self.session_id.clone(),
            user_id: self.user_id.clone(),
            tenant_id: self.tenant_id.clone(),
            trace_id: self.trace_id.clone(),
            idempotency_key: idempotency_key.into(),
            deadline_ms: self.deadline_ms as i64,
            api_version: API_VERSION.to_string(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct SessionUpsertInput {
    pub title: String,
    pub status: String,
    pub extra: HashMap<String, String>,
    pub parent_session_id: String,
    pub forked_from_session_id: String,
    pub last_message_at: i64,
}

pub async fn get_session(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
) -> Result<SessionInfo, AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .get_session(Request::new(GetSessionRequest {
            meta: Some(ctx.request_meta(String::new())),
            session_id: ctx.session_id.clone(),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_get_session_response(ctx, response.into_inner())
}

pub async fn upsert_session_meta(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
    input: SessionUpsertInput,
) -> Result<(), AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .upsert_session_meta(Request::new(UpsertSessionMetaRequest {
            meta: Some(ctx.request_meta(format!("{}:upsert-session-meta", ctx.request_id))),
            session_id: ctx.session_id.clone(),
            title: input.title,
            status: input.status,
            extra: input.extra,
            parent_session_id: input.parent_session_id,
            forked_from_session_id: input.forked_from_session_id,
            last_message_at: input.last_message_at,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_upsert_session_response(ctx, response.into_inner())
}

pub async fn delete_session(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
) -> Result<(), AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .delete_session(Request::new(DeleteSessionRequest {
            meta: Some(ctx.request_meta(format!("{}:delete-session", ctx.request_id))),
            session_id: ctx.session_id.clone(),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_delete_session_response(ctx, response.into_inner())
}

pub async fn get_all_session_ids(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
) -> Result<Vec<String>, AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .get_all_session_ids(Request::new(GetAllSessionIdsRequest {
            meta: Some(ctx.request_meta(String::new())),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_session_ids_lookup_response(ctx, response.into_inner(), "memory get_all_session_ids failed")
}

pub async fn get_session_ids_by_ner(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
    ner: String,
) -> Result<Vec<String>, AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .get_session_ids_by_ner(Request::new(GetSessionIdsByNerRequest {
            meta: Some(ctx.request_meta(String::new())),
            ner,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_session_ids_lookup_response(ctx, response.into_inner(), "memory get_session_ids_by_ner failed")
}

pub async fn get_session_transcript(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
    session_id: String,
) -> Result<String, AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .get_session_transcript(Request::new(GetSessionTranscriptRequest {
            meta: Some(ctx.request_meta(String::new())),
            session_id,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_session_transcript_response(ctx, response.into_inner())
}

pub async fn append_memory(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
    entries: Vec<MemoryEntry>,
    operation_suffix: &str,
) -> Result<i32, AppError> {
    let mut client = connect_client(&state.config.memory.grpc_target, &ctx.request_id).await?;
    let response = client
        .append_memory(Request::new(AppendMemoryRequest {
            meta: Some(ctx.request_meta(format!(
                "{}:{}",
                ctx.request_id, operation_suffix
            ))),
            session_id: ctx.session_id.clone(),
            entries,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_append_memory_response(ctx, response.into_inner())
}

async fn connect_client(
    raw_target: &str,
    request_id: &str,
) -> Result<MemoryServiceClient<tonic::transport::Channel>, AppError> {
    let target = grpc_target_with_scheme(raw_target);
    let endpoint = Endpoint::from_shared(target.clone())
        .map_err(|err| {
            map_transport_error(
                UpstreamService::Memory,
                request_id,
                "invalid memory grpc target",
                err,
            )
        })?
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .tcp_nodelay(true);

    let channel = endpoint.connect().await.map_err(|err| {
        map_transport_error(
            UpstreamService::Memory,
            request_id,
            "failed to connect memory grpc target",
            err,
        )
    })?;

    Ok(MemoryServiceClient::new(channel))
}

fn map_get_session_response(
    ctx: &MemoryRpcContext,
    response: GetSessionResponse,
) -> Result<SessionInfo, AppError> {
    if response.ok {
        return response.session.ok_or_else(|| {
            AppError::new(ErrorCode::DependencyFailed, "memory session payload missing")
                .with_request_id(ctx.request_id.clone())
                .with_upstream(UpstreamService::Memory)
        });
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory get_session failed",
    ))
}

fn map_upsert_session_response(
    ctx: &MemoryRpcContext,
    response: UpsertSessionMetaResponse,
) -> Result<(), AppError> {
    if response.ok {
        return Ok(());
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory upsert_session_meta failed",
    ))
}

fn map_delete_session_response(
    ctx: &MemoryRpcContext,
    response: DeleteSessionResponse,
) -> Result<(), AppError> {
    if response.ok {
        return Ok(());
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory delete_session failed",
    ))
}

fn map_session_ids_lookup_response(
    ctx: &MemoryRpcContext,
    response: GetSessionIdsLookupResponse,
    default_message: &'static str,
) -> Result<Vec<String>, AppError> {
    if response.ok {
        return Ok(response.session_ids);
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        default_message,
    ))
}

fn map_session_transcript_response(
    ctx: &MemoryRpcContext,
    response: GetSessionTranscriptResponse,
) -> Result<String, AppError> {
    if response.ok {
        return Ok(response.transcript_text);
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory get_session_transcript failed",
    ))
}

fn map_append_memory_response(
    ctx: &MemoryRpcContext,
    response: AppendMemoryResponse,
) -> Result<i32, AppError> {
    if response.ok {
        return Ok(response.appended_count);
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory append_memory failed",
    ))
}

fn grpc_target_with_scheme(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("http://{raw}")
    }
}
