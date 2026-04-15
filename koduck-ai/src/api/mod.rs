//! North-facing API handlers (chat/stream).

use std::{collections::HashMap, convert::Infallible, sync::Arc, time::Duration};

use axum::{
    extract::{Json, Path, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
};
use chrono::Utc;
use futures::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::memory::{
        self, MemoryEntry, MemoryHit, MemoryRpcContext, QueryIntent, SessionInfo,
        SessionUpsertInput,
    },
    config::LlmMode,
    llm::{
        ChatMessage as ProviderChatMessage, GenerateRequest as ProviderGenerateRequest,
        RequestContext, StreamEvent as ProviderStreamEvent, ToolCall as ProviderToolCall,
        ToolDefinition as ProviderToolDefinition,
    },
    orchestrator::cancel::{run_abortable_with_cleanup, AbortReason, RequestGenerationGuard},
    reliability::{
        degrade::{DegradeDecision, DegradeRoute},
        error::{AppError, ErrorCode, UpstreamService},
        memory_observe::MemoryOperation,
        retry_budget::RetryDirective,
    },
    stream::sse::{PendingStreamEvent, ResumeCursor, StreamEventData},
};

const MAX_ALLOWED_TOKENS: u32 = 32_768;
const MEMORY_QUERY_TOP_K: i32 = 5;
const MAX_HISTORY_MESSAGES: usize = 20;
const MEMORY_SESSION_BATCH_SIZE: usize = 2;
const ACTIVE_MEMORY_CONTEXT_KEY: &str = "active_memory_context";
const ACTIVE_MEMORY_CONTEXT_KIND_KEY: &str = "active_memory_context_kind";

#[derive(Debug, Clone, Deserialize)]
pub struct ChatHistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatRequest {
    pub session_id: Option<String>,
    pub message: String,
    #[serde(default)]
    pub history: Option<Vec<ChatHistoryMessage>>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    #[allow(dead_code)]
    pub retrieve_policy: Option<String>,
    #[allow(dead_code)]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatStreamRequest {
    #[serde(flatten)]
    pub chat: ChatRequest,
    #[allow(dead_code)]
    pub from_sequence_num: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub request_id: String,
    pub session_id: String,
    pub answer: String,
    pub model: String,
    pub usage: TokenUsage,
    pub degraded: bool,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<crate::reliability::error::ErrorResponse>,
}

#[derive(Debug, Serialize)]
pub struct SessionLookupResponse {
    pub exists: bool,
}

#[derive(Debug, Serialize)]
pub struct DebugPathResponse {
    pub value: String,
}

#[derive(Debug, Clone, Default)]
struct MemoryContextSnapshot {
    session: Option<SessionInfo>,
    hits: Vec<MemoryHit>,
    active_retrieval_context: Option<String>,
}

#[derive(Debug, Default)]
struct ToolResolutionResult {
    snapshot: MemoryContextSnapshot,
    direct_response: Option<crate::llm::GenerateResponse>,
}

enum StreamLlmPlan {
    Upstream(crate::llm::ProviderEventStream),
    ReadyAnswer(String),
}

#[derive(Debug, Deserialize, Default)]
struct QueryMemoryToolArgs {
    query: Option<String>,
    intent: Option<String>,
    #[serde(default)]
    ner: Vec<QueryMemoryToolNer>,
    memory_scope: Option<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct QueryMemoryToolNer {
    text: Option<String>,
    #[serde(rename = "type")]
    entity_type: Option<String>,
}

impl MemoryContextSnapshot {
    fn has_active_retrieval_context(&self) -> bool {
        self.active_retrieval_context
            .as_ref()
            .is_some_and(|value| !value.trim().is_empty())
    }
}

pub async fn chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    state.degrade_policy.record_request(DegradeRoute::Chat);
    if !state.lifecycle.is_accepting_requests() {
        return api_error_response(
            AppError::new(ErrorCode::ServerBusy, "service is draining new requests")
                .with_request_id(request_id.clone()),
            request_id,
        );
    }
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    if let Err(err) = validate_chat_request(&request) {
        return api_error_response(err, extract_or_create_request_id(&headers));
    }

    let session_id = resolve_session_id(request.session_id.clone());
    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRpcContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id.clone(),
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    info!(
        request_id = %request_id,
        session_id = %session_id,
        trace_id = %trace_id,
        tenant_id = %auth_ctx.tenant_id,
        "chat request received"
    );

    let memory_snapshot =
        prepare_memory_context(&state, DegradeRoute::Chat, &request, &memory_ctx).await;

    let response = if state.config.llm.stub_enabled {
        build_stub_chat_response(
            &state,
            &request_id,
            &session_id,
            &request.message,
            request.model.clone(),
            "stub_enabled",
        )
    } else {
        match call_llm_generate(
            &state,
            &request,
            &memory_snapshot,
            &request_id,
            &session_id,
            &auth_ctx,
            &trace_id,
        )
        .await
        {
            Ok(ok) => ok,
            Err(err) => return api_error_response(err, request_id),
        }
    };

    if let Err(err) = append_chat_turn(
        &state,
        &memory_ctx,
        &request,
        &response.answer,
        response.model.as_str(),
        memory_snapshot.has_active_retrieval_context(),
    )
    .await
    {
        log_memory_failure(
            &state,
            DegradeRoute::Chat,
            MemoryOperation::AppendMemory,
            &memory_ctx,
            &err,
            true,
            "append_memory failed after chat response; continuing with successful answer",
        );
    }

    let mut res_headers = HeaderMap::new();
    if let Ok(v) = HeaderValue::from_str(&request_id) {
        res_headers.insert("X-Request-Id", v);
    }

    (
        res_headers,
        Json(ApiResponse {
            success: true,
            code: "OK".to_string(),
            message: "success".to_string(),
            data: Some(response),
            error: None,
        }),
    )
        .into_response()
}

pub async fn session_exists(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(raw_session_id): Path<String>,
) -> Response {
    session_exists_impl(state, headers, raw_session_id).await
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(raw_session_id): Path<String>,
) -> Response {
    delete_session_impl(state, headers, raw_session_id).await
}

async fn session_exists_impl(
    state: Arc<AppState>,
    headers: HeaderMap,
    raw_session_id: String,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    info!(
        request_id = %request_id,
        raw_session_id = %raw_session_id,
        "session lookup request received"
    );
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => {
            warn!(
                request_id = %request_id,
                error_code = ?err.code,
                "session lookup authentication failed"
            );
            return api_error_response(err.with_request_id(request_id.clone()), request_id);
        }
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        warn!(
            request_id = %request_id,
            raw_session_id = %raw_session_id,
            "session lookup rejected invalid session id"
        );
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRpcContext::from_auth(
        request_id.clone(),
        session_id,
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    let exists = match memory::get_session(&state, &memory_ctx).await {
        Ok(_) => true,
        Err(err) if err.code == ErrorCode::ResourceNotFound => false,
        Err(err) => {
            warn!(
                request_id = %request_id,
                session_id = %memory_ctx.session_id,
                error_code = ?err.code,
                "session lookup failed during memory get_session"
            );
            return api_error_response(err, request_id);
        }
    };

    info!(
        request_id = %request_id,
        session_id = %memory_ctx.session_id,
        tenant_id = %auth_ctx.tenant_id,
        exists,
        "session lookup completed"
    );

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "session lookup completed".to_string(),
            data: Some(SessionLookupResponse { exists }),
            error: None,
        }),
    )
        .into_response()
}

async fn delete_session_impl(
    state: Arc<AppState>,
    headers: HeaderMap,
    raw_session_id: String,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    info!(
        request_id = %request_id,
        raw_session_id = %raw_session_id,
        "session delete request received"
    );
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => {
            warn!(
                request_id = %request_id,
                error_code = ?err.code,
                "session delete authentication failed"
            );
            return api_error_response(err.with_request_id(request_id.clone()), request_id);
        }
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        warn!(
            request_id = %request_id,
            raw_session_id = %raw_session_id,
            "session delete rejected invalid session id"
        );
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRpcContext::from_auth(
        request_id.clone(),
        session_id,
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    if let Err(err) = memory::delete_session(&state, &memory_ctx).await {
        warn!(
            request_id = %request_id,
            session_id = %memory_ctx.session_id,
            error_code = ?err.code,
            "session delete failed"
        );
        return api_error_response(err, request_id);
    }

    info!(
        request_id = %request_id,
        session_id = %memory_ctx.session_id,
        tenant_id = %auth_ctx.tenant_id,
        "session delete completed"
    );

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "session deleted".to_string(),
            data: None,
            error: None,
        }),
    )
        .into_response()
}

pub async fn debug_path_echo(Path(value): Path<String>) -> Response {
    debug_path_echo_impl(value).await
}

async fn debug_path_echo_impl(value: String) -> Response {
    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "debug path matched".to_string(),
            data: Some(DebugPathResponse { value }),
            error: None,
        }),
    )
        .into_response()
}

pub async fn http_fallback(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    request: Request,
) -> Response {
    let path = request.uri().path().to_string();

    if let Some(raw_session_id) = path.strip_prefix("/api/v1/ai/sessions/") {
        info!(
            path = %path,
            "http fallback rerouting unmatched session lookup path"
        );
        return session_exists_impl(state, headers, raw_session_id.to_string()).await;
    }

    if let Some(value) = path.strip_prefix("/api/v1/ai/debug/") {
        info!(
            path = %path,
            "http fallback rerouting unmatched debug path"
        );
        return debug_path_echo_impl(value.to_string()).await;
    }

    StatusCode::NOT_FOUND.into_response()
}

pub async fn chat_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ChatStreamRequest>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    state
        .degrade_policy
        .record_request(DegradeRoute::ChatStream);
    if !state.lifecycle.is_accepting_requests() {
        return api_error_response(
            AppError::new(ErrorCode::ServerBusy, "service is draining new requests")
                .with_request_id(request_id.clone()),
            request_id,
        );
    }
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    if let Err(err) = validate_chat_request(&request.chat) {
        return api_error_response(err, extract_or_create_request_id(&headers));
    }

    let session_id = resolve_session_id(request.chat.session_id.clone());
    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRpcContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id.clone(),
        state.config.llm.timeout_ms,
        &auth_ctx,
    );
    let resume_cursor = ResumeCursor {
        last_event_id: headers
            .get("last-event-id")
            .and_then(|value| value.to_str().ok())
            .map(ToOwned::to_owned),
        from_sequence_num: request.from_sequence_num,
    };

    info!(
        request_id = %request_id,
        session_id = %session_id,
        trace_id = %trace_id,
        tenant_id = %auth_ctx.tenant_id,
        last_event_id = ?resume_cursor.last_event_id,
        from_sequence_num = ?resume_cursor.from_sequence_num,
        "stream request received"
    );

    let memory_snapshot = if resume_cursor.is_resume() {
        None
    } else {
        Some(
            prepare_memory_context(&state, DegradeRoute::ChatStream, &request.chat, &memory_ctx)
                .await,
        )
    };

    let session = if resume_cursor.is_resume() {
        match state.stream_registry.get(&session_id).await {
            Some(existing) => existing,
            None => {
                return api_error_response(
                    AppError::new(
                        ErrorCode::StreamInterrupted,
                        "resume target not found for session",
                    )
                    .with_request_id(request_id.clone()),
                    request_id,
                );
            }
        }
    } else {
        state
            .stream_registry
            .create_or_replace(
                session_id.clone(),
                request_id.clone(),
                state.config.stream.queue_capacity,
                Duration::from_millis(state.config.stream.enqueue_timeout_ms),
                state.lifecycle.clone(),
            )
            .await
    };

    if !resume_cursor.is_resume() {
        let generation_guard = session.request_guard().await;
        let stream_timeout = Duration::from_millis(state.config.stream.max_duration_ms);
        if state.config.llm.stub_enabled {
            if let Err(err) = append_chat_turn(
                &state,
                &memory_ctx,
                &request.chat,
                &build_stub_answer(&request.chat.message, "stub_enabled"),
                request
                    .chat
                    .model
                    .as_deref()
                    .unwrap_or(&state.config.llm.default_provider),
                memory_snapshot
                    .as_ref()
                    .is_some_and(MemoryContextSnapshot::has_active_retrieval_context),
            )
            .await
            {
                log_memory_failure(
                    &state,
                    DegradeRoute::ChatStream,
                    MemoryOperation::AppendMemory,
                    &memory_ctx,
                    &err,
                    true,
                    "append_memory failed before stub stream; continuing with degraded stream",
                );
            }
            spawn_stub_stream(
                Arc::clone(&session),
                generation_guard.clone(),
                stream_timeout,
                build_stream_chunks(&request.chat.message, "stub_enabled"),
                "stub_enabled",
            );
        } else if state.config.llm.mode == LlmMode::Direct {
            let llm_plan = match call_llm_stream(
                &state,
                &request.chat,
                memory_snapshot.as_ref().expect("memory snapshot present for new stream"),
                &request_id,
                &session_id,
                &auth_ctx,
                &trace_id,
            )
            .await
            {
                Ok(plan) => plan,
                Err(err) => return api_error_response(err, request_id),
            };
            match llm_plan {
                StreamLlmPlan::ReadyAnswer(answer) => {
                    if let Err(err) = append_chat_turn(
                        &state,
                        &memory_ctx,
                        &request.chat,
                        &answer,
                        request.chat.model.as_deref().unwrap_or_default(),
                        memory_snapshot
                            .as_ref()
                            .is_some_and(MemoryContextSnapshot::has_active_retrieval_context),
                    )
                    .await
                    {
                        log_memory_failure(
                            &state,
                            DegradeRoute::ChatStream,
                            MemoryOperation::AppendMemory,
                            &memory_ctx,
                            &err,
                            true,
                            "append_memory failed after direct tool-free response; continuing with generated stream",
                        );
                    }
                    spawn_generated_stream(
                        Arc::clone(&session),
                        generation_guard.clone(),
                        stream_timeout,
                        chunk_answer(&answer),
                    );
                }
                StreamLlmPlan::Upstream(upstream) => {
                    let stream_session = Arc::clone(&session);
                    let guard = generation_guard.clone();
                    let append_state = Arc::clone(&state);
                    let append_ctx = memory_ctx.clone();
                    let append_request = request.chat.clone();
                    let append_session_has_active_retrieval_context = memory_snapshot
                        .as_ref()
                        .is_some_and(MemoryContextSnapshot::has_active_retrieval_context);
                    tokio::spawn(async move {
                        let producer_guard = guard.clone();
                        let producer = async {
                            let mut upstream = upstream;
                            let mut full_answer = String::new();
                            while let Some(next) = upstream.next().await {
                                match next {
                                    Ok(ev) => {
                                        full_answer.push_str(&ev.delta);
                                        info!(
                                            request_id = %stream_session.request_id(),
                                            session_id = %stream_session.session_id(),
                                            upstream_event_id = %ev.event_id,
                                            upstream_sequence_num = ev.sequence_num,
                                            delta_len = ev.delta.len(),
                                            finish_reason = %ev.finish_reason,
                                            "forwarding llm stream event to sse session"
                                        );
                                        for pending in build_stream_events(
                                            &ev,
                                            stream_session.request_id(),
                                            stream_session.session_id(),
                                        ) {
                                            if let Err(err) = stream_session
                                                .enqueue_event_if_current(&producer_guard, pending)
                                                .await
                                            {
                                                info!(
                                                    request_id = %stream_session.request_id(),
                                                    session_id = %stream_session.session_id(),
                                                    error = %err,
                                                    generation = producer_guard.generation(),
                                                    "stream queue rejected upstream event"
                                                );
                                                stream_session
                                                    .force_shutdown_if_current(
                                                        &producer_guard,
                                                        ErrorCode::StreamTimeout.to_string(),
                                                        "stream queue backpressure timeout",
                                                    )
                                                    .await;
                                                return;
                                            }
                                        }
                                        info!(
                                            request_id = %stream_session.request_id(),
                                            session_id = %stream_session.session_id(),
                                            upstream_event_id = %ev.event_id,
                                            "llm stream event enqueued"
                                        );
                                    }
                                    Err(err) => {
                                        info!(
                                            request_id = %stream_session.request_id(),
                                            session_id = %stream_session.session_id(),
                                            error = %err,
                                            generation = producer_guard.generation(),
                                            "llm stream item failed"
                                        );
                                        let _ = stream_session
                                            .enqueue_event_if_current(
                                                &producer_guard,
                                                build_stream_error_event(
                                                    &err,
                                                    stream_session.request_id(),
                                                    stream_session.session_id(),
                                                ),
                                            )
                                            .await;
                                        break;
                                    }
                                }
                            }

                            let replay = stream_session.open_replay(0).await;
                            let has_terminal_event = replay
                                .replay_events
                                .iter()
                                .any(|event| matches!(event.event_type.as_str(), "done" | "error"));

                            if !has_terminal_event {
                                let _ = stream_session
                                    .enqueue_event_if_current(
                                        &producer_guard,
                                        StreamEventData::done(
                                            stream_session.request_id().to_string(),
                                            stream_session.session_id().to_string(),
                                            "stop",
                                        ),
                                    )
                                    .await;
                            }

                            if let Err(err) = append_chat_turn(
                                &append_state,
                                &append_ctx,
                                &append_request,
                                &full_answer,
                                append_request.model.as_deref().unwrap_or_default(),
                                append_session_has_active_retrieval_context,
                            )
                            .await
                            {
                                log_memory_failure(
                                    &append_state,
                                    DegradeRoute::ChatStream,
                                    MemoryOperation::AppendMemory,
                                    &append_ctx,
                                    &err,
                                    true,
                                    "failed to persist streamed conversation into memory",
                                );
                            }
                        };

                        let cleanup_session = Arc::clone(&stream_session);
                        let cleanup_guard = guard.clone();
                        let cleanup_guard_for_log = cleanup_guard.clone();
                        let result = run_abortable_with_cleanup(
                            guard,
                            stream_timeout,
                            producer,
                            move |reason| async move {
                                handle_stream_abort(&cleanup_session, &cleanup_guard, reason).await;
                            },
                        )
                        .await;

                        if let Err(reason) = result {
                            info!(
                                request_id = %stream_session.request_id(),
                                session_id = %stream_session.session_id(),
                                generation = cleanup_guard_for_log.generation(),
                                abort_reason = ?reason,
                                "upstream stream producer terminated early"
                            );
                        }
                    });
                }
            }
        } else {
            let llm_plan =
                match call_llm_stream(
                    &state,
                    &request.chat,
                    memory_snapshot.as_ref().expect("memory snapshot present for new stream"),
                    &request_id,
                    &session_id,
                    &auth_ctx,
                    &trace_id,
                )
                .await
                {
                    Ok(plan) => plan,
                    Err(err) => return api_error_response(err, request_id),
                };
            match llm_plan {
                StreamLlmPlan::ReadyAnswer(answer) => {
                    if let Err(err) = append_chat_turn(
                        &state,
                        &memory_ctx,
                        &request.chat,
                        &answer,
                        request.chat.model.as_deref().unwrap_or_default(),
                        memory_snapshot
                            .as_ref()
                            .is_some_and(MemoryContextSnapshot::has_active_retrieval_context),
                    )
                    .await
                    {
                        log_memory_failure(
                            &state,
                            DegradeRoute::ChatStream,
                            MemoryOperation::AppendMemory,
                            &memory_ctx,
                            &err,
                            true,
                            "append_memory failed after direct tool-free response; continuing with generated stream",
                        );
                    }
                    spawn_generated_stream(
                        Arc::clone(&session),
                        generation_guard.clone(),
                        stream_timeout,
                        chunk_answer(&answer),
                    );
                }
                StreamLlmPlan::Upstream(upstream) => {
                    let stream_session = Arc::clone(&session);
                    let guard = generation_guard.clone();
                    let append_state = Arc::clone(&state);
                    let append_ctx = memory_ctx.clone();
                    let append_request = request.chat.clone();
                    let append_session_has_active_retrieval_context = memory_snapshot
                        .as_ref()
                        .is_some_and(MemoryContextSnapshot::has_active_retrieval_context);
                    tokio::spawn(async move {
                        let producer_guard = guard.clone();
                        let producer = async {
                            let mut upstream = upstream;
                            let mut full_answer = String::new();
                            while let Some(next) = upstream.next().await {
                                match next {
                                    Ok(ev) => {
                                        full_answer.push_str(&ev.delta);
                                        for pending in build_stream_events(
                                            &ev,
                                            stream_session.request_id(),
                                            stream_session.session_id(),
                                        ) {
                                            if let Err(err) = stream_session
                                                .enqueue_event_if_current(&producer_guard, pending)
                                                .await
                                            {
                                                info!(
                                                    request_id = %stream_session.request_id(),
                                                    session_id = %stream_session.session_id(),
                                                    error = %err,
                                                    generation = producer_guard.generation(),
                                                    "stream queue rejected upstream event"
                                                );
                                                stream_session
                                                    .force_shutdown_if_current(
                                                        &producer_guard,
                                                        ErrorCode::StreamTimeout.to_string(),
                                                        "stream queue backpressure timeout",
                                                    )
                                                    .await;
                                                break;
                                            }
                                        }
                                    }
                                    Err(mapped_error) => {
                                        info!(
                                            request_id = %stream_session.request_id(),
                                            session_id = %stream_session.session_id(),
                                            error = %mapped_error,
                                            generation = producer_guard.generation(),
                                            "llm stream item failed"
                                        );
                                        let _ = stream_session
                                            .enqueue_event_if_current(
                                                &producer_guard,
                                                build_stream_error_event(
                                                    &mapped_error,
                                                    stream_session.request_id(),
                                                    stream_session.session_id(),
                                                ),
                                            )
                                            .await;
                                        break;
                                    }
                                }
                            }

                            let replay = stream_session.open_replay(0).await;
                            let has_terminal_event = replay
                                .replay_events
                                .iter()
                                .any(|event| matches!(event.event_type.as_str(), "done" | "error"));

                            if !has_terminal_event {
                                let _ = stream_session
                                    .enqueue_event_if_current(
                                        &producer_guard,
                                        StreamEventData::done(
                                            stream_session.request_id().to_string(),
                                            stream_session.session_id().to_string(),
                                            "stop",
                                        ),
                                    )
                                    .await;
                            }

                            if let Err(err) = append_chat_turn(
                                &append_state,
                                &append_ctx,
                                &append_request,
                                &full_answer,
                                append_request.model.as_deref().unwrap_or_default(),
                                append_session_has_active_retrieval_context,
                            )
                            .await
                            {
                                log_memory_failure(
                                    &append_state,
                                    DegradeRoute::ChatStream,
                                    MemoryOperation::AppendMemory,
                                    &append_ctx,
                                    &err,
                                    true,
                                    "failed to persist streamed conversation into memory",
                                );
                            }
                        };

                        let cleanup_session = Arc::clone(&stream_session);
                        let cleanup_guard = guard.clone();
                        let cleanup_guard_for_log = cleanup_guard.clone();
                        let result = run_abortable_with_cleanup(
                            guard,
                            stream_timeout,
                            producer,
                            move |reason| async move {
                                handle_stream_abort(&cleanup_session, &cleanup_guard, reason).await;
                            },
                        )
                        .await;

                        if let Err(reason) = result {
                            info!(
                                request_id = %stream_session.request_id(),
                                session_id = %stream_session.session_id(),
                                generation = cleanup_guard_for_log.generation(),
                                abort_reason = ?reason,
                                "upstream stream producer terminated early"
                            );
                        }
                    });
                }
            }
        }
    }

    let high_watermark = resume_cursor.high_watermark(Some(&session));
    stream_sse_response_with_watermark(session, request_id, high_watermark).await
}

async fn stream_sse_response(
    session: Arc<crate::stream::sse::StreamSession>,
    request_id: String,
) -> Response {
    stream_sse_response_with_watermark(session, request_id, 0).await
}

async fn stream_sse_response_with_watermark(
    session: Arc<crate::stream::sse::StreamSession>,
    request_id: String,
    high_watermark: u32,
) -> Response {
    let replay = session.open_replay(high_watermark).await;
    let replay_high_watermark = replay
        .replay_events
        .last()
        .map(|event| event.sequence_num)
        .unwrap_or(high_watermark);
    let replay_stream = stream::iter(
        replay
            .replay_events
            .into_iter()
            .map(|event| Ok::<Event, Infallible>(event.to_sse_event())),
    );
    let live_stream = if replay.completed {
        stream::empty().boxed()
    } else {
        session
            .live_stream(replay.receiver, replay_high_watermark)
            .map(|event| Ok::<Event, Infallible>(event.to_sse_event()))
            .boxed()
    };
    let combined = replay_stream.chain(live_stream).boxed();

    let mut headers = HeaderMap::new();
    if let Ok(v) = HeaderValue::from_str(&request_id) {
        headers.insert("X-Request-Id", v);
    }

    (
        StatusCode::OK,
        headers,
        Sse::new(combined).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(10))
                .text("heartbeat"),
        ),
    )
        .into_response()
}

async fn prepare_memory_context(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRpcContext,
) -> MemoryContextSnapshot {
    let session = match memory::get_session(state, ctx).await {
        Ok(session) => Some(session),
        Err(err) if err.code == ErrorCode::ResourceNotFound => None,
        Err(err) => {
            log_memory_failure(
                state,
                route,
                MemoryOperation::GetSession,
                ctx,
                &err,
                true,
                "get_session failed; continuing with empty session snapshot",
            );
            None
        }
    };

    let mut merged_extra = session_extra_map(session.as_ref());
    merged_extra.extend(request_metadata_extra(request));

    if let Err(err) = memory::upsert_session_meta(
        state,
        ctx,
        SessionUpsertInput {
            title: metadata_string(request, "title"),
            status: metadata_string(request, "status"),
            extra: merged_extra.clone(),
            parent_session_id: metadata_string(request, "parent_session_id"),
            forked_from_session_id: metadata_string(request, "forked_from_session_id"),
            last_message_at: Utc::now().timestamp_millis(),
        },
    )
    .await
    {
        log_memory_failure(
            state,
            route,
            MemoryOperation::UpsertSessionMeta,
            ctx,
            &err,
            true,
            "upsert_session_meta failed; continuing with request-local session context",
        );
    }

    let active_retrieval_context = active_retrieval_context_from_session(session.as_ref());
    MemoryContextSnapshot {
        session,
        hits: Vec::new(),
        active_retrieval_context,
    }
}

async fn append_chat_turn(
    state: &Arc<AppState>,
    ctx: &MemoryRpcContext,
    request: &ChatRequest,
    answer: &str,
    model: &str,
    session_has_active_retrieval_context: bool,
) -> Result<(), AppError> {
    let now = Utc::now().timestamp_millis();
    let user_entry = MemoryEntry {
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: now,
        metadata: build_memory_entry_metadata(
            request,
            ctx,
            None,
            session_has_active_retrieval_context,
        ),
    };
    let mut entries = vec![user_entry];

    if !answer.trim().is_empty() {
        entries.push(MemoryEntry {
            role: "assistant".to_string(),
            content: answer.to_string(),
            timestamp: now,
            metadata: build_memory_entry_metadata(
                request,
                ctx,
                Some(model),
                session_has_active_retrieval_context,
            ),
        });
    }

    let _ = memory::append_memory(state, ctx, entries, "append-turn").await?;

    Ok(())
}

fn log_memory_failure(
    state: &Arc<AppState>,
    route: DegradeRoute,
    operation: MemoryOperation,
    ctx: &MemoryRpcContext,
    err: &AppError,
    fallback_applied: bool,
    message: &'static str,
) {
    state
        .memory_observe_policy
        .record_failure(route, operation, err.code, fallback_applied);

    warn!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tenant_id = %ctx.tenant_id,
        trace_id = %ctx.trace_id,
        memory.route = %route,
        memory.operation = %operation,
        memory.code = %err.code,
        memory.retryable = err.retryable,
        memory.fallback_applied = fallback_applied,
        error = %err,
        "{message}"
    );
}

fn validate_chat_request(request: &ChatRequest) -> Result<(), AppError> {
    if request.message.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidArgument,
            "message cannot be empty",
        ));
    }

    if let Some(t) = request.max_tokens {
        if t == 0 {
            return Err(AppError::new(
                ErrorCode::InvalidArgument,
                "max_tokens must be greater than 0",
            ));
        }
        if t > MAX_ALLOWED_TOKENS {
            return Err(AppError::new(
                ErrorCode::TokenBudgetExceeded,
                format!("max_tokens exceeds allowed upper bound {}", MAX_ALLOWED_TOKENS),
            ));
        }
    }

    if let Some(temp) = request.temperature {
        if !(0.0..=2.0).contains(&temp) {
            return Err(AppError::new(
                ErrorCode::InvalidArgument,
                "temperature must be in [0, 2]",
            ));
        }
    }

    if let Some(history) = request.history.as_ref() {
        if history.len() > MAX_HISTORY_MESSAGES {
            return Err(AppError::new(
                ErrorCode::InvalidArgument,
                format!(
                    "history exceeds allowed upper bound {}",
                    MAX_HISTORY_MESSAGES
                ),
            ));
        }

        for item in history {
            let role = item.role.trim();
            if !matches!(role, "user" | "assistant") {
                return Err(AppError::new(
                    ErrorCode::InvalidArgument,
                    format!("history role must be user or assistant, got {role}"),
                ));
            }

            if item.content.trim().is_empty() {
                return Err(AppError::new(
                    ErrorCode::InvalidArgument,
                    "history content cannot be empty",
                ));
            }
        }
    }

    Ok(())
}

fn metadata_string(request: &ChatRequest, key: &str) -> String {
    request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get(key))
        .and_then(json_value_as_string)
        .unwrap_or_default()
}

fn request_metadata_extra(request: &ChatRequest) -> HashMap<String, String> {
    const RESERVED_KEYS: &[&str] = &[
        "title",
        "status",
        "parent_session_id",
        "forked_from_session_id",
        "domain_class",
        "retrieve_policy",
    ];

    request
        .metadata
        .as_ref()
        .map(|metadata| {
            metadata
                .iter()
                .filter(|(key, _)| !RESERVED_KEYS.contains(&key.as_str()))
                .map(|(key, value)| {
                    (
                        key.clone(),
                        json_value_as_string(value).unwrap_or_else(|| value.to_string()),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

fn json_value_as_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        serde_json::Value::Null => None,
        _ => Some(value.to_string()),
    }
}

fn session_extra_map(session: Option<&SessionInfo>) -> HashMap<String, String> {
    session
        .map(|session| session.extra.clone())
        .unwrap_or_default()
}

fn active_retrieval_context_from_session(session: Option<&SessionInfo>) -> Option<String> {
    session
        .and_then(|session| session.extra.get(ACTIVE_MEMORY_CONTEXT_KEY))
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn is_memory_recall_query(message: &str) -> bool {
    let normalized = message.trim().to_lowercase();
    [
        "之前",
        "讨论过",
        "聊过",
        "记忆",
        "历史",
        "总结",
        "说了什么",
        "讨论了什么",
        "聊了什么",
        "找出来",
    ]
    .iter()
    .any(|phrase| normalized.contains(phrase))
}

fn build_memory_recall_answer(snapshot: &MemoryContextSnapshot) -> Option<String> {
    if snapshot.hits.is_empty() {
        return None;
    }

    let mut summaries = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for hit in snapshot.hits.iter() {
        let snippet = normalize_memory_snippet(&hit.snippet);
        if snippet.is_empty() {
            continue;
        }
        let dedupe_key = format!("{}::{}", hit.session_id, snippet);
        if !seen.insert(dedupe_key) {
            continue;
        }
        summaries.push(format!(
            "{}. {}",
            summaries.len() + 1,
            snippet
        ));
        if summaries.len() >= 3 {
            break;
        }
    }

    if summaries.is_empty() {
        return None;
    }

    Some(format!(
        "我从之前的历史记忆里检索到了这些相关内容：\n{}\n如果你愿意，我可以继续基于其中某一条展开说明。",
        summaries.join("\n")
    ))
}

fn normalize_memory_snippet(snippet: &str) -> String {
    snippet
        .replace("\\n", " ")
        .replace("\\r", " ")
        .replace("\\t", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn build_degraded_answer(
    user_message: &str,
    snapshot: Option<&MemoryContextSnapshot>,
    reason: &str,
) -> String {
    if reason == "upstream_timeout" && is_memory_recall_query(user_message) {
        if let Some(answer) = snapshot.and_then(build_memory_recall_answer) {
            return answer;
        }
    }

    build_stub_answer(user_message, reason)
}

fn build_degraded_stream_chunks(
    user_message: &str,
    snapshot: Option<&MemoryContextSnapshot>,
    reason: &str,
) -> Vec<String> {
    chunk_answer(&build_degraded_answer(user_message, snapshot, reason))
}

fn memory_hits_grouped_by_session(hits: &[MemoryHit]) -> Vec<(String, Vec<MemoryHit>)> {
    let mut grouped_hits: Vec<(String, Vec<MemoryHit>)> = Vec::new();
    for hit in hits.iter() {
        if let Some((_, items)) = grouped_hits
            .iter_mut()
            .find(|(session_id, _)| session_id == &hit.session_id)
        {
            items.push(hit.clone());
            continue;
        }
        grouped_hits.push((hit.session_id.clone(), vec![hit.clone()]));
    }
    grouped_hits
}

fn snapshot_for_memory_batch(
    snapshot: &MemoryContextSnapshot,
    grouped_hits: &[(String, Vec<MemoryHit>)],
) -> MemoryContextSnapshot {
    let hits = grouped_hits
        .iter()
        .flat_map(|(_, items)| items.iter().cloned())
        .collect::<Vec<_>>();

    MemoryContextSnapshot {
        session: snapshot.session.clone(),
        active_retrieval_context: render_memory_hit_context(&hits),
        hits,
    }
}

fn build_memory_merge_request(
    request: &ChatRequest,
    partial_answers: &[String],
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    deadline_ms: u64,
) -> ProviderGenerateRequest {
    const KODUCK_V1_LITE_PROMPT: &str =
        include_str!("../../prompts/system/koduck-v1-lite.md");
    const KODUCK_BASE_LANGUAGE_PROMPT: &str = "你是 koduck-ai 的中文助手。默认使用简体中文直接回答用户问题，保持准确、简洁、自然。不要输出思维链、推理过程、草稿、自我讨论或任何 <think> 标签内容；只输出面向用户的最终答案。如果用户输入过于简短或语义不清，先用一句中文澄清，不要臆测事实。";

    let system_content = format!(
        "{}\n\n{}\n\n你将收到同一用户问题在不同历史 session 批次上的多轮候选答案。请合并这些候选答案，去掉重复内容，保留彼此补充的信息，输出一份自然、简洁、无重复的最终中文回答。",
        KODUCK_V1_LITE_PROMPT.trim(),
        KODUCK_BASE_LANGUAGE_PROMPT
    );

    let partials = partial_answers
        .iter()
        .enumerate()
        .map(|(index, answer)| format!("第{}轮结果:\n{}", index + 1, answer.trim()))
        .collect::<Vec<_>>()
        .join("\n\n");

    ProviderGenerateRequest {
        meta: RequestContext {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages: vec![
            ProviderChatMessage {
                role: "system".to_string(),
                content: system_content,
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: format!(
                    "原始用户问题：\n{}\n\n以下是基于不同历史 session 批次生成的候选结果，请合并并去重：\n\n{}",
                    request.message.trim(),
                    partials
                ),
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: request.temperature.unwrap_or(0.2),
        top_p: 1.0,
        max_tokens: request.max_tokens.unwrap_or(2048),
        tools: vec![],
        response_format: String::new(),
    }
}

fn build_memory_prompt(
    snapshot: &MemoryContextSnapshot,
    user_message: &str,
) -> Option<String> {
    let session_blocks = if is_memory_recall_query(user_message) {
        render_memory_hit_context(&snapshot.hits).or_else(|| snapshot.active_retrieval_context.clone())
    } else {
        snapshot
            .active_retrieval_context
            .clone()
            .or_else(|| render_memory_hit_context(&snapshot.hits))
    }?;

    let prompt_tail = if is_memory_recall_query(user_message) {
        "这是一次“回顾历史/之前聊过什么”的请求。你必须优先做跨 session 汇总，不能只复述单个最近会话；请结合下面所有历史命中与当前问题，自行判断哪些会话相关、哪些不相关，再给出汇总后的最终答案。"
    } else {
        "请结合下面历史命中与当前问题，自行判断哪些内容相关，再决定是否在回答中引用这些历史记忆。"
    };

    Some(format!(
        "以下内容来自 koduck-memory 的历史摘要检索结果，可能跨多个旧会话。\n{}\n\n历史命中:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}",
        prompt_tail,
        session_blocks,
        user_message.trim()
    ))
}

fn render_memory_hit_context(hits: &[MemoryHit]) -> Option<String> {
    if hits.is_empty() {
        return None;
    }

    let grouped_hits = memory_hits_grouped_by_session(hits);

    let session_blocks = grouped_hits
        .iter()
        .take(MEMORY_QUERY_TOP_K as usize)
        .enumerate()
        .map(|(index, (_, hits))| {
            let snippets = hits
                .iter()
                .enumerate()
                .map(|(snippet_index, hit)| {
                    format!("  {}. {}", snippet_index + 1, normalize_memory_snippet(&hit.snippet))
                })
                .collect::<Vec<_>>()
                .join("\n");

            format!("{}. 历史内容\n{}", index + 1, snippets)
        })
        .collect::<Vec<_>>()
        .join("\n");

    if session_blocks.trim().is_empty() {
        None
    } else {
        Some(session_blocks)
    }
}

fn build_memory_tool_definition() -> ProviderToolDefinition {
    ProviderToolDefinition {
        name: "query_memory".to_string(),
        description: "检索当前用户与 koduck 的历史记忆会话，用于回答“之前聊过什么、之前是否聊过某个主题/人物/偏好/事实、具体聊到了哪些方面”等问题。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "用于检索历史记忆的查询文本，通常直接取当前用户问题或其中的主题/实体。"
                },
                "intent": {
                    "type": "string",
                    "enum": ["recall", "compare", "disambiguate", "correct", "explain", "decide", "none"],
                    "description": "本次记忆检索的主意图。必须显式给出，禁止省略。"
                },
                "ner": {
                    "type": "array",
                    "description": "必须显式给出识别到的人物实体列表；没有明确人物名时返回空数组。每个实体都要包含 text 和 type，且 type 只能是 person。",
                    "items": {
                        "type": "object",
                        "properties": {
                            "text": {
                                "type": "string",
                                "description": "识别到的人物实体文本，例如 鲁迅、周树人、高斯、牛顿。"
                            },
                            "type": {
                                "type": "string",
                                "enum": ["person"],
                                "description": "NER 类型，当前只允许 person。"
                            }
                        },
                        "required": ["text", "type"],
                        "additionalProperties": false
                    }
                },
                "memory_scope": {
                    "type": "string",
                    "enum": ["global", "current_session"],
                    "description": "可选；默认 global。仅当需要限制在当前 session 内检索时才传 current_session。"
                },
                "domain_class": {
                    "type": "string",
                    "description": "可选；当你非常确定某个 domain 更适合缩小检索范围时传入，例如 literature、history、food。"
                }
            },
            "required": ["query", "intent", "ner"],
            "additionalProperties": false
        })
        .to_string(),
    }
}

fn build_memory_tool_instruction() -> &'static str {
    "当用户询问“之前聊过什么 / 之前有没有聊过某个人物 / 具体聊到了哪些方面 / 回忆一下之前内容”时，优先调用 query_memory 工具。工具参数里必须显式填写 intent，并且必须返回 ner 数组。当前 ner 只允许 person：只有当你识别到了明确人物名时，才在 ner 中逐项给出 {text, type:\"person\"}；如果没有明确人物名，必须返回空数组。不要把主题词、抽象概念、类别词放进 ner。不要在没有调用工具的情况下臆测历史记录。"
}

fn parse_query_memory_tool_args(raw: &str) -> QueryMemoryToolArgs {
    serde_json::from_str::<QueryMemoryToolArgs>(raw).unwrap_or_default()
}

fn parse_query_intent(intent: Option<&str>) -> QueryIntent {
    match intent
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("recall") => QueryIntent::Recall,
        Some("compare") => QueryIntent::Compare,
        Some("disambiguate") => QueryIntent::Disambiguate,
        Some("correct") => QueryIntent::Correct,
        Some("explain") => QueryIntent::Explain,
        Some("decide") => QueryIntent::Decide,
        Some("none") => QueryIntent::None,
        _ => QueryIntent::Unspecified,
    }
}

fn normalize_query_memory_ner(ner_items: &[QueryMemoryToolNer]) -> Vec<(String, String)> {
    let mut normalized = Vec::new();
    for item in ner_items {
        let text = item.text.as_deref().map(str::trim).unwrap_or_default();
        if text.is_empty() {
            continue;
        }
        let entity_type = item
            .entity_type
            .as_deref()
            .map(str::trim)
            .filter(|value| value.eq_ignore_ascii_case("person"))
            .unwrap_or_default();
        if entity_type.is_empty() {
            continue;
        }
        if normalized.iter().any(|(existing_text, existing_type)| {
            existing_text == text && existing_type == entity_type
        }) {
            continue;
        }
        normalized.push((text.to_string(), entity_type.to_string()));
    }
    normalized
}

async fn memory_hits_from_session_transcripts(
    state: &Arc<AppState>,
    route: DegradeRoute,
    ctx: &MemoryRpcContext,
    session_ids: Vec<String>,
    reason: &str,
) -> Vec<MemoryHit> {
    let mut hits = Vec::with_capacity(session_ids.len());

    for session_id in session_ids {
        let snippet = memory::get_session_transcript(state, ctx, session_id.clone())
            .await
            .unwrap_or_else(|err| {
                log_memory_failure(
                    state,
                    route,
                    MemoryOperation::QueryMemory,
                    ctx,
                    &err,
                    true,
                    "get_session_transcript tool call failed; using session_id-only hit",
                );
                String::new()
            });

        hits.push(MemoryHit {
            session_id,
            l0_uri: String::new(),
            score: 1.0,
            match_reasons: vec![reason.to_string()],
            snippet: if snippet.trim().is_empty() {
                reason.to_string()
            } else {
                snippet
            },
        });
    }

    hits
}

async fn execute_memory_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRpcContext,
    base_snapshot: &MemoryContextSnapshot,
    tool_call: &ProviderToolCall,
) -> MemoryContextSnapshot {
    let args = parse_query_memory_tool_args(&tool_call.arguments);
    info!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tool_name = %tool_call.name,
        tool_call_id = %tool_call.id,
        tool_arguments = %tool_call.arguments,
        "llm tool call resolved to memory query"
    );
    let normalized_ner = normalize_query_memory_ner(&args.ner);
    let tool_query_intent = parse_query_intent(args.intent.as_deref());
    let request_metadata_memory_scope = request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("memory_scope"))
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string());
    let ner_summary = normalized_ner
        .iter()
        .map(|(text, entity_type)| format!("{text}:{entity_type}"))
        .collect::<Vec<_>>()
        .join(",");
    info!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tool_name = %tool_call.name,
        tool_query_intent = ?tool_query_intent,
        ner_count = normalized_ner.len(),
        ner = %ner_summary,
        tool_memory_scope = %args.memory_scope.as_deref().unwrap_or("global"),
        request_metadata_memory_scope = %request_metadata_memory_scope.as_deref().unwrap_or(""),
        "memory tool call request resolved"
    );

    let hits = match tool_query_intent {
        QueryIntent::Recall => {
            let mut merged_session_ids = Vec::new();

            if !normalized_ner.is_empty() {
                for (_, entity_type) in &normalized_ner {
                    match memory::get_session_ids_by_ner(state, ctx, entity_type.clone()).await {
                        Ok(session_ids) => merged_session_ids.extend(session_ids),
                        Err(err) => {
                            log_memory_failure(
                                state,
                                route,
                                MemoryOperation::QueryMemory,
                                ctx,
                                &err,
                                true,
                                "get_session_ids_by_ner tool call failed; continuing with partial recalled sessions",
                            );
                        }
                    }
                }
            } else {
                merged_session_ids = memory::get_all_session_ids(state, ctx)
                    .await
                    .unwrap_or_else(|err| {
                        log_memory_failure(
                            state,
                            route,
                            MemoryOperation::QueryMemory,
                            ctx,
                            &err,
                            true,
                            "get_all_session_ids tool call failed; continuing without recalled sessions",
                        );
                        Vec::new()
                    });
            }

            let mut seen = std::collections::HashSet::new();
            let deduped = merged_session_ids
                .into_iter()
                .filter(|session_id| seen.insert(session_id.clone()))
                .collect::<Vec<_>>();
            info!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                tool_name = %tool_call.name,
                transcript_session_ids = ?deduped,
                "memory recall loading transcripts for merged session ids"
            );
            memory_hits_from_session_transcripts(
                state,
                route,
                ctx,
                deduped,
                "merged_session_ids",
            )
            .await
        }
        _ => Vec::new(),
    };
    info!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tool_name = %tool_call.name,
        hits_count = snapshot_hits_count(&hits),
        tool_query_intent = ?tool_query_intent,
        ner_count = normalized_ner.len(),
        ner = %ner_summary,
        tool_memory_scope = %args.memory_scope.as_deref().unwrap_or("global"),
        request_metadata_memory_scope = %request_metadata_memory_scope.as_deref().unwrap_or(""),
        "memory tool call completed"
    );

    let mut snapshot = base_snapshot.clone();
    snapshot.hits = hits;

    if let Some(rendered_context) = render_memory_hit_context(&snapshot.hits) {
        if snapshot.active_retrieval_context.as_deref() != Some(rendered_context.as_str()) {
            let mut merged_extra = session_extra_map(snapshot.session.as_ref());
            merged_extra.extend(request_metadata_extra(request));
            merged_extra.insert(
                ACTIVE_MEMORY_CONTEXT_KEY.to_string(),
                rendered_context.clone(),
            );
            merged_extra.insert(
                ACTIVE_MEMORY_CONTEXT_KIND_KEY.to_string(),
                "retrieval".to_string(),
            );
            if let Err(err) = memory::upsert_session_meta(
                state,
                ctx,
                SessionUpsertInput {
                    title: metadata_string(request, "title"),
                    status: metadata_string(request, "status"),
                    extra: merged_extra,
                    parent_session_id: metadata_string(request, "parent_session_id"),
                    forked_from_session_id: metadata_string(request, "forked_from_session_id"),
                    last_message_at: Utc::now().timestamp_millis(),
                },
            )
            .await
            {
                log_memory_failure(
                    state,
                    route,
                    MemoryOperation::UpsertSessionMeta,
                    ctx,
                    &err,
                    true,
                    "failed to persist active retrieval context after query_memory tool call",
                );
            }
        }
        snapshot.active_retrieval_context = Some(rendered_context);
    }

    snapshot
}

fn snapshot_hits_count(hits: &[MemoryHit]) -> usize {
    hits.len()
}

fn log_llm_request_prompt(phase: &str, request_id: &str, session_id: &str, llm_request: &ProviderGenerateRequest) {
    let prompt = serde_json::to_string(&llm_request.messages)
        .unwrap_or_else(|_| "<failed to serialize llm prompt>".to_string());
    let tool_names: Vec<&str> = llm_request.tools.iter().map(|tool| tool.name.as_str()).collect();

    info!(
        request_id = %request_id,
        session_id = %session_id,
        phase = %phase,
        model = %llm_request.model,
        deadline_ms = llm_request.meta.deadline_ms,
        tools = ?tool_names,
        prompt = %prompt,
        "llm request prompt prepared"
    );
}

async fn resolve_memory_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    base_snapshot: &MemoryContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ToolResolutionResult, AppError> {
    // Tool selection should use only the base chat history plus the current
    // user message. Memory prompts must not be injected at this stage.
    let llm_request = build_provider_generate_request(
        request,
        None,
        request_id,
        session_id,
        auth_ctx,
        trace_id,
        state.config.llm.timeout_ms,
        vec![build_memory_tool_definition()],
    );
    log_llm_request_prompt("tool_selection", request_id, session_id, &llm_request);
    let selection = state.llm_provider.generate(llm_request).await?;
    info!(
        request_id = %request_id,
        session_id = %session_id,
        tool_call_count = selection.tool_calls.len(),
        finish_reason = %selection.finish_reason,
        "llm tool-selection phase completed"
    );
    let maybe_memory_call = selection
        .tool_calls
        .iter()
        .find(|tool_call| tool_call.name == "query_memory")
        .cloned();

    if let Some(tool_call) = maybe_memory_call {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            tool_name = %tool_call.name,
            tool_call_id = %tool_call.id,
            "query_memory tool call selected by llm"
        );
        let ctx = MemoryRpcContext::from_auth(
            request_id.to_string(),
            session_id.to_string(),
            trace_id.to_string(),
            state.config.llm.timeout_ms,
            auth_ctx,
        );
        let snapshot = execute_memory_tool_call(
            state,
            route,
            request,
            &ctx,
            base_snapshot,
            &tool_call,
        )
        .await;
        return Ok(ToolResolutionResult {
            snapshot,
            direct_response: None,
        });
    }

    info!(
        request_id = %request_id,
        session_id = %session_id,
        "llm did not select query_memory tool; returning direct response"
    );

    Ok(ToolResolutionResult {
        snapshot: base_snapshot.clone(),
        direct_response: Some(selection),
    })
}

fn build_memory_entry_metadata(
    request: &ChatRequest,
    ctx: &MemoryRpcContext,
    model: Option<&str>,
    session_has_active_retrieval_context: bool,
) -> HashMap<String, String> {
    let mut metadata = HashMap::from([
        ("request_id".to_string(), ctx.request_id.clone()),
        ("trace_id".to_string(), ctx.trace_id.clone()),
        ("tenant_id".to_string(), ctx.tenant_id.clone()),
        ("source".to_string(), "koduck-ai".to_string()),
    ]);

    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        metadata.insert("model".to_string(), model.to_string());
    }

    if let Some(retrieve_policy) = request.retrieve_policy.as_ref() {
        metadata.insert("retrieve_policy".to_string(), retrieve_policy.clone());
    }

    if let Some(domain_class) = request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("domain_class"))
        .and_then(json_value_as_string)
    {
        metadata.insert("domain_class".to_string(), domain_class);
    }

    if is_memory_recall_query(&request.message) || session_has_active_retrieval_context {
        metadata.insert("memory_recall_query".to_string(), "true".to_string());
        metadata.insert("memory_skip_retrieval".to_string(), "true".to_string());
    }

    metadata
}

fn extract_or_create_request_id(headers: &HeaderMap) -> String {
    headers
        .get("x-request-id")
        .and_then(|h| h.to_str().ok())
        .filter(|v| !v.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("req_{}", Uuid::new_v4()))
}

fn resolve_session_id(session_id: Option<String>) -> String {
    session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(normalize_session_id)
        .unwrap_or_else(|| Uuid::new_v4().to_string())
}

fn normalize_session_id(session_id: &str) -> Option<String> {
    let candidate = session_id
        .strip_prefix("sess_")
        .unwrap_or(session_id)
        .trim();

    Uuid::parse_str(candidate).ok().map(|uuid| uuid.to_string())
}

fn extract_trace_id(headers: &HeaderMap) -> String {
    headers
        .get("x-trace-id")
        .or_else(|| headers.get("x-b3-traceid"))
        .or_else(|| headers.get("traceparent"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("-")
        .to_string()
}

fn estimate_tokens(text: &str) -> u32 {
    (text.chars().count() as u32 / 4).max(1)
}

fn build_stub_answer(_user_message: &str, reason: &str) -> String {
    match reason {
        "stub_enabled" => "当前系统处于演示模式，暂时返回示例回复。".to_string(),
        "upstream_timeout" => {
            "刚才回答服务短暂异常，我没能正常生成完整回复。请稍后重试一次。".to_string()
        }
        "budget_exhausted" => {
            "当前回答服务负载较高，暂时无法稳定生成回复。请稍后再试。".to_string()
        }
        "circuit_open" => {
            "当前回答服务正在恢复中，暂时无法稳定处理这条消息。请稍后再试。".to_string()
        }
        _ => "当前回答服务暂时不可用，请稍后重试。".to_string(),
    }
}

fn build_stream_chunks(_user_message: &str, reason: &str) -> Vec<String> {
    match reason {
        "stub_enabled" => vec!["当前系统处于演示模式，暂时返回示例回复。".to_string()],
        "upstream_timeout" => vec![
            "刚才回答服务短暂异常，".to_string(),
            "这条消息没能正常生成完整回复。".to_string(),
            "请稍后重试一次。".to_string(),
        ],
        "budget_exhausted" => vec![
            "当前回答服务负载较高，".to_string(),
            "暂时无法稳定生成回复。".to_string(),
            "请稍后再试。".to_string(),
        ],
        "circuit_open" => vec![
            "当前回答服务正在恢复中，".to_string(),
            "这条消息暂时无法稳定处理。".to_string(),
            "请稍后再试。".to_string(),
        ],
        _ => vec!["当前回答服务暂时不可用，请稍后重试。".to_string()],
    }
}

fn chunk_answer(answer: &str) -> Vec<String> {
    const CHUNK_SIZE: usize = 48;
    let chars = answer.chars().collect::<Vec<_>>();
    if chars.is_empty() {
        return vec!["回答已完成。".to_string()];
    }

    chars
        .chunks(CHUNK_SIZE)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect()
}

fn build_stub_chat_response(
    state: &Arc<AppState>,
    request_id: &str,
    session_id: &str,
    user_message: &str,
    requested_model: Option<String>,
    reason: &str,
) -> ChatResponse {
    let model = requested_model.unwrap_or_else(|| state.config.llm.default_provider.clone());
    let answer = build_stub_answer(user_message, reason);
    let prompt_tokens = estimate_tokens(user_message);
    let completion_tokens = estimate_tokens(&answer);
    ChatResponse {
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
        answer,
        model,
        usage: TokenUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        },
        degraded: true,
    }
}

async fn handle_stream_abort(
    stream_session: &Arc<crate::stream::sse::StreamSession>,
    guard: &RequestGenerationGuard,
    reason: AbortReason,
) {
    let (code, message) = match reason {
        AbortReason::Superseded => (
            ErrorCode::StreamInterrupted.to_string(),
            "stream interrupted by newer request".to_string(),
        ),
        AbortReason::TimedOut => (
            ErrorCode::StreamTimeout.to_string(),
            "stream exceeded max duration".to_string(),
        ),
    };

    let _ = stream_session
        .force_shutdown_if_current(guard, code, message)
        .await;
}

async fn call_llm_generate(
    state: &Arc<AppState>,
    request: &ChatRequest,
    memory_snapshot: &MemoryContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ChatResponse, AppError> {
    let tool_resolution = resolve_memory_tool_call(
        state,
        DegradeRoute::Chat,
        request,
        memory_snapshot,
        request_id,
        session_id,
        auth_ctx,
        trace_id,
    )
    .await?;

    if let Some(body) = tool_resolution.direct_response {
        let answer = body.message.content.clone();
        let usage = body.usage.as_ref();
        return Ok(ChatResponse {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            answer,
            model: body.model,
            usage: TokenUsage {
                prompt_tokens: usage.map(|u| u.prompt_tokens).unwrap_or(0),
                completion_tokens: usage.map(|u| u.completion_tokens).unwrap_or(0),
                total_tokens: usage.map(|u| u.total_tokens).unwrap_or(0),
            },
            degraded: false,
        });
    }

    let body = if is_memory_recall_query(&request.message) {
        let grouped_hits = memory_hits_grouped_by_session(&tool_resolution.snapshot.hits);
        if grouped_hits.len() > MEMORY_SESSION_BATCH_SIZE {
            let mut partial_answers = Vec::new();
            let mut merged_usage = TokenUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            };

            for (batch_index, chunk) in grouped_hits.chunks(MEMORY_SESSION_BATCH_SIZE).enumerate() {
                let batch_snapshot = snapshot_for_memory_batch(&tool_resolution.snapshot, chunk);
                let llm_request = build_provider_generate_request(
                    request,
                    Some(&batch_snapshot),
                    request_id,
                    session_id,
                    auth_ctx,
                    trace_id,
                    state.config.llm.timeout_ms,
                    vec![],
                );
                log_llm_request_prompt(
                    &format!("chat_generate_batch_{}", batch_index + 1),
                    request_id,
                    session_id,
                    &llm_request,
                );
                let batch_body = generate_with_retry(state, request_id, llm_request).await?;
                partial_answers.push(batch_body.message.content.clone());
                if let Some(usage) = batch_body.usage.as_ref() {
                    merged_usage.prompt_tokens += usage.prompt_tokens;
                    merged_usage.completion_tokens += usage.completion_tokens;
                    merged_usage.total_tokens += usage.total_tokens;
                }
            }

            let merge_request = build_memory_merge_request(
                request,
                &partial_answers,
                request_id,
                session_id,
                auth_ctx,
                trace_id,
                state.config.llm.timeout_ms,
            );
            log_llm_request_prompt("chat_generate_merge", request_id, session_id, &merge_request);
            let merge_body = generate_with_retry(state, request_id, merge_request).await?;
            if let Some(usage) = merge_body.usage.as_ref() {
                merged_usage.prompt_tokens += usage.prompt_tokens;
                merged_usage.completion_tokens += usage.completion_tokens;
                merged_usage.total_tokens += usage.total_tokens;
            }

            return Ok(ChatResponse {
                request_id: request_id.to_string(),
                session_id: session_id.to_string(),
                answer: merge_body.message.content.clone(),
                model: merge_body.model,
                usage: merged_usage,
                degraded: false,
            });
        } else {
            let llm_request = build_provider_generate_request(
                request,
                Some(&tool_resolution.snapshot),
                request_id,
                session_id,
                auth_ctx,
                trace_id,
                state.config.llm.timeout_ms,
                vec![],
            );
            log_llm_request_prompt("chat_generate", request_id, session_id, &llm_request);
            generate_with_retry(state, request_id, llm_request).await?
        }
    } else {
        let llm_request = build_provider_generate_request(
            request,
            Some(&tool_resolution.snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            vec![],
        );
        log_llm_request_prompt("chat_generate", request_id, session_id, &llm_request);
        generate_with_retry(state, request_id, llm_request).await?
    };

    let answer = body
        .message
        .content
        .clone();
    let usage = body.usage.as_ref();
    Ok(ChatResponse {
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
        answer,
        model: body.model,
        usage: TokenUsage {
            prompt_tokens: usage.map(|u| u.prompt_tokens).unwrap_or(0),
            completion_tokens: usage.map(|u| u.completion_tokens).unwrap_or(0),
            total_tokens: usage.map(|u| u.total_tokens).unwrap_or(0),
        },
        degraded: false,
    })
}

async fn call_llm_stream(
    state: &Arc<AppState>,
    request: &ChatRequest,
    memory_snapshot: &MemoryContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<StreamLlmPlan, AppError> {
    let tool_resolution = resolve_memory_tool_call(
        state,
        DegradeRoute::ChatStream,
        request,
        memory_snapshot,
        request_id,
        session_id,
        auth_ctx,
        trace_id,
    )
    .await?;

    if let Some(body) = tool_resolution.direct_response {
        return Ok(StreamLlmPlan::ReadyAnswer(body.message.content));
    }

    if is_memory_recall_query(&request.message) {
        let grouped_hits = memory_hits_grouped_by_session(&tool_resolution.snapshot.hits);
        if grouped_hits.len() > MEMORY_SESSION_BATCH_SIZE {
            let mut partial_answers = Vec::new();
            for (batch_index, chunk) in grouped_hits.chunks(MEMORY_SESSION_BATCH_SIZE).enumerate() {
                let batch_snapshot = snapshot_for_memory_batch(&tool_resolution.snapshot, chunk);
                let llm_request = build_provider_generate_request(
                    request,
                    Some(&batch_snapshot),
                    request_id,
                    session_id,
                    auth_ctx,
                    trace_id,
                    state.config.llm.timeout_ms,
                    vec![],
                );
                log_llm_request_prompt(
                    &format!("chat_stream_generate_batch_{}", batch_index + 1),
                    request_id,
                    session_id,
                    &llm_request,
                );
                let batch_body = generate_with_retry(state, request_id, llm_request).await?;
                partial_answers.push(batch_body.message.content);
            }

            let merge_request = build_memory_merge_request(
                request,
                &partial_answers,
                request_id,
                session_id,
                auth_ctx,
                trace_id,
                state.config.llm.timeout_ms,
            );
            log_llm_request_prompt("chat_stream_generate_merge", request_id, session_id, &merge_request);
            let merge_body = generate_with_retry(state, request_id, merge_request).await?;
            return Ok(StreamLlmPlan::ReadyAnswer(merge_body.message.content));
        }
    }

    let policy = Arc::clone(&state.retry_budget_policy);
    let session = policy.begin_session();
    let mut attempt_index = 0;

    loop {
        let llm_request = build_provider_generate_request(
            request,
            Some(&tool_resolution.snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            vec![],
        );
        log_llm_request_prompt("chat_stream_generate", request_id, session_id, &llm_request);
        match state.llm_provider.stream_generate(llm_request).await {
            Ok(stream) => return Ok(StreamLlmPlan::Upstream(stream)),
            Err(err) => {
                let upstream_source = err.source.as_ref().map(|source| source.to_string());
                warn!(
                    request_id = %request_id,
                    session_id = %session_id,
                    phase = "chat_stream_generate",
                    error.code = %err.code,
                    error.message = %err.message,
                    error.retryable = err.retryable,
                    error.upstream = ?err.upstream,
                    error.retry_after_ms = ?err.retry_after_ms,
                    error.source = ?upstream_source,
                    "llm stream_generate request failed"
                );
                match policy.should_retry(&session, attempt_index, err) {
                RetryDirective::RetryAfter { delay, err } => {
                    policy.log_retry(request_id, attempt_index, delay, &err);
                    tokio::time::sleep(delay).await;
                    attempt_index += 1;
                }
                RetryDirective::Exhausted(err) | RetryDirective::DoNotRetry(err) => {
                    return Err(err);
                }
                }
            }
        }
    }
}

async fn generate_with_retry(
    state: &Arc<AppState>,
    request_id: &str,
    llm_request: ProviderGenerateRequest,
) -> Result<crate::llm::GenerateResponse, AppError> {
    let policy = Arc::clone(&state.retry_budget_policy);
    let session = policy.begin_session();
    let mut attempt_index = 0;
    let request_template = llm_request;

    loop {
        match state.llm_provider.generate(request_template.clone()).await {
            Ok(body) => return Ok(body),
            Err(err) => {
                let upstream_source = err.source.as_ref().map(|source| source.to_string());
                warn!(
                    request_id = %request_id,
                    session_id = %request_template.meta.session_id,
                    phase = "chat_generate",
                    error.code = %err.code,
                    error.message = %err.message,
                    error.retryable = err.retryable,
                    error.upstream = ?err.upstream,
                    error.retry_after_ms = ?err.retry_after_ms,
                    error.source = ?upstream_source,
                    "llm generate request failed"
                );
                match policy.should_retry(&session, attempt_index, err) {
                RetryDirective::RetryAfter { delay, err } => {
                    policy.log_retry(request_id, attempt_index, delay, &err);
                    tokio::time::sleep(delay).await;
                    attempt_index += 1;
                }
                RetryDirective::Exhausted(err) | RetryDirective::DoNotRetry(err) => {
                    return Err(err);
                }
                }
            }
        }
    }
}

fn build_provider_generate_request(
    request: &ChatRequest,
    memory_snapshot: Option<&MemoryContextSnapshot>,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    deadline_ms: u64,
    tools: Vec<ProviderToolDefinition>,
) -> ProviderGenerateRequest {
    const KODUCK_V1_LITE_PROMPT: &str =
        include_str!("../../prompts/system/koduck-v1-lite.md");
    const KODUCK_BASE_LANGUAGE_PROMPT: &str = "你是 koduck-ai 的中文助手。默认使用简体中文直接回答用户问题，保持准确、简洁、自然。不要输出思维链、推理过程、草稿、自我讨论或任何 <think> 标签内容；只输出面向用户的最终答案。如果用户输入过于简短或语义不清，先用一句中文澄清，不要臆测事实。";

    let mut system_content = format!(
        "{}\n\n{}",
        KODUCK_V1_LITE_PROMPT.trim(),
        KODUCK_BASE_LANGUAGE_PROMPT
    );

    if let Some(memory_prompt) = memory_snapshot.and_then(|snapshot| {
        build_memory_prompt(snapshot, &request.message)
    }) {
        system_content.push_str("\n\n");
        system_content.push_str(&memory_prompt);
    }

    if !tools.is_empty() {
        system_content.push_str("\n\n");
        system_content.push_str(build_memory_tool_instruction());
    }

    let mut messages = vec![ProviderChatMessage {
        role: "system".to_string(),
        content: system_content,
        name: String::new(),
        metadata: HashMap::new(),
    }];

    if let Some(history) = request.history.as_ref() {
        messages.extend(history.iter().map(|item| ProviderChatMessage {
            role: item.role.trim().to_string(),
            content: item.content.trim().to_string(),
            name: String::new(),
            metadata: HashMap::new(),
        }));
    }

    messages.push(ProviderChatMessage {
        role: "user".to_string(),
        content: request.message.clone(),
        name: String::new(),
        metadata: HashMap::new(),
    });

    ProviderGenerateRequest {
        meta: RequestContext {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages,
        temperature: request.temperature.unwrap_or(0.2),
        top_p: 1.0,
        max_tokens: request.max_tokens.unwrap_or(2048),
        tools,
        response_format: String::new(),
    }
}

fn build_stream_events(
    ev: &ProviderStreamEvent,
    request_id: &str,
    session_id: &str,
) -> Vec<PendingStreamEvent> {
    let mut events = Vec::with_capacity(2);

    if !ev.delta.is_empty() {
        events.push(PendingStreamEvent {
            event_type: "message".to_string(),
            payload: json!({ "text": &ev.delta }),
            event_id: Some(ev.event_id.clone()),
            sequence_num: Some(ev.sequence_num),
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
        });
    }

    if !ev.finish_reason.is_empty() {
        events.push(PendingStreamEvent {
            event_type: "done".to_string(),
            payload: json!({ "finish_reason": &ev.finish_reason }),
            event_id: None,
            sequence_num: None,
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
        });
    }

    events
}

fn build_stream_error_event(
    err: &AppError,
    request_id: &str,
    session_id: &str,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "error".to_string(),
        payload: json!({
            "code": err.code.to_string(),
            "message": err.to_error_response().message,
            "retryable": err.retryable,
            "degraded": err.degraded,
            "retry_after_ms": err.retry_after_ms,
        }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_stub_stream_delta(
    request_id: &str,
    session_id: &str,
    text: impl Into<String>,
    degrade_reason: &str,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "message".to_string(),
        payload: json!({
            "text": text.into(),
            "degraded": true,
            "degrade_reason": degrade_reason,
        }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_stub_stream_done(
    request_id: &str,
    session_id: &str,
    degrade_reason: &str,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "done".to_string(),
        payload: json!({
            "finish_reason": "degraded_fallback",
            "degraded": true,
            "degrade_reason": degrade_reason,
        }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_generated_stream_delta(
    request_id: &str,
    session_id: &str,
    text: impl Into<String>,
) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "message".to_string(),
        payload: json!({ "text": text.into() }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn build_generated_stream_done(request_id: &str, session_id: &str) -> PendingStreamEvent {
    PendingStreamEvent {
        event_type: "done".to_string(),
        payload: json!({ "finish_reason": "stop" }),
        event_id: None,
        sequence_num: None,
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn degrade_reason_label(decision: &DegradeDecision) -> &'static str {
    match decision.reason {
        crate::reliability::degrade::DegradeReason::UpstreamTimeout => "upstream_timeout",
        crate::reliability::degrade::DegradeReason::BudgetExhausted => "budget_exhausted",
        crate::reliability::degrade::DegradeReason::CircuitOpen => "circuit_open",
    }
}

fn spawn_stub_stream(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    chunks: Vec<String>,
    degrade_reason: &'static str,
) {
    tokio::spawn(async move {
        let producer_guard = guard.clone();
        let producer = async {
            for chunk in chunks {
                tokio::time::sleep(Duration::from_millis(120)).await;
                if let Err(err) = stream_session
                    .enqueue_event_if_current(
                        &producer_guard,
                        build_stub_stream_delta(
                            stream_session.request_id(),
                            stream_session.session_id(),
                            chunk,
                            degrade_reason,
                        ),
                    )
                    .await
                {
                    info!(
                        request_id = %stream_session.request_id(),
                        session_id = %stream_session.session_id(),
                        error = %err,
                        generation = producer_guard.generation(),
                        "stream queue rejected stub event"
                    );
                    stream_session
                        .force_shutdown_if_current(
                            &producer_guard,
                            ErrorCode::StreamTimeout.to_string(),
                            "stream queue backpressure timeout",
                        )
                        .await;
                    return;
                }
            }

            let _ = stream_session
                .enqueue_event_if_current(
                    &producer_guard,
                    build_stub_stream_done(
                        stream_session.request_id(),
                        stream_session.session_id(),
                        degrade_reason,
                    ),
                )
                .await;
        };

        let cleanup_session = Arc::clone(&stream_session);
        let cleanup_guard = guard.clone();
        let cleanup_guard_for_log = cleanup_guard.clone();
        let result = run_abortable_with_cleanup(
            guard,
            stream_timeout,
            producer,
            move |reason| async move {
                handle_stream_abort(&cleanup_session, &cleanup_guard, reason).await;
            },
        )
        .await;

        if let Err(reason) = result {
            info!(
                request_id = %stream_session.request_id(),
                session_id = %stream_session.session_id(),
                generation = cleanup_guard_for_log.generation(),
                abort_reason = ?reason,
                "stub stream producer terminated early"
            );
        }
    });
}

fn spawn_generated_stream(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    chunks: Vec<String>,
) {
    tokio::spawn(async move {
        let producer_guard = guard.clone();
        let producer = async {
            for chunk in chunks {
                tokio::time::sleep(Duration::from_millis(60)).await;
                if let Err(err) = stream_session
                    .enqueue_event_if_current(
                        &producer_guard,
                        build_generated_stream_delta(
                            stream_session.request_id(),
                            stream_session.session_id(),
                            chunk,
                        ),
                    )
                    .await
                {
                    info!(
                        request_id = %stream_session.request_id(),
                        session_id = %stream_session.session_id(),
                        error = %err,
                        generation = producer_guard.generation(),
                        "stream queue rejected generated event"
                    );
                    stream_session
                        .force_shutdown_if_current(
                            &producer_guard,
                            ErrorCode::StreamTimeout.to_string(),
                            "stream queue backpressure timeout",
                        )
                        .await;
                    return;
                }
            }

            let _ = stream_session
                .enqueue_event_if_current(
                    &producer_guard,
                    build_generated_stream_done(
                        stream_session.request_id(),
                        stream_session.session_id(),
                    ),
                )
                .await;
        };

        let cleanup_session = Arc::clone(&stream_session);
        let cleanup_guard = guard.clone();
        let cleanup_guard_for_log = cleanup_guard.clone();
        let result = run_abortable_with_cleanup(
            guard,
            stream_timeout,
            producer,
            move |reason| async move {
                handle_stream_abort(&cleanup_session, &cleanup_guard, reason).await;
            },
        )
        .await;

        if let Err(reason) = result {
            info!(
                request_id = %stream_session.request_id(),
                session_id = %stream_session.session_id(),
                generation = cleanup_guard_for_log.generation(),
                abort_reason = ?reason,
                "generated stream producer terminated early"
            );
        }
    });
}

fn api_error_response(err: AppError, request_id: String) -> Response {
    let enriched = if err.request_id.is_none() {
        err.with_request_id(request_id)
    } else {
        err
    };
    let status = enriched.http_status();
    let top_code = enriched.code.to_string();
    let message = enriched.message.clone();
    let error = enriched.to_error_response();

    (
        status,
        Json(ApiResponse::<serde_json::Value> {
            success: false,
            code: top_code,
            message,
            data: None,
            error: Some(error),
        }),
    )
        .into_response()
}
