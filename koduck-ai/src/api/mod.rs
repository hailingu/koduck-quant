//! North-facing API handlers (chat/stream).

mod flow_canvas;
mod intent;
mod llm_flow;
mod memory_io;
mod prompt;
mod session;
mod streaming;
mod tool_resolution;

use std::{collections::HashMap, sync::Arc, time::Duration};

use axum::{
    extract::{Json, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, warn};
use uuid::Uuid;

use self::flow_canvas::{
    build_current_conversation_flow_answer, build_current_memory_entries_flow_answer,
};
use self::intent::{
    classify_execution_intent, request_with_execution_intent, ExecutionIntent, PresentationIntent,
    TargetIntent,
};
use self::llm_flow::{call_llm_generate, call_llm_stream, StreamLlmPlan};
use self::memory_io::{append_chat_turn_best_effort, load_memory_snapshot};
use self::session::{
    delete_session_impl, extract_or_create_request_id, extract_trace_id, normalize_session_id,
    normalize_uuid, resolve_session_id,
};
use self::streaming::{
    build_stream_error_event, build_stream_events, handle_stream_abort,
    spawn_generated_stream, stream_sse_response_with_watermark,
};
#[cfg(test)]
pub(super) use self::flow_canvas::build_memory_entry_flow_json;
#[cfg(test)]
pub(super) use self::intent::{parse_execution_intent_response, request_execution_intent};
#[cfg(test)]
pub(super) use self::tool_resolution::{
    extract_entity_like_query, resolve_knowledge_query, QueryKnowledgeToolArgs,
};

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::memory::{
        self, MemoryHit, MemoryRequestContext,
    },
    clients::knowledge::{self, KnowledgeQueryResult},
    clients::tool_execute,
    clients::tool_catalog,
    llm::ToolCall as ProviderToolCall,
    orchestrator::cancel::run_abortable_with_cleanup,
    plan::orchestrator::PlanOrchestrator,
    reliability::{
        degrade::DegradeRoute,
        error::{AppError, ErrorCode},
    },
    stream::sse::{ResumeCursor, StreamEventData},
};

const MAX_ALLOWED_TOKENS: u32 = 32_768;
const MEMORY_QUERY_TOP_K: i32 = 5;
const MAX_HISTORY_MESSAGES: usize = 20;
const MEMORY_PROMPT_TAIL: &str =
    "请结合下面历史命中与当前问题，自行判断哪些内容相关，再决定是否在回答中引用这些历史记忆。";

fn log_execution_intent(request_id: &str, session_id: &str, execution_intent: ExecutionIntent) {
    info!(
        request_id = %request_id,
        session_id = %session_id,
        action_intent = %execution_intent.action.as_str(),
        target_intent = %execution_intent.target.as_str(),
        presentation_intent = %execution_intent.presentation.as_str(),
        confidence = execution_intent.confidence,
        "execution intent classified"
    );
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatHistoryMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub memory_entry_id: Option<String>,
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
    pub sequence_num: i64,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolExecuteRequest {
    pub session_id: Option<String>,
    pub tool_name: String,
    pub tool_version: Option<String>,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlanEditEventRequest {
    #[serde(rename = "type", alias = "event_type")]
    pub event_type: String,
    #[serde(rename = "nodeId")]
    pub node_id: Option<String>,
    #[serde(default, alias = "payload")]
    pub patch: serde_json::Value,
    pub actor: Option<String>,
    pub sequence_num: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct PlanEditEventPayload {
    pub request_id: String,
    pub session_id: String,
    pub plan_id: String,
    pub event_id: String,
    pub sequence_num: i64,
    pub event_type: String,
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

    let execution_intent = match classify_execution_intent(
        &state,
        &request,
        &request_id,
        &session_id,
        &auth_ctx,
        &trace_id,
    )
    .await
    {
        Ok(intent) => intent,
        Err(err) => return api_error_response(err, request_id),
    };
    log_execution_intent(&request_id, &session_id, execution_intent);
    let request = request_with_execution_intent(&request, execution_intent);

    let direct_flow_answer =
        if let Some(answer) =
            build_current_memory_entries_flow_answer(&state, &memory_ctx, &request, execution_intent)
                .await
        {
            Some(answer)
        } else {
            build_current_conversation_flow_answer(&state, &memory_ctx, &request, execution_intent)
                .await
        };

    let response = if let Some(answer) = direct_flow_answer {
        ChatResponse {
            request_id: request_id.clone(),
            session_id: session_id.clone(),
            answer,
            model: request.model.clone().unwrap_or_else(|| "koduck-ai".to_string()),
            usage: TokenUsage {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
            degraded: false,
        }
    } else {
        match call_llm_generate(
            &state,
            &request,
            &memory_snapshot,
            &request_id,
            &session_id,
            &auth_ctx,
            &trace_id,
            execution_intent,
        )
        .await
        {
            Ok(ok) => ok,
            Err(err) => return api_error_response(err, request_id),
        }
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
        let execution_intent = match classify_execution_intent(
            &state,
            &request.chat,
            &request_id,
            &session_id,
            &auth_ctx,
            &trace_id,
        )
        .await
        {
            Ok(intent) => intent,
            Err(err) => {
                let err = err.with_request_id(request_id.clone());
                let generation_guard = session.request_guard().await;
                if let Err(enqueue_err) = session
                    .enqueue_event_if_current(
                        &generation_guard,
                        build_stream_error_event(&err, &request_id, &session_id),
                    )
                    .await
                {
                    warn!(
                        request_id = %request_id,
                        session_id = %session_id,
                        error = %enqueue_err,
                        "failed to enqueue execution intent classifier error event"
                    );
                }
                let high_watermark = resume_cursor.high_watermark(Some(&session));
                return stream_sse_response_with_watermark(session, request_id, high_watermark)
                    .await;
            }
        };
        log_execution_intent(&request_id, &session_id, execution_intent);
        let chat_request = request_with_execution_intent(&request.chat, execution_intent);
        let generation_guard = session.request_guard().await;
        if let Some(answer) = build_current_conversation_flow_answer(
            &state,
            &memory_ctx,
            &chat_request,
            execution_intent,
        )
        .await
        {
            append_chat_turn_best_effort(
                &state,
                DegradeRoute::ChatStream,
                &memory_ctx,
                &chat_request,
                &answer,
                chat_request.model.as_deref().unwrap_or_default(),
                "append_memory failed after conversation flow response; continuing",
            )
            .await;
            spawn_generated_stream(
                Arc::clone(&session),
                generation_guard,
                Duration::from_millis(state.config.stream.max_duration_ms),
                answer,
            );
            let high_watermark = resume_cursor.high_watermark(Some(&session));
            return stream_sse_response_with_watermark(session, request_id, high_watermark).await;
        }

        let plan_completion = if execution_intent.presentation == PresentationIntent::FlowCanvas
            && execution_intent.target != TargetIntent::Memory
            && execution_intent.target != TargetIntent::Conversation
        {
            let orchestrator = PlanOrchestrator::new(
                auth_ctx.tenant_id.clone(),
                session_id.clone(),
                request_id.clone(),
            );
            let plan = orchestrator.create_minimal_plan(
                chat_request.message.clone(),
                Some(auth_ctx.user_id.clone()),
            );
            let mut plan_events = Vec::new();
            let mut created_event = orchestrator.created_event(&plan);
            created_event.sequence_num = Some(1);
            plan_events.push(created_event);
            if let Some(first_node) = plan.nodes.first() {
                let mut node_event = orchestrator.node_started_event(&plan, first_node);
                node_event.sequence_num = Some(2);
                plan_events.push(node_event);
            }

            for plan_event in &plan_events {
                if let Err(err) = session
                    .enqueue_event_if_current(
                        &generation_guard,
                        plan_event.to_pending_stream_event(),
                    )
                    .await
                {
                    warn!(
                        request_id = %request_id,
                        session_id = %session_id,
                        error = %err,
                        event_type = %plan_event.kind.as_str(),
                        "failed to enqueue plan canvas event"
                    );
                }
            }

            let persist_state = Arc::clone(&state);
            let persist_ctx = memory_ctx.clone();
            let persist_plan = plan.clone();
            let persist_plan_events = plan_events.clone();
            tokio::spawn(async move {
                persist_plan_bootstrap_best_effort(
                    &persist_state,
                    &persist_ctx,
                    &persist_plan,
                    &persist_plan_events,
                )
                    .await;
            });

            plan
                .nodes
                .first()
                .cloned()
                .map(|first_node| (orchestrator, plan, first_node))
        } else {
            None
        };
        let stream_timeout = Duration::from_millis(state.config.stream.max_duration_ms);
        let llm_plan = match call_llm_stream(
            &state,
            &chat_request,
            memory_snapshot.as_ref(),
            &request_id,
            &session_id,
            &auth_ctx,
            &trace_id,
            execution_intent,
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
                        &chat_request,
                        &answer,
                        chat_request.model.as_deref().unwrap_or_default(),
                        "append_memory failed after direct tool-free response; continuing with generated stream",
                    )
                    .await;
                    if let Some((orchestrator, plan, node)) = plan_completion {
                        let mut node_event = orchestrator.node_completed_event(&plan, &node);
                        node_event.sequence_num = Some(3);
                        let mut plan_event = orchestrator.completed_event(&plan);
                        plan_event.sequence_num = Some(4);
                        let plan_events = vec![node_event, plan_event];

                        for pending_plan_event in &plan_events {
                            if let Err(err) = session
                                .enqueue_event_if_current(
                                    &generation_guard,
                                    pending_plan_event.to_pending_stream_event(),
                                )
                                .await
                            {
                                warn!(
                                    request_id = %request_id,
                                    session_id = %session_id,
                                    error = %err,
                                    event_type = %pending_plan_event.kind.as_str(),
                                    "failed to enqueue generated plan completion event"
                                );
                                break;
                            }
                        }

                        persist_plan_events_best_effort(&state, &memory_ctx, &plan_events).await;
                    }
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
                    let append_request = chat_request.clone();
                    let plan_completion = plan_completion.clone();
                    tokio::spawn(async move {
                        let mut plan_completion = plan_completion;
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
                                        if !ev.finish_reason.trim().is_empty() {
                                            if let Some((orchestrator, plan, node)) =
                                                plan_completion.take()
                                            {
                                                let mut node_event =
                                                    orchestrator.node_completed_event(&plan, &node);
                                                node_event.sequence_num = Some(3);
                                                let mut plan_event =
                                                    orchestrator.completed_event(&plan);
                                                plan_event.sequence_num = Some(4);
                                                let plan_events = vec![node_event, plan_event];

                                                for pending_plan_event in &plan_events {
                                                    if let Err(err) = stream_session
                                                        .enqueue_event_if_current(
                                                            &producer_guard,
                                                            pending_plan_event
                                                                .to_pending_stream_event(),
                                                        )
                                                        .await
                                                    {
                                                        info!(
                                                            request_id = %stream_session.request_id(),
                                                            session_id = %stream_session.session_id(),
                                                            error = %err,
                                                            event_type = %pending_plan_event.kind.as_str(),
                                                            "stream queue rejected plan completion event"
                                                        );
                                                        break;
                                                    }
                                                }

                                                let persist_state = Arc::clone(&append_state);
                                                let persist_ctx = append_ctx.clone();
                                                tokio::spawn(async move {
                                                    persist_plan_events_best_effort(
                                                        &persist_state,
                                                        &persist_ctx,
                                                        &plan_events,
                                                    )
                                                    .await;
                                                });
                                            }
                                        }
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
                                if let Some((orchestrator, plan, node)) = plan_completion.take() {
                                    let mut node_event =
                                        orchestrator.node_completed_event(&plan, &node);
                                    node_event.sequence_num = Some(3);
                                    let mut plan_event = orchestrator.completed_event(&plan);
                                    plan_event.sequence_num = Some(4);
                                    let plan_events = vec![node_event, plan_event];

                                    for pending_plan_event in &plan_events {
                                        let _ = stream_session
                                            .enqueue_event_if_current(
                                                &producer_guard,
                                                pending_plan_event.to_pending_stream_event(),
                                            )
                                            .await;
                                    }

                                    let persist_state = Arc::clone(&append_state);
                                    let persist_ctx = append_ctx.clone();
                                    tokio::spawn(async move {
                                        persist_plan_events_best_effort(
                                            &persist_state,
                                            &persist_ctx,
                                            &plan_events,
                                        )
                                        .await;
                                    });
                                }
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

pub async fn post_plan_event(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((raw_session_id, raw_plan_id)): Path<(String, String)>,
    Json(request): Json<PlanEditEventRequest>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
    let auth_ctx = match crate::auth::authenticate_bearer(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(err) => return api_error_response(err.with_request_id(request_id.clone()), request_id),
    };

    if !state.lifecycle.is_accepting_requests() {
        return api_error_response(
            AppError::new(ErrorCode::ServerBusy, "service is draining new requests")
                .with_request_id(request_id.clone()),
            request_id,
        );
    }

    let Some(session_id) = normalize_session_id(&raw_session_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "session_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };
    let Some(plan_id) = normalize_uuid(&raw_plan_id) else {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "plan_id is invalid")
                .with_request_id(request_id.clone()),
            request_id,
        );
    };
    if request.event_type.trim().is_empty() {
        return api_error_response(
            AppError::new(ErrorCode::InvalidArgument, "plan event type cannot be empty")
                .with_request_id(request_id.clone()),
            request_id,
        );
    }

    let trace_id = extract_trace_id(&headers);
    let memory_ctx = MemoryRequestContext::from_auth(
        request_id.clone(),
        session_id.clone(),
        trace_id,
        state.config.llm.timeout_ms,
        &auth_ctx,
    );
    let event_id = Uuid::new_v4().to_string();
    let sequence_num = request
        .sequence_num
        .unwrap_or_else(|| Utc::now().timestamp_millis());
    let actor = request.actor.clone().unwrap_or_else(|| auth_ctx.user_id.clone());
    if let Some(review_input) = build_proposal_review_input(&request, &actor) {
        if let Err(err) = memory::review_edit_proposal(&state, &memory_ctx, review_input).await {
            warn!(
                request_id = %request_id,
                session_id = %session_id,
                plan_id = %plan_id,
                error = %err,
                "failed to review memory edit proposal from plan event"
            );
            return api_error_response(err, request_id);
        }
    }

    let payload = json!({
        "type": request.event_type,
        "nodeId": request.node_id,
        "patch": request.patch,
        "actor": actor,
        "receivedAt": Utc::now().timestamp_millis(),
    });

    let persisted = memory::append_plan_event(
        &state,
        &memory_ctx,
        memory::AppendPlanEventInput {
            plan_id: plan_id.clone(),
            event_id: event_id.clone(),
            sequence_num,
            event_type: payload["type"].as_str().unwrap_or_default().to_string(),
            payload_json: payload.to_string(),
        },
    )
    .await;

    if let Err(err) = persisted {
        warn!(
            request_id = %request_id,
            session_id = %session_id,
            plan_id = %plan_id,
            error = %err,
            "failed to persist user plan edit event"
        );
        return api_error_response(err, request_id);
    }

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            code: ErrorCode::Ok.to_string(),
            message: "plan event accepted".to_string(),
            data: Some(PlanEditEventPayload {
                request_id,
                session_id,
                plan_id,
                event_id,
                sequence_num,
                event_type: payload["type"].as_str().unwrap_or_default().to_string(),
            }),
            error: None,
        }),
    )
        .into_response()
}

fn build_proposal_review_input(
    request: &PlanEditEventRequest,
    actor: &str,
) -> Option<memory::ReviewEditProposalInput> {
    let status = match request.event_type.as_str() {
        "proposal.approved" => "approved",
        "proposal.rejected" => "rejected",
        "proposal.edit_and_approve" => "approved",
        _ => return None,
    };
    let proposal_id = request
        .patch
        .get("proposalId")
        .or_else(|| request.patch.get("proposal_id"))
        .and_then(serde_json::Value::as_str)?;
    let after_json = request
        .patch
        .get("afterJson")
        .or_else(|| request.patch.get("after_json"))
        .map(serde_json::Value::to_string)
        .unwrap_or_default();

    Some(memory::ReviewEditProposalInput {
        proposal_id: proposal_id.to_string(),
        status: status.to_string(),
        reviewed_by: actor.to_string(),
        after_json,
        applied: false,
    })
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
            sequence_num: entry.sequence_num,
            metadata: entry.metadata,
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

    info!(
        request_id = %request_id,
        session_id = %raw_session_id,
        entry_id = %entry_id,
        "koduck-ai memory entry delete requested"
    );

    if let Err(err) = memory::delete_memory_entry(&state, &memory_ctx, &entry_id).await {
        warn!(
            request_id = %request_id,
            session_id = %raw_session_id,
            entry_id = %entry_id,
            error = %err,
            "koduck-ai memory entry delete failed"
        );
        return api_error_response(err, request_id);
    }

    info!(
        request_id = %request_id,
        session_id = %raw_session_id,
        entry_id = %entry_id,
        "koduck-ai memory entry delete succeeded"
    );

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

async fn persist_plan_bootstrap_best_effort(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    plan: &crate::plan::Plan,
    events: &[crate::plan::PlanEvent],
) {
    if let Err(err) = memory::create_plan(
        state,
        ctx,
        memory::CreatePlanInput {
            plan_id: plan.plan_id.clone(),
            goal: plan.goal.clone(),
            status: plan.status.as_str().to_string(),
            created_by: plan.created_by.clone().unwrap_or_else(|| ctx.user_id.clone()),
        },
    )
    .await
    {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            error = %err,
            "failed to persist plan; continuing stream without plan memory persistence"
        );
        return;
    }

    persist_plan_events_best_effort(state, ctx, events).await;
}

async fn persist_plan_events_best_effort(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    events: &[crate::plan::PlanEvent],
) {
    for event in events {
        if let Err(err) = memory::append_plan_event(
            state,
            ctx,
            memory::AppendPlanEventInput {
                plan_id: event.plan_id.clone(),
                event_id: event.event_id.clone(),
                sequence_num: event.sequence_num.unwrap_or_default() as i64,
                event_type: event.kind.as_str().to_string(),
                payload_json: event.payload.to_string(),
            },
        )
        .await
        {
            warn!(
                request_id = %ctx.request_id,
                session_id = %ctx.session_id,
                plan_id = %event.plan_id,
                event_type = %event.kind.as_str(),
                error = %err,
                "failed to persist plan event; continuing stream"
            );
        }
    }
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

#[cfg(test)]
#[path = "../tests/api/mod_tests.rs"]
mod tests;
