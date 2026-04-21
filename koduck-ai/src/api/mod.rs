//! North-facing API handlers (chat/stream).

use std::{collections::{HashMap, HashSet}, convert::Infallible, sync::Arc, time::Duration};

use axum::{
    extract::{Json, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
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
        self, MemoryEntry, MemoryHit, MemoryRequestContext, QueryIntent, QueryMemoryInput,
        RetrievePolicy, SessionUpsertInput,
    },
    clients::knowledge::{self, KnowledgeQueryResult},
    clients::tool_execute,
    clients::tool_catalog,
    llm::{
        ChatMessage as ProviderChatMessage, GenerateRequest as ProviderGenerateRequest,
        RequestContext, StreamEvent as ProviderStreamEvent, ToolCall as ProviderToolCall,
        ToolDefinition as ProviderToolDefinition,
    },
    orchestrator::cancel::{run_abortable_with_cleanup, AbortReason, RequestGenerationGuard},
    reliability::{
        degrade::DegradeRoute,
        error::{AppError, ErrorCode, UpstreamService},
        memory_observe::MemoryOperation,
        retry_budget::RetryDirective,
    },
    stream::sse::{PendingStreamEvent, ResumeCursor, StreamEventData},
};

const MAX_ALLOWED_TOKENS: u32 = 32_768;
const MEMORY_QUERY_TOP_K: i32 = 5;
const MEMORY_QUERY_PAGE_SIZE: i32 = 5;
const MAX_HISTORY_MESSAGES: usize = 20;
const MEMORY_PROMPT_TAIL: &str =
    "请结合下面历史命中与当前问题，自行判断哪些内容相关，再决定是否在回答中引用这些历史记忆。";

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
pub struct SessionTranscriptPayload {
    pub session_id: String,
    pub entries: Vec<SessionTranscriptItem>,
}

#[derive(Debug, Serialize)]
pub struct SessionTranscriptItem {
    pub entry_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolExecuteRequest {
    pub session_id: Option<String>,
    pub tool_name: String,
    pub tool_version: Option<String>,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct ToolExecutePayload {
    pub request_id: String,
    pub session_id: String,
    pub tool_name: String,
    pub tool_version: String,
    pub service_name: String,
    pub result: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
struct KnowledgeContextSnapshot {
    query: String,
    domain_class: String,
    result: KnowledgeQueryResult,
}

#[derive(Debug, Clone, PartialEq)]
struct KnowledgeProfileDetailSnapshot {
    result: knowledge::ProfileDetailView,
}

#[derive(Debug, Clone, Default, PartialEq)]
struct ConversationContextSnapshot {
    hits: Vec<MemoryHit>,
    knowledge: Option<KnowledgeContextSnapshot>,
    knowledge_profile_detail: Option<KnowledgeProfileDetailSnapshot>,
}

#[derive(Debug, Default)]
struct ToolResolutionResult {
    snapshot: ConversationContextSnapshot,
    direct_response: Option<crate::llm::GenerateResponse>,
}

enum StreamLlmPlan {
    Upstream(crate::llm::ProviderEventStream),
    ReadyAnswer(String),
}

#[derive(Debug, Deserialize, Default)]
struct QueryKnowledgeToolArgs {
    query: Option<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GetKnowledgeProfileDetailToolArgs {
    entity_id: Option<i64>,
    entry_code: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct QueryMemoryToolArgs {
    query: Option<String>,
    intent: Option<String>,
    memory_scope: Option<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct MemoryHitReviewDecision {
    #[serde(default)]
    keep: bool,
}

struct PreparedChatContext {
    request_id: String,
    auth_ctx: AuthContext,
    session_id: String,
    trace_id: String,
    memory_ctx: MemoryRequestContext,
}

fn is_first_class_tool(name: &str) -> bool {
    matches!(
        name,
        "query_memory" | "query_knowledge" | "get_knowledge_profile_detail"
    )
}

fn request_history_count(request: &ChatRequest) -> usize {
    request.history.as_ref().map(|items| items.len()).unwrap_or(0)
}

fn format_tool_call_names(tool_calls: &[ProviderToolCall]) -> String {
    if tool_calls.is_empty() {
        return "-".to_string();
    }

    tool_calls
        .iter()
        .map(|tool_call| tool_call.name.as_str())
        .collect::<Vec<_>>()
        .join(",")
}

async fn init_chat_context(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    route: DegradeRoute,
    request: &ChatRequest,
) -> Result<PreparedChatContext, AppError> {
    let request_id = extract_or_create_request_id(headers);
    state.degrade_policy.record_request(route);
    if !state.lifecycle.is_accepting_requests() {
        return Err(
            AppError::new(ErrorCode::ServerBusy, "service is draining new requests")
                .with_request_id(request_id),
        );
    }

    let auth_ctx = crate::auth::authenticate_bearer(headers, state)
        .await
        .map_err(|err| err.with_request_id(request_id.clone()))?;

    validate_chat_request(request).map_err(|err| err.with_request_id(request_id.clone()))?;

    let session_id = resolve_session_id(request.session_id.clone());
    let trace_id = extract_trace_id(headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id.clone(),
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    Ok(PreparedChatContext {
        request_id,
        auth_ctx,
        session_id,
        trace_id,
        memory_ctx,
    })
}

pub async fn chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Response {
    let PreparedChatContext {
        request_id,
        auth_ctx,
        session_id,
        trace_id,
        memory_ctx,
    } = match init_chat_context(&state, &headers, DegradeRoute::Chat, &request).await {
        Ok(ctx) => ctx,
        Err(err) => {
            let response_request_id = err
                .request_id
                .clone()
                .unwrap_or_else(|| extract_or_create_request_id(&headers));
            return api_error_response(err, response_request_id);
        }
    };

    info!(
        request_id = %request_id,
        session_id = %session_id,
        trace_id = %trace_id,
        tenant_id = %auth_ctx.tenant_id,
        history_present = request.history.is_some(),
        history_count = request_history_count(&request),
        "chat request received"
    );

    let memory_snapshot =
        load_memory_snapshot(&state, DegradeRoute::Chat, &request, &memory_ctx).await;

    let response = match call_llm_generate(
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
    };

    append_chat_turn_best_effort(
        &state,
        DegradeRoute::Chat,
        &memory_ctx,
        &request,
        &response.answer,
        response.model.as_str(),
        "append_memory failed after chat response; continuing with successful answer",
    )
    .await;

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

pub async fn chat_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ChatStreamRequest>,
) -> Response {
    let PreparedChatContext {
        request_id,
        auth_ctx,
        session_id,
        trace_id,
        memory_ctx,
    } = match init_chat_context(&state, &headers, DegradeRoute::ChatStream, &request.chat).await {
        Ok(ctx) => ctx,
        Err(err) => {
            let response_request_id = err
                .request_id
                .clone()
                .unwrap_or_else(|| extract_or_create_request_id(&headers));
            return api_error_response(err, response_request_id);
        }
    };
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
        history_present = request.chat.history.is_some(),
        history_count = request_history_count(&request.chat),
        "stream request received"
    );

    let memory_snapshot = if resume_cursor.is_resume() {
        None
    } else {
        Some(
            load_memory_snapshot(&state, DegradeRoute::ChatStream, &request.chat, &memory_ctx)
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
        let llm_plan = match call_llm_stream(
            &state,
            &request.chat,
            memory_snapshot.as_ref(),
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
                    append_chat_turn_best_effort(
                        &state,
                        DegradeRoute::ChatStream,
                        &memory_ctx,
                        &request.chat,
                        &answer,
                        request.chat.model.as_deref().unwrap_or_default(),
                        "append_memory failed after direct tool-free response; continuing with generated stream",
                    )
                    .await;
                    spawn_generated_stream(
                        Arc::clone(&session),
                        generation_guard.clone(),
                        stream_timeout,
                        answer,
                    );
                }
                StreamLlmPlan::Upstream(upstream) => {
                    let stream_session = Arc::clone(&session);
                    let guard = generation_guard.clone();
                    let append_state = Arc::clone(&state);
                    let append_ctx = memory_ctx.clone();
                    let append_request = request.chat.clone();
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

                            append_chat_turn_best_effort(
                                &append_state,
                                DegradeRoute::ChatStream,
                                &append_ctx,
                                &append_request,
                                &full_answer,
                                append_request.model.as_deref().unwrap_or_default(),
                                "failed to persist streamed conversation into memory",
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
                                "upstream stream producer terminated early"
                            );
                        }
                    });
                }
            }
        }

    let high_watermark = resume_cursor.high_watermark(Some(&session));
    stream_sse_response_with_watermark(session, request_id, high_watermark).await
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(raw_session_id): Path<String>,
) -> Response {
    delete_session_impl(state, headers, raw_session_id).await
}

pub async fn get_session_transcript(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(raw_session_id): Path<String>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    let entries = match memory::get_session_transcript(&state, &memory_ctx).await {
        Ok(entries) => entries,
        Err(err) => return api_error_response(err, request_id),
    };
    let entries = entries
        .into_iter()
        .map(|entry| SessionTranscriptItem {
            entry_id: entry.entry_id,
            role: entry.role,
            content: entry.content,
            timestamp: entry.timestamp,
        })
        .collect();

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "success".to_string(),
            data: Some(SessionTranscriptPayload { session_id, entries }),
            error: None,
        }),
    )
        .into_response()
}

pub async fn execute_tool(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ToolExecuteRequest>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    let tool_name = request.tool_name.trim();
    if tool_name.is_empty() {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "tool_name is required")
                .with_request_id(request_id.clone()),
            request_id,
        );
    }
    if is_first_class_tool(tool_name) {
        return api_error_response(
            AppError::new(
                ErrorCode::InvalidArgument,
                format!(
                    "tool '{}' is first-class and should be executed by the dedicated ai orchestrator",
                    tool_name
                ),
            )
            .with_request_id(request_id.clone()),
            request_id,
        );
    }

    let session_id = match request.session_id.as_deref() {
        Some(raw) => match normalize_session_id(raw) {
            Some(value) => value,
            None => {
                return api_error_response(
                    AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                        .with_request_id(request_id.clone()),
                    request_id,
                )
            }
        },
        None => Uuid::new_v4().to_string(),
    };

    let trace_id = extract_trace_id(&headers);
    let discovered_tools = tool_catalog::fetch_prompt_tools(&state, &request_id).await;
    let Some(tool) = discovered_tools
        .iter()
        .find(|candidate| candidate.definition.name == tool_name)
    else {
        return api_error_response(
            AppError::new(
                ErrorCode::ResourceNotFound,
                format!("tool '{}' is not registered or not discoverable", tool_name),
            )
            .with_request_id(request_id.clone()),
            request_id,
        );
    };

    if let Some(expected_version) = request
        .tool_version
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if tool.route.tool_version != expected_version {
            return api_error_response(
                AppError::new(
                    ErrorCode::InvalidArgument,
                    format!(
                        "tool '{}' version mismatch: requested '{}', discovered '{}'",
                        tool_name, expected_version, tool.route.tool_version
                    ),
                )
                .with_request_id(request_id.clone()),
                request_id,
            );
        }
    }

    let arguments_json = match serde_json::to_string(&request.arguments) {
        Ok(value) => value,
        Err(err) => {
            return api_error_response(
                AppError::new(
                    ErrorCode::InvalidArgument,
                    format!("failed to encode tool arguments as json: {err}"),
                )
                .with_request_id(request_id.clone()),
                request_id,
            )
        }
    };

    let executed = match tool_execute::execute_tool(
        &state,
        tool,
        &request_id,
        &session_id,
        &auth_ctx,
        &trace_id,
        &arguments_json,
    )
    .await
    {
        Ok(result) => result,
        Err(err) => return api_error_response(err, request_id),
    };

    let result = match serde_json::from_str::<serde_json::Value>(&executed.result_json) {
        Ok(value) => value,
        Err(err) => {
            return api_error_response(
                AppError::new(
                    ErrorCode::DependencyFailed,
                    format!(
                        "tool '{}' returned malformed result_json: {err}",
                        executed.tool_name
                    ),
                )
                .with_request_id(request_id.clone()),
                request_id,
            )
        }
    };

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "success".to_string(),
            data: Some(ToolExecutePayload {
                request_id,
                session_id,
                tool_name: executed.tool_name,
                tool_version: executed.tool_version,
                service_name: executed.service_name,
                result,
            }),
            error: None,
        }),
    )
        .into_response()
}

pub async fn delete_memory_entry(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((raw_session_id, raw_entry_id)): Path<(String, String)>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };
    let Some(entry_id) = normalize_uuid(&raw_entry_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "entry_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id,
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    if let Err(err) = memory::delete_memory_entry(&state, &memory_ctx, &entry_id).await {
        return api_error_response(err, request_id);
    }

    (
        StatusCode::OK,
        Json(ApiResponse::<()> {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "memory entry deleted".to_string(),
            data: None,
            error: None,
        }),
    )
        .into_response()
}

pub async fn debug_path_echo(Path(value): Path<String>) -> Response {
    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "success".to_string(),
            data: Some(json!({ "value": value })),
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
    let request_id = extract_or_create_request_id(&headers);
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );

    let exists = match memory::get_session(&state, &memory_ctx).await {
        Ok(_) => true,
        Err(err) if err.code == ErrorCode::ResourceNotFound => false,
        Err(err) => return api_error_response(err, request_id),
    };

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "success".to_string(),
            data: Some(json!({
                "session_id": session_id,
                "exists": exists
            })),
            error: None,
        }),
    )
        .into_response()
}

pub async fn http_fallback(uri: Uri) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ApiResponse::<serde_json::Value> {
            success: false,
            code: ErrorCode::ResourceNotFound.to_string(),
            message: format!("route not found: {}", uri.path()),
            data: None,
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
    let memory_ctx = MemoryRequestContext::from_auth(
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
        Json(ApiResponse::<()> {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "session deleted".to_string(),
            data: None,
            error: None,
        }),
    )
        .into_response()
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

async fn load_memory_snapshot(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
) -> ConversationContextSnapshot {
    if let Err(err) = memory::upsert_session_meta(
        state,
        ctx,
        SessionUpsertInput {
            title: metadata_string(request, "title"),
            status: metadata_string(request, "status"),
            extra: request_metadata_extra(request),
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

    ConversationContextSnapshot {
        hits: Vec::new(),
        knowledge: None,
        knowledge_profile_detail: None,
    }
}

async fn append_chat_turn(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
    answer: &str,
    model: &str,
) -> Result<(), AppError> {
    let now = Utc::now().timestamp_millis();
    let user_entry = MemoryEntry {
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: now,
        metadata: build_memory_entry_metadata(request, ctx, None),
    };
    let mut entries = vec![user_entry];

    if !answer.trim().is_empty() {
        entries.push(MemoryEntry {
            role: "assistant".to_string(),
            content: answer.to_string(),
            timestamp: now,
            metadata: build_memory_entry_metadata(request, ctx, Some(model)),
        });
    }

    let _ = memory::append_memory(state, ctx, entries, "append-turn").await?;

    Ok(())
}

async fn append_chat_turn_best_effort(
    state: &Arc<AppState>,
    route: DegradeRoute,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
    answer: &str,
    model: &str,
    failure_message: &'static str,
) {
    if let Err(err) = append_chat_turn(state, ctx, request, answer, model).await {
        log_memory_failure(
            state,
            route,
            MemoryOperation::AppendMemory,
            ctx,
            &err,
            true,
            failure_message,
        );
    }
}

fn log_memory_failure(
    state: &Arc<AppState>,
    route: DegradeRoute,
    operation: MemoryOperation,
    ctx: &MemoryRequestContext,
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

fn build_memory_prompt(
    snapshot: &ConversationContextSnapshot,
    user_message: &str,
) -> Option<String> {
    if snapshot.hits.is_empty() {
        return None;
    }

    let snippets = snapshot
        .hits
        .iter()
        .take(MEMORY_QUERY_TOP_K as usize)
        .enumerate()
        .map(|(index, hit)| {
            format!(
                "{}. source_session={} reasons=[{}] snippet={}",
                index + 1,
                hit.session_id,
                hit.match_reasons.join(","),
                hit.snippet
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    Some(format!(
        "以下内容来自 koduck-memory 的历史摘要检索结果，可能跨多个旧会话。\n{}\n\n历史命中:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}",
        MEMORY_PROMPT_TAIL,
        snippets,
        user_message.trim()
    ))
}

fn build_knowledge_prompt(
    snapshot: &ConversationContextSnapshot,
    user_message: &str,
) -> Option<String> {
    let knowledge = snapshot.knowledge.as_ref()?;
    if knowledge.result.hits.is_empty() {
        return None;
    }

    let candidates = knowledge
        .result
        .hits
        .iter()
        .take(5)
        .enumerate()
        .map(|(index, hit)| {
            format!(
                "{}. entity_id={} canonical_name={} entity_name={} match_type={} valid_window=[{} ~ {}] basic_profile_s3_uri={}",
                index + 1,
                hit.entity_id,
                hit.canonical_name,
                hit.entity_name,
                hit.match_type,
                hit.valid_from.as_deref().unwrap_or("-"),
                hit.valid_to.as_deref().unwrap_or("-"),
                hit.basic_profile_s3_uri.as_deref().unwrap_or("-"),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let profile = knowledge
        .result
        .primary_profile
        .as_ref()
        .map(|profile| {
            format!(
                "主命中 basic profile:\nentity_id={} canonical_name={} entity_name={} domain_class={} valid_window=[{} ~ {}] basic_profile_s3_uri={}",
                profile.entity_id,
                profile.canonical_name,
                profile.entity_name,
                profile.domain_class,
                profile.valid_from.as_deref().unwrap_or("-"),
                profile.valid_to.as_deref().unwrap_or("-"),
                profile.basic_profile_s3_uri.as_deref().unwrap_or("-"),
            )
        })
        .unwrap_or_else(|| "主命中 basic profile: 无".to_string());

    let detail = snapshot
        .knowledge_profile_detail
        .as_ref()
        .map(|detail| {
            format!(
                "已读取当前 profile detail:\nentity_id={} entry_code={} version={} is_current={} blob_uri={} loaded_at={}",
                detail.result.entity_id,
                detail.result.entry_code,
                detail.result.version,
                detail.result.is_current,
                detail.result.blob_uri,
                detail.result.loaded_at,
            )
        })
        .unwrap_or_else(|| "当前未读取非 BASIC profile detail。".to_string());

    Some(format!(
        "以下内容来自 koduck-knowledge 的结构化实体检索结果，主要用于实体对齐与只读知识引用，不等于完整正文。\nquery_knowledge 只提供候选实体和 basic profile；如果这些信息仍不足以回答问题，你可以继续调用 get_knowledge_profile_detail 读取当前非 BASIC profile 的详情元信息。\n知识查询: query={} domain_class={}\n\n候选实体:\n{}\n\n{}\n\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}\n如果这些结果不足以支撑结论，请明确说明知识库未提供足够细节，不要补造事实。",
        knowledge.query,
        knowledge.domain_class,
        candidates,
        profile,
        detail,
        user_message.trim()
    ))
}

fn parse_memory_hit_review_decision(raw: &str) -> Option<MemoryHitReviewDecision> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(parsed) = serde_json::from_str::<MemoryHitReviewDecision>(trimmed) {
        return Some(parsed);
    }

    let start = trimmed.find('{')?;
    let end = trimmed.rfind('}')?;
    if end <= start {
        return None;
    }

    serde_json::from_str::<MemoryHitReviewDecision>(&trimmed[start..=end]).ok()
}

fn build_memory_hit_review_request(
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    deadline_ms: u64,
    hit_index: usize,
    hit: &MemoryHit,
) -> ProviderGenerateRequest {
    let system_prompt = format!(
        "你是记忆命中筛选器。\
输出必须是 JSON：{{\"keep\":true|false}}。\
{}\
如果该历史命中与当前问题无关，keep=false；如果相关，keep=true。\
筛选阶段仅做保留判断，不要改写内容。\
禁止输出 JSON 以外的内容，禁止臆造不存在的信息。",
        MEMORY_PROMPT_TAIL
    );

    let user_prompt = format!(
        "当前用户问题:\n{}\n\n候选历史命中 #{}:\nsource_session={}\nreasons=[{}]\nsnippet={}",
        request.message.trim(),
        hit_index + 1,
        hit.session_id,
        hit.match_reasons.join(","),
        hit.snippet
    );

    ProviderGenerateRequest {
        meta: RequestContext {
            request_id: format!("{request_id}:memory-hit-review:{hit_index}"),
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
                content: system_prompt,
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: user_prompt,
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 256,
        tools: vec![],
        response_format: String::new(),
    }
}

async fn review_memory_hits_for_stream(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    hits: &[MemoryHit],
) -> Vec<MemoryHit> {
    if hits.is_empty() {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            "memory hit review skipped because there are no hits"
        );
        return Vec::new();
    }

    let mut seen_sessions = HashSet::new();
    let mut deduped_hits = Vec::with_capacity(hits.len());
    for hit in hits {
        if seen_sessions.insert(hit.session_id.clone()) {
            deduped_hits.push(hit.clone());
        }
    }

    info!(
        request_id = %request_id,
        session_id = %session_id,
        hit_count = hits.len(),
        deduped_hit_count = deduped_hits.len(),
        "memory hit review started"
    );

    let mut kept = Vec::new();
    for (index, hit) in deduped_hits.iter().enumerate() {
        info!(
            request_id = %request_id,
            session_id = %session_id,
            hit_index = index,
            source_session_id = %hit.session_id,
            match_reasons = %hit.match_reasons.join(","),
            snippet_chars = hit.snippet.chars().count(),
            source_session_content = %hit.snippet,
            "reviewing memory hit"
        );

        let review_request = build_memory_hit_review_request(
            request,
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            index,
            hit,
        );

        let decision = match state.llm_provider.generate(review_request).await {
            Ok(resp) => parse_memory_hit_review_decision(&resp.message.content),
            Err(err) => {
                warn!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    error = %err,
                    "memory hit review failed; falling back to keep original snippet"
                );
                None
            }
        };

        match decision {
            Some(parsed) if parsed.keep => {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "keep",
                    "memory hit review completed"
                );
                kept.push(hit.clone());
            }
            Some(_) => {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "drop",
                    "memory hit review completed"
                );
            }
            None => {
                // Fail-open: judge step failed, keep original session transcript.
                warn!(
                    request_id = %request_id,
                    session_id = %session_id,
                    hit_index = index,
                    source_session_id = %hit.session_id,
                    review_decision = "keep_fallback",
                    "memory hit review parse failed; kept original session transcript"
                );
                kept.push(hit.clone());
            }
        }
    }

    info!(
        request_id = %request_id,
        session_id = %session_id,
        kept_count = kept.len(),
        dropped_count = deduped_hits.len().saturating_sub(kept.len()),
        "memory hit review finished"
    );

    kept
}

fn parse_query_knowledge_tool_args(raw: &str) -> QueryKnowledgeToolArgs {
    serde_json::from_str::<QueryKnowledgeToolArgs>(raw).unwrap_or_default()
}

fn parse_get_knowledge_profile_detail_tool_args(raw: &str) -> GetKnowledgeProfileDetailToolArgs {
    serde_json::from_str::<GetKnowledgeProfileDetailToolArgs>(raw).unwrap_or_default()
}

fn parse_query_memory_tool_args(raw: &str) -> QueryMemoryToolArgs {
    serde_json::from_str::<QueryMemoryToolArgs>(raw).unwrap_or_default()
}

fn parse_query_intent(raw: &str) -> QueryIntent {
    match raw.trim().to_ascii_lowercase().as_str() {
        "recall" => QueryIntent::Recall,
        "compare" => QueryIntent::Compare,
        "disambiguate" => QueryIntent::Disambiguate,
        "correct" => QueryIntent::Correct,
        "explain" => QueryIntent::Explain,
        "decide" => QueryIntent::Decide,
        "delete" => QueryIntent::Delete,
        "none" => QueryIntent::None,
        _ => QueryIntent::Unspecified,
    }
}

fn memory_query_session_scope(current_session_id: &str, raw_scope: Option<&str>) -> Option<String> {
    match raw_scope
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("global")
        .to_ascii_lowercase()
        .as_str()
    {
        "current_session" => Some(current_session_id.to_string()),
        _ => None,
    }
}

fn build_memory_query_text(request: &ChatRequest, args: &QueryMemoryToolArgs) -> String {
    args.query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| request.message.trim())
        .to_string()
}

fn retrieve_policy_from_request(request: &ChatRequest) -> RetrievePolicy {
    let raw = request
        .retrieve_policy
        .clone()
        .or_else(|| {
            request
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("retrieve_policy"))
                .and_then(json_value_as_string)
        })
        .unwrap_or_else(|| "summary_first".to_string());

    match raw.trim().to_ascii_lowercase().as_str() {
        "domain_first" => RetrievePolicy::DomainFirst,
        "hybrid" => RetrievePolicy::Hybrid,
        "summary_first" => RetrievePolicy::SummaryFirst,
        _ => RetrievePolicy::SummaryFirst,
    }
}

async fn execute_memory_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_query_memory_tool_args(&tool_call.arguments);
    let query_text = build_memory_query_text(request, &args);
    if query_text.trim().is_empty() {
        return ConversationContextSnapshot {
            hits: Vec::new(),
            knowledge: None,
            knowledge_profile_detail: None,
        };
    }

    let input = QueryMemoryInput {
        query_text,
        session_id: memory_query_session_scope(&ctx.session_id, args.memory_scope.as_deref()),
        domain_class: args
            .domain_class
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .to_string(),
        query_intent: parse_query_intent(args.intent.as_deref().unwrap_or("none")),
        retrieve_policy: retrieve_policy_from_request(request),
        top_k: MEMORY_QUERY_TOP_K,
        page_size: MEMORY_QUERY_PAGE_SIZE,
    };

    match memory::query_memory(state, ctx, input).await {
        Ok(hits) => {
            let mut snapshot = ConversationContextSnapshot::default();
            snapshot.hits = hits;
            snapshot
        }
        Err(err) => {
            log_memory_failure(
                state,
                route,
                MemoryOperation::QueryMemory,
                ctx,
                &err,
                true,
                "tool selection chose query_memory but retrieval failed; continuing without retrieved memory hits",
            );
            ConversationContextSnapshot::default()
        }
    }
}

async fn execute_knowledge_tool_call(
    state: &Arc<AppState>,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_query_knowledge_tool_args(&tool_call.arguments);
    let query = args
        .query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| request.message.trim())
        .to_string();
    let domain_class = args
        .domain_class
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| metadata_string(request, "domain_class"));

    if query.trim().is_empty() || domain_class.trim().is_empty() {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "query_knowledge skipped because query or domain_class is unavailable"
        );
        return ConversationContextSnapshot::default();
    }

    match knowledge::query_knowledge(state, &ctx.request_id, &query, &domain_class).await {
        Ok(result) => ConversationContextSnapshot {
            hits: Vec::new(),
            knowledge: Some(KnowledgeContextSnapshot {
                query,
                domain_class,
                result,
            }),
            knowledge_profile_detail: None,
        },
        Err(err) => {
            warn!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                tool_name = %tool_call.name,
                error = %err,
                "tool selection chose query_knowledge but retrieval failed; continuing without structured knowledge"
            );
            ConversationContextSnapshot::default()
        }
    }
}

async fn execute_knowledge_profile_detail_tool_call(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let args = parse_get_knowledge_profile_detail_tool_args(&tool_call.arguments);
    let Some(entity_id) = args.entity_id else {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "get_knowledge_profile_detail skipped because entity_id is unavailable"
        );
        return ConversationContextSnapshot::default();
    };

    let Some(entry_code) = args
        .entry_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
    else {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "get_knowledge_profile_detail skipped because entry_code is unavailable"
        );
        return ConversationContextSnapshot::default();
    };

    match knowledge::get_profile_detail(state, &ctx.request_id, entity_id, &entry_code).await {
        Ok(result) => ConversationContextSnapshot {
            hits: Vec::new(),
            knowledge: None,
            knowledge_profile_detail: Some(KnowledgeProfileDetailSnapshot { result }),
        },
        Err(err) => {
            warn!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                tool_name = %tool_call.name,
                error = %err,
                "tool selection chose get_knowledge_profile_detail but retrieval failed; continuing without profile detail"
            );
            ConversationContextSnapshot::default()
        }
    }
}

async fn execute_supported_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    base_snapshot: &ConversationContextSnapshot,
    tool_call: &ProviderToolCall,
) -> ConversationContextSnapshot {
    let mut snapshot = base_snapshot.clone();
    let next_snapshot = match tool_call.name.as_str() {
        "query_memory" => execute_memory_tool_call(state, route, request, ctx, tool_call).await,
        "query_knowledge" => execute_knowledge_tool_call(state, request, ctx, tool_call).await,
        "get_knowledge_profile_detail" => {
            execute_knowledge_profile_detail_tool_call(state, ctx, tool_call).await
        }
        _ => return snapshot,
    };

    if !next_snapshot.hits.is_empty() {
        snapshot.hits = next_snapshot.hits;
    }
    if next_snapshot.knowledge.is_some() {
        snapshot.knowledge = next_snapshot.knowledge;
    }
    if next_snapshot.knowledge_profile_detail.is_some() {
        snapshot.knowledge_profile_detail = next_snapshot.knowledge_profile_detail;
    }
    snapshot
}

async fn resolve_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    base_snapshot: &ConversationContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ToolResolutionResult, AppError> {
    const MAX_TOOL_ROUNDS: usize = 3;
    let discovered_tools = tool_catalog::fetch_prompt_tool_definitions(state, request_id).await;
    let mut snapshot = base_snapshot.clone();
    let mut last_tool_name: Option<String> = None;

    for _ in 0..MAX_TOOL_ROUNDS {
        let llm_request = build_provider_generate_request(
            request,
            Some(&snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            discovered_tools.iter().cloned().collect(),
        );
        let selection = state.llm_provider.generate(llm_request).await?;
        let maybe_tool_call = selection
            .tool_calls
            .iter()
            .find(|tool_call| {
                discovered_tools
                    .iter()
                    .any(|tool| tool.name == tool_call.name)
                    && is_first_class_tool(tool_call.name.as_str())
            })
            .cloned();
        info!(
            request_id = %request_id,
            session_id = %session_id,
            tool_call_count = selection.tool_calls.len(),
            tool_call_names = %format_tool_call_names(&selection.tool_calls),
            selected_first_class_tool = maybe_tool_call
                .as_ref()
                .map(|tool_call| tool_call.name.as_str())
                .unwrap_or("-"),
            finish_reason = %selection.finish_reason,
            "llm tool-selection phase completed"
        );

        if let Some(tool_call) = maybe_tool_call {
            if last_tool_name.as_deref() == Some(tool_call.name.as_str()) {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the same tool was selected consecutively"
                );
                break;
            }

            let ctx = MemoryRequestContext::from_auth(
                request_id.to_string(),
                session_id.to_string(),
                trace_id.to_string(),
                state.config.llm.timeout_ms,
                auth_ctx,
            );
            let next_snapshot = execute_supported_tool_call(
                state,
                route,
                request,
                &ctx,
                &snapshot,
                &tool_call,
            )
            .await;
            let has_new_context = next_snapshot != snapshot
                && (!next_snapshot.hits.is_empty()
                    || next_snapshot.knowledge.is_some()
                    || next_snapshot.knowledge_profile_detail.is_some());
            if !has_new_context {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the tool call produced no incremental context"
                );
                break;
            }

            snapshot = next_snapshot;
            last_tool_name = Some(tool_call.name.clone());
            continue;
        }

        return Ok(ToolResolutionResult {
            snapshot,
            direct_response: Some(selection),
        });
    }

    Ok(ToolResolutionResult {
        snapshot,
        direct_response: None,
    })
}

fn build_memory_entry_metadata(
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
    model: Option<&str>,
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

    normalize_uuid(candidate)
}

fn normalize_uuid(value: &str) -> Option<String> {
    Uuid::parse_str(value.trim()).ok().map(|uuid| uuid.to_string())
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

// TODO: need further refactor.
async fn call_llm_generate(
    state: &Arc<AppState>,
    request: &ChatRequest,
    memory_snapshot: &ConversationContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ChatResponse, AppError> {
    let tool_resolution = resolve_tool_call(
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

    let policy = Arc::clone(&state.retry_budget_policy);
    let session = policy.begin_session();
    let mut attempt_index = 0;
    let body = loop {
        let deadline_ms =
            match policy.next_attempt_deadline_ms(&session, state.config.llm.timeout_ms) {
            Some(deadline_ms) => deadline_ms,
            None => {
                return Err(
                    AppError::new(ErrorCode::UpstreamUnavailable, "retry timeout budget exhausted")
                        .with_request_id(request_id.to_string())
                        .with_upstream(UpstreamService::Llm)
                        .with_retryable(false),
                )
            }
        };
        let llm_request = build_provider_generate_request(
            request,
            Some(&tool_resolution.snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            deadline_ms,
            vec![],
        );
        match state.llm_provider.generate(llm_request).await {
            Ok(body) => break body,
            Err(err) => match policy.should_retry(&session, attempt_index, err) {
                RetryDirective::RetryAfter { delay, err } => {
                    policy.log_retry(request_id, attempt_index, delay, &err);
                    tokio::time::sleep(delay).await;
                    attempt_index += 1;
                }
                RetryDirective::Exhausted(err) | RetryDirective::DoNotRetry(err) => {
                    return Err(err);
                }
            },
        }
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
    memory_snapshot: Option<&ConversationContextSnapshot>,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<StreamLlmPlan, AppError> {
    const MAX_TOOL_ROUNDS: usize = 3;
    let mut snapshot = memory_snapshot.cloned().unwrap_or_default();
    let mut last_tool_name: Option<String> = None;
    let discovered_tools = tool_catalog::fetch_prompt_tool_definitions(state, request_id).await;

    for _ in 0..MAX_TOOL_ROUNDS {
        let tool_request = build_provider_generate_request(
            request,
            Some(&snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            discovered_tools
                .iter()
                .cloned()
                .collect(),
        );
        let selection = state.llm_provider.generate(tool_request).await?;
        let maybe_tool_call = selection
            .tool_calls
            .iter()
            .find(|tool_call| {
                discovered_tools
                    .iter()
                    .any(|tool| tool.name == tool_call.name)
                    && is_first_class_tool(tool_call.name.as_str())
            })
            .cloned();
        info!(
            request_id = %request_id,
            session_id = %session_id,
            tool_call_count = selection.tool_calls.len(),
            tool_call_names = %format_tool_call_names(&selection.tool_calls),
            selected_first_class_tool = maybe_tool_call
                .as_ref()
                .map(|tool_call| tool_call.name.as_str())
                .unwrap_or("-"),
            finish_reason = %selection.finish_reason,
            "llm stream tool-selection phase completed"
        );

        if let Some(tool_call) = maybe_tool_call {
            if last_tool_name.as_deref() == Some(tool_call.name.as_str()) {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the same tool was selected consecutively"
                );
                break;
            }

            let ctx = MemoryRequestContext::from_auth(
                request_id.to_string(),
                session_id.to_string(),
                trace_id.to_string(),
                state.config.llm.timeout_ms,
                auth_ctx,
            );
            let next_snapshot = execute_supported_tool_call(
                state,
                DegradeRoute::ChatStream,
                request,
                &ctx,
                &snapshot,
                &tool_call,
            )
            .await;
            let next_snapshot = if tool_call.name == "query_memory" {
                let reviewed_hits = review_memory_hits_for_stream(
                    state,
                    request,
                    request_id,
                    session_id,
                    auth_ctx,
                    trace_id,
                    &next_snapshot.hits,
                )
                .await;
                let mut reviewed_snapshot = next_snapshot.clone();
                reviewed_snapshot.hits = reviewed_hits;
                reviewed_snapshot
            } else {
                next_snapshot
            };

            let has_new_context = next_snapshot != snapshot
                && (!next_snapshot.hits.is_empty()
                    || next_snapshot.knowledge.is_some()
                    || next_snapshot.knowledge_profile_detail.is_some());
            if !has_new_context {
                info!(
                    request_id = %request_id,
                    session_id = %session_id,
                    tool_name = %tool_call.name,
                    "stop tool rounds because the tool call produced no incremental context"
                );
                break;
            }

            snapshot = next_snapshot;
            last_tool_name = Some(tool_call.name.clone());
            continue;
        }

        if !selection.message.content.trim().is_empty() {
            return Ok(StreamLlmPlan::ReadyAnswer(selection.message.content));
        }

        break;
    }

    let policy = Arc::clone(&state.retry_budget_policy);
    let session = policy.begin_session();
    let mut attempt_index = 0;

    loop {
        let deadline_ms =
            match policy.next_attempt_deadline_ms(&session, state.config.llm.timeout_ms) {
            Some(deadline_ms) => deadline_ms,
            None => {
                return Err(
                    AppError::new(ErrorCode::UpstreamUnavailable, "retry timeout budget exhausted")
                        .with_request_id(request_id.to_string())
                        .with_upstream(UpstreamService::Llm)
                        .with_retryable(false),
                )
            }
        };
        let llm_request = build_provider_generate_request(
            request,
            Some(&snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            deadline_ms,
            vec![],
        );
        match state.llm_provider.stream_generate(llm_request).await {
            Ok(stream) => return Ok(StreamLlmPlan::Upstream(stream)),
            Err(err) => match policy.should_retry(&session, attempt_index, err) {
                RetryDirective::RetryAfter { delay, err } => {
                    policy.log_retry(request_id, attempt_index, delay, &err);
                    tokio::time::sleep(delay).await;
                    attempt_index += 1;
                }
                RetryDirective::Exhausted(err) | RetryDirective::DoNotRetry(err) => {
                    return Err(err);
                }
            },
        }
    }
}

fn build_provider_generate_request(
    request: &ChatRequest,
    memory_snapshot: Option<&ConversationContextSnapshot>,
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

    if let Some(knowledge_prompt) = memory_snapshot.and_then(|snapshot| {
        build_knowledge_prompt(snapshot, &request.message)
    }) {
        system_content.push_str("\n\n");
        system_content.push_str(&knowledge_prompt);
    }

    if !tools.is_empty() {
        system_content.push_str("\n\n");
        system_content.push_str(
            "如需调用工具，只能依据每个工具自带的 description 与 JSON schema 决定是否调用、以及如何填写参数。不要臆造未声明字段，也不要调用未出现在 tools 列表中的工具。",
        );
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

fn spawn_chunked_stream_producer<ChunkEventBuilder, DoneEventBuilder>(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    chunks: Vec<String>,
    chunk_delay_ms: u64,
    rejected_event_log_message: &'static str,
    terminated_log_message: &'static str,
    chunk_event_builder: ChunkEventBuilder,
    done_event_builder: DoneEventBuilder,
) where
    ChunkEventBuilder: Fn(&str, &str, String) -> PendingStreamEvent + Send + Sync + 'static,
    DoneEventBuilder: Fn(&str, &str) -> PendingStreamEvent + Send + Sync + 'static,
{
    tokio::spawn(async move {
        let producer_guard = guard.clone();
        let producer = async {
            for chunk in chunks {
                tokio::time::sleep(Duration::from_millis(chunk_delay_ms)).await;
                if let Err(err) = stream_session
                    .enqueue_event_if_current(
                        &producer_guard,
                        chunk_event_builder(
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
                        "{rejected_event_log_message}"
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
                    done_event_builder(stream_session.request_id(), stream_session.session_id()),
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
                "{terminated_log_message}"
            );
        }
    });
}

fn spawn_generated_stream(
    stream_session: Arc<crate::stream::sse::StreamSession>,
    guard: RequestGenerationGuard,
    stream_timeout: Duration,
    answer: String,
) {
    spawn_chunked_stream_producer(
        stream_session,
        guard,
        stream_timeout,
        chunk_answer(&answer),
        40,
        "stream queue rejected generated event",
        "generated stream producer terminated early",
        build_generated_stream_delta,
        build_generated_stream_done,
    );
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
