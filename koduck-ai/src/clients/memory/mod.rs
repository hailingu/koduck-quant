//! Memory service gRPC client helpers.

use std::{collections::HashMap, sync::Arc, time::Duration};

use tonic::{transport::Endpoint, Request};

use crate::{
    app::AppState,
    auth::AuthContext,
    registry::{ServiceKind, ServiceProtocol},
    reliability::{
        error::{AppError, ErrorCode, UpstreamService},
        error_mapper::{map_contract_error_detail, map_grpc_status, map_transport_error},
    },
};

pub use super::proto::{
    AppendMemoryRequest, AppendMemoryResponse, AppendPlanEventRequest,
    AppendPlanEventResponse, CreateEditProposalRequest, CreateEditProposalResponse,
    CreatePlanRequest, CreatePlanResponse, DeleteMemoryEntryRequest,
    DeleteMemoryEntryResponse, DeleteSessionRequest, DeleteSessionResponse,
    EditProposalInfo,
    GetSessionRequest, GetSessionResponse, GetSessionTranscriptRequest,
    GetSessionTranscriptResponse, MemoryEntry, MemoryHit, MemoryService,
    MemoryServiceClient, MemoryServiceServer, PlanEventInfo, PlanInfo,
    QueryIntent, QueryMemoryRequest, QueryMemoryResponse, RetrievePolicy,
    ReviewEditProposalRequest, ReviewEditProposalResponse, SessionInfo,
    SessionTranscriptEntry, UpsertSessionMetaRequest, UpsertSessionMetaResponse,
};

const API_VERSION: &str = "v1";
const CONNECT_TIMEOUT_SECS: u64 = 3;

#[derive(Debug, Clone)]
pub struct MemoryRequestContext {
    pub request_id: String,
    pub session_id: String,
    pub trace_id: String,
    pub deadline_ms: u64,
    pub user_id: String,
    pub tenant_id: String,
}

impl MemoryRequestContext {
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

#[derive(Debug, Clone)]
pub struct QueryMemoryInput {
    pub query_text: String,
    pub session_id: Option<String>,
    pub domain_class: String,
    pub query_intent: QueryIntent,
    pub retrieve_policy: RetrievePolicy,
    pub top_k: i32,
    pub page_size: i32,
}

#[derive(Debug, Clone)]
pub struct CreatePlanInput {
    pub plan_id: String,
    pub goal: String,
    pub status: String,
    pub created_by: String,
}

#[derive(Debug, Clone)]
pub struct AppendPlanEventInput {
    pub plan_id: String,
    pub event_id: String,
    pub sequence_num: i64,
    pub event_type: String,
    pub payload_json: String,
}

#[derive(Debug, Clone)]
pub struct CreateEditProposalInput {
    pub proposal_id: String,
    pub plan_id: String,
    pub node_id: String,
    pub target_kind: String,
    pub operation: String,
    pub target_ref: String,
    pub before_json: String,
    pub after_json: String,
    pub reason: String,
    pub confidence: f64,
    pub created_by: String,
}

#[derive(Debug, Clone)]
pub struct ReviewEditProposalInput {
    pub proposal_id: String,
    pub status: String,
    pub reviewed_by: String,
    pub after_json: String,
    pub applied: bool,
}

pub async fn get_session(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
) -> Result<SessionInfo, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
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
    ctx: &MemoryRequestContext,
    input: SessionUpsertInput,
) -> Result<(), AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
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

pub async fn get_session_transcript(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
) -> Result<Vec<SessionTranscriptEntry>, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .get_session_transcript(Request::new(GetSessionTranscriptRequest {
            meta: Some(ctx.request_meta(String::new())),
            session_id: ctx.session_id.clone(),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_get_session_transcript_response(ctx, response.into_inner())
}

pub async fn query_memory(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    input: QueryMemoryInput,
) -> Result<Vec<MemoryHit>, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .query_memory(Request::new(QueryMemoryRequest {
            meta: Some(ctx.request_meta(String::new())),
            query_text: input.query_text,
            session_id: input.session_id.unwrap_or_default(),
            domain_class: input.domain_class,
            top_k: input.top_k,
            retrieve_policy: input.retrieve_policy as i32,
            page_token: String::new(),
            page_size: input.page_size,
            query_intent: input.query_intent as i32,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_query_memory_response(ctx, response.into_inner())
}

pub async fn append_memory(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    entries: Vec<MemoryEntry>,
    operation_suffix: &str,
) -> Result<i32, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
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

pub async fn create_plan(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    input: CreatePlanInput,
) -> Result<PlanInfo, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .create_plan(Request::new(CreatePlanRequest {
            meta: Some(ctx.request_meta(format!("{}:create-plan", ctx.request_id))),
            session_id: ctx.session_id.clone(),
            plan_id: input.plan_id,
            goal: input.goal,
            status: input.status,
            created_by: input.created_by,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_create_plan_response(ctx, response.into_inner())
}

pub async fn append_plan_event(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    input: AppendPlanEventInput,
) -> Result<PlanEventInfo, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .append_plan_event(Request::new(AppendPlanEventRequest {
            meta: Some(ctx.request_meta(format!(
                "{}:append-plan-event:{}",
                ctx.request_id, input.sequence_num
            ))),
            session_id: ctx.session_id.clone(),
            plan_id: input.plan_id,
            event_id: input.event_id,
            sequence_num: input.sequence_num,
            event_type: input.event_type,
            payload_json: input.payload_json,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_append_plan_event_response(ctx, response.into_inner())
}

pub async fn create_edit_proposal(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    input: CreateEditProposalInput,
) -> Result<EditProposalInfo, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .create_edit_proposal(Request::new(CreateEditProposalRequest {
            meta: Some(ctx.request_meta(format!(
                "{}:create-edit-proposal:{}",
                ctx.request_id, input.proposal_id
            ))),
            session_id: ctx.session_id.clone(),
            proposal_id: input.proposal_id,
            plan_id: input.plan_id,
            node_id: input.node_id,
            target_kind: input.target_kind,
            operation: input.operation,
            target_ref: input.target_ref,
            before_json: input.before_json,
            after_json: input.after_json,
            reason: input.reason,
            confidence: input.confidence,
            created_by: input.created_by,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_create_edit_proposal_response(ctx, response.into_inner())
}

pub async fn review_edit_proposal(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    input: ReviewEditProposalInput,
) -> Result<EditProposalInfo, AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .review_edit_proposal(Request::new(ReviewEditProposalRequest {
            meta: Some(ctx.request_meta(format!(
                "{}:review-edit-proposal:{}",
                ctx.request_id, input.proposal_id
            ))),
            session_id: ctx.session_id.clone(),
            proposal_id: input.proposal_id,
            status: input.status,
            reviewed_by: input.reviewed_by,
            after_json: input.after_json,
            applied: input.applied,
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_review_edit_proposal_response(ctx, response.into_inner())
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

async fn resolve_memory_target(state: &Arc<AppState>) -> Result<String, AppError> {
    if state.service_registry.enabled() {
        let service = state
            .service_registry
            .resolve_ai_capability_service(ServiceKind::Memory)
            .await
            .ok_or_else(|| {
                AppError::new(
                    ErrorCode::DependencyFailed,
                    "memory service is not registered in capability service registry",
                )
                .with_upstream(UpstreamService::Memory)
            })?;

        if service.endpoint.protocol != ServiceProtocol::Grpc {
            return Err(
                AppError::new(
                    ErrorCode::DependencyFailed,
                    format!(
                        "memory service '{}' advertises unsupported endpoint protocol '{}'",
                        service.name, service.endpoint.protocol
                    ),
                )
                .with_upstream(UpstreamService::Memory),
            );
        }

        return Ok(service.endpoint.target);
    }

    Ok(state.config.memory.grpc_target.clone())
}

fn map_get_session_response(
    ctx: &MemoryRequestContext,
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

fn map_get_session_transcript_response(
    ctx: &MemoryRequestContext,
    response: GetSessionTranscriptResponse,
) -> Result<Vec<SessionTranscriptEntry>, AppError> {
    if response.ok {
        return Ok(response.entries);
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory get_session_transcript failed",
    ))
}

fn map_upsert_session_response(
    ctx: &MemoryRequestContext,
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

fn map_query_memory_response(
    ctx: &MemoryRequestContext,
    response: QueryMemoryResponse,
) -> Result<Vec<MemoryHit>, AppError> {
    if response.ok {
        return Ok(response.hits);
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory query_memory failed",
    ))
}

fn map_append_memory_response(
    ctx: &MemoryRequestContext,
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

fn map_create_plan_response(
    ctx: &MemoryRequestContext,
    response: CreatePlanResponse,
) -> Result<PlanInfo, AppError> {
    if response.ok {
        return response.plan.ok_or_else(|| {
            AppError::new(ErrorCode::DependencyFailed, "memory plan payload missing")
                .with_request_id(ctx.request_id.clone())
                .with_upstream(UpstreamService::Memory)
        });
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory create_plan failed",
    ))
}

fn map_append_plan_event_response(
    ctx: &MemoryRequestContext,
    response: AppendPlanEventResponse,
) -> Result<PlanEventInfo, AppError> {
    if response.ok {
        return response.event.ok_or_else(|| {
            AppError::new(ErrorCode::DependencyFailed, "memory plan event payload missing")
                .with_request_id(ctx.request_id.clone())
                .with_upstream(UpstreamService::Memory)
        });
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory append_plan_event failed",
    ))
}

fn map_create_edit_proposal_response(
    ctx: &MemoryRequestContext,
    response: CreateEditProposalResponse,
) -> Result<EditProposalInfo, AppError> {
    if response.ok {
        return response.proposal.ok_or_else(|| {
            AppError::new(ErrorCode::DependencyFailed, "memory edit proposal payload missing")
                .with_request_id(ctx.request_id.clone())
                .with_upstream(UpstreamService::Memory)
        });
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory create_edit_proposal failed",
    ))
}

fn map_review_edit_proposal_response(
    ctx: &MemoryRequestContext,
    response: ReviewEditProposalResponse,
) -> Result<EditProposalInfo, AppError> {
    if response.ok {
        return response.proposal.ok_or_else(|| {
            AppError::new(ErrorCode::DependencyFailed, "memory edit proposal payload missing")
                .with_request_id(ctx.request_id.clone())
                .with_upstream(UpstreamService::Memory)
        });
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory review_edit_proposal failed",
    ))
}

pub async fn delete_session(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
) -> Result<(), AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .delete_session(Request::new(DeleteSessionRequest {
            meta: Some(ctx.request_meta(format!("{}:delete-session", ctx.request_id))),
            session_id: ctx.session_id.clone(),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_delete_session_response(ctx, response.into_inner())
}

fn map_delete_session_response(
    ctx: &MemoryRequestContext,
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

pub async fn delete_memory_entry(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    entry_id: &str,
) -> Result<(), AppError> {
    let target = resolve_memory_target(state).await?;
    let mut client = connect_client(&target, &ctx.request_id).await?;
    let response = client
        .delete_memory_entry(Request::new(DeleteMemoryEntryRequest {
            meta: Some(ctx.request_meta(format!("{}:delete-memory-entry", ctx.request_id))),
            session_id: ctx.session_id.clone(),
            entry_id: entry_id.to_string(),
        }))
        .await
        .map_err(|status| map_grpc_status(UpstreamService::Memory, &ctx.request_id, &status))?;

    map_delete_memory_entry_response(ctx, response.into_inner())
}

fn map_delete_memory_entry_response(
    ctx: &MemoryRequestContext,
    response: DeleteMemoryEntryResponse,
) -> Result<(), AppError> {
    if response.ok {
        return Ok(());
    }

    Err(map_contract_error_detail(
        UpstreamService::Memory,
        &ctx.request_id,
        response.error.as_ref(),
        ErrorCode::DependencyFailed,
        "memory delete_memory_entry failed",
    ))
}

fn grpc_target_with_scheme(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("http://{raw}")
    }
}
