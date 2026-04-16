//! North-facing API handlers (chat/stream).

use std::{collections::HashMap, convert::Infallible, sync::Arc, time::Duration};

use axum::{
    extract::{Json, State},
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
        self, MemoryEntry, MemoryHit, MemoryRequestContext, QueryIntent, QueryMemoryInput,
        RetrievePolicy, SessionInfo, SessionUpsertInput,
    },
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

#[derive(Debug, Clone, Default)]
struct MemoryContextSnapshot {
    session: Option<SessionInfo>,
    hits: Vec<MemoryHit>,
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
    memory_scope: Option<String>,
    domain_class: Option<String>,
}

struct PreparedChatContext {
    request_id: String,
    auth_ctx: AuthContext,
    session_id: String,
    trace_id: String,
    memory_ctx: MemoryRequestContext,
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

async fn load_memory_snapshot(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
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

    MemoryContextSnapshot {
        session,
        hits: Vec::new(),
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

fn retrieve_policy_from_request(request: &ChatRequest) -> RetrievePolicy {
    if is_memory_recall_query(&request.message) {
        return RetrievePolicy::DomainFirst;
    }

    let raw_policy = request.retrieve_policy.as_deref().or_else(|| {
        request
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("retrieve_policy"))
            .and_then(|value| value.as_str())
    });

    match raw_policy
        .map(|value| value.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("domain-first") | Some("domain_first") => RetrievePolicy::DomainFirst,
        Some("summary-first") | Some("summary_first") => RetrievePolicy::SummaryFirst,
        Some("hybrid") => RetrievePolicy::Hybrid,
        _ => RetrievePolicy::SummaryFirst,
    }
}

fn memory_query_session_scope(
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
) -> Option<String> {
    if is_memory_recall_query(&request.message) {
        return Some(ctx.session_id.clone());
    }

    let scope = request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("memory_scope"))
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_ascii_lowercase());

    match scope.as_deref() {
        Some("session") | Some("current_session") | Some("current") => {
            Some(ctx.session_id.clone())
        }
        _ => None,
    }
}

fn build_memory_query_text(message: &str) -> String {
    let mut normalized = message.trim().to_lowercase();
    let alias_replacements = [
        ("karl marx", "马克思"),
        ("marx", "马克思"),
        ("friedrich engels", "恩格斯"),
        ("engels", "恩格斯"),
        ("vladimir lenin", "列宁"),
        ("lenin", "列宁"),
        ("max stirner", "施蒂纳"),
        ("stirner", "施蒂纳"),
        ("anarchism", "无政府主义"),
        ("anarchist", "无政府主义"),
    ];
    for (alias, canonical) in alias_replacements {
        normalized = normalized.replace(alias, canonical);
    }

    let phrase_replacements = [
        "我们之前有讨论过",
        "我们之前讨论过",
        "我们之前聊过",
        "讨论了什么",
        "聊了什么",
        "说了什么",
        "找出来之前关于",
        "找出之前关于",
        "找出来之前",
        "找出之前",
        "之前关于",
        "之前的",
        "之前",
        "记忆",
        "历史记忆",
        "有没有",
        "有讨论过",
        "讨论过",
        "聊过",
        "总结一下",
        "总结",
    ];

    for phrase in phrase_replacements {
        normalized = normalized.replace(phrase, " ");
    }

    normalized = normalized
        .chars()
        .map(|ch| match ch {
            '，' | '。' | '？' | '！' | '：' | '；' | '、' | ',' | '.' | '?' | '!' | ':' | ';'
            | '(' | ')' | '（' | '）' | '"' | '\'' => ' ',
            _ => ch,
        })
        .collect::<String>();

    let stop_tokens = [
        "我们", "我", "你", "吗", "呢", "呀", "吧", "啊", "一下", "这个", "那个", "关于",
        "什么",
    ];

    let filtered = normalized
        .split_whitespace()
        .filter(|token| !stop_tokens.contains(token))
        .collect::<Vec<_>>()
        .join(" ");

    if filtered.trim().is_empty() {
        message.trim().to_string()
    } else {
        filtered
    }
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

fn build_memory_prompt(
    snapshot: &MemoryContextSnapshot,
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

    let prompt_tail = if is_memory_recall_query(user_message) {
        "这是一次“回顾历史/之前聊过什么”的请求。你必须优先做跨 session 汇总，不能只复述单个最近会话；请结合下面所有历史命中与当前问题，自行判断哪些会话相关、哪些不相关，再给出汇总后的最终答案。"
    } else {
        "请结合下面历史命中与当前问题，自行判断哪些内容相关，再决定是否在回答中引用这些历史记忆。"
    };

    Some(format!(
        "以下内容来自 koduck-memory 的历史摘要检索结果，可能跨多个旧会话。\n{}\n\n历史命中:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}",
        prompt_tail,
        snippets,
        user_message.trim()
    ))
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
            "required": ["query", "intent"],
            "additionalProperties": false
        })
        .to_string(),
    }
}

fn build_tool_definition() -> Vec<ProviderToolDefinition> {
    vec![build_memory_tool_definition()]
}

fn build_memory_tool_instruction() -> &'static str {
    "当用户询问“之前聊过什么 / 之前有没有聊过某个主题、人物、偏好、事实 / 具体聊到了哪些方面 / 回忆一下之前内容”时，优先调用 query_memory 工具；并且在工具参数中显式填写 intent。不要在没有调用工具的情况下臆测历史记录。"
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

async fn execute_memory_tool_call(
    state: &Arc<AppState>,
    route: DegradeRoute,
    request: &ChatRequest,
    ctx: &MemoryRequestContext,
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

    let query_text = args
        .query
        .as_deref()
        .map(build_memory_query_text)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| build_memory_query_text(&request.message));
    let session_scope = match args.memory_scope.as_deref() {
        Some("current_session") => Some(ctx.session_id.clone()),
        _ => memory_query_session_scope(request, ctx),
    };
    let requested_domain_class = args.domain_class.clone();
    let domain_class = requested_domain_class
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| metadata_string(request, "domain_class"));
    let query_intent = parse_query_intent(args.intent.as_deref());

    let hits = memory::query_memory(
        state,
        ctx,
        QueryMemoryInput {
            query_text,
            session_id: session_scope,
            domain_class,
            query_intent,
            retrieve_policy: retrieve_policy_from_request(request),
            top_k: MEMORY_QUERY_TOP_K,
            page_size: MEMORY_QUERY_PAGE_SIZE,
        },
    )
    .await
    .unwrap_or_else(|err| {
        log_memory_failure(
            state,
            route,
            MemoryOperation::QueryMemory,
            ctx,
            &err,
            true,
            "query_memory tool call failed; continuing without retrieved memory hits",
        );
        Vec::new()
    });

    info!(
        request_id = %ctx.request_id,
        session_id = %ctx.session_id,
        tool_name = %tool_call.name,
        hits_count = hits.len(),
        query_intent = ?query_intent,
        "memory tool call completed"
    );

    let mut snapshot = base_snapshot.clone();
    snapshot.hits = hits;
    snapshot
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
    let llm_request = build_provider_generate_request(
        request,
        Some(base_snapshot),
        request_id,
        session_id,
        auth_ctx,
        trace_id,
        state.config.llm.timeout_ms,
        build_tool_definition(),
    );
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
        let ctx = MemoryRequestContext::from_auth(
            request_id.to_string(),
            session_id.to_string(),
            trace_id.to_string(),
            state.config.llm.timeout_ms,
            auth_ctx,
        );
        let snapshot =
            execute_memory_tool_call(state, route, request, &ctx, base_snapshot, &tool_call).await;
        return Ok(ToolResolutionResult {
            snapshot,
            direct_response: None,
        });
    }

    Ok(ToolResolutionResult {
        snapshot: base_snapshot.clone(),
        direct_response: Some(selection),
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

    if is_memory_recall_query(&request.message) {
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
    memory_snapshot: Option<&MemoryContextSnapshot>,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<StreamLlmPlan, AppError> {
    const MAX_TOOL_ROUNDS: usize = 3;
    let mut snapshot = memory_snapshot.cloned().unwrap_or_default();

    for _ in 0..MAX_TOOL_ROUNDS {
        let tool_request = build_provider_generate_request(
            request,
            Some(&snapshot),
            request_id,
            session_id,
            auth_ctx,
            trace_id,
            state.config.llm.timeout_ms,
            build_tool_definition(),
        );
        let selection = state.llm_provider.generate(tool_request).await?;
        info!(
            request_id = %request_id,
            session_id = %session_id,
            tool_call_count = selection.tool_calls.len(),
            finish_reason = %selection.finish_reason,
            "llm stream tool-selection phase completed"
        );

        let maybe_memory_call = selection
            .tool_calls
            .iter()
            .find(|tool_call| tool_call.name == "query_memory")
            .cloned();

        if let Some(tool_call) = maybe_memory_call {
            let ctx = MemoryRequestContext::from_auth(
                request_id.to_string(),
                session_id.to_string(),
                trace_id.to_string(),
                state.config.llm.timeout_ms,
                auth_ctx,
            );
            snapshot = execute_memory_tool_call(
                state,
                DegradeRoute::ChatStream,
                request,
                &ctx,
                &snapshot,
                &tool_call,
            )
            .await;
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
        provider: String::new(),
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
