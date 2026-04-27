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
    plan::orchestrator::PlanOrchestrator,
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
const KNOWLEDGE_GENERIC_QUERIES: &[&str] = &[
    "知识库",
    "知识库吧",
    "从知识库开始",
    "那就知识库吧",
    "继续",
    "继续吧",
    "开始吧",
    "详细说说",
    "展开说说",
    "多说一点",
    "更多",
    "更多信息",
    "这个",
    "那个",
    "这里",
    "那里",
    "他",
    "她",
    "它",
];
const KNOWLEDGE_QUERY_PREFIXES: &[&str] = &[
    "关于",
    "介绍一下",
    "介绍",
    "讲讲",
    "说说",
    "聊聊",
    "查查",
    "查询",
    "搜索",
    "看看",
];
const KNOWLEDGE_QUERY_SUFFIXES: &[&str] = &[
    "是谁",
    "是什么",
    "有哪些",
    "有什么",
    "事迹",
    "生平",
    "政绩",
    "履历",
    "时间线",
    "timeline",
    "资料",
    "信息",
];

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

#[derive(Debug, Default)]
struct ToolResolutionResult {
    snapshot: ConversationContextSnapshot,
    direct_response: Option<crate::llm::GenerateResponse>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ActionIntent {
    Answer,
    Query,
    Research,
    Plan,
    Summarize,
}

impl ActionIntent {
    fn as_str(self) -> &'static str {
        match self {
            Self::Answer => "answer",
            Self::Query => "query",
            Self::Research => "research",
            Self::Plan => "plan",
            Self::Summarize => "summarize",
        }
    }

    fn from_str(value: &str) -> Self {
        match value.trim() {
            "query" => Self::Query,
            "research" => Self::Research,
            "plan" => Self::Plan,
            "summarize" => Self::Summarize,
            _ => Self::Answer,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TargetIntent {
    None,
    Knowledge,
    Memory,
    Conversation,
}

impl TargetIntent {
    fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Knowledge => "knowledge",
            Self::Memory => "memory",
            Self::Conversation => "conversation",
        }
    }

    fn from_str(value: &str) -> Self {
        match value.trim() {
            "knowledge" => Self::Knowledge,
            "memory" => Self::Memory,
            "conversation" => Self::Conversation,
            _ => Self::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PresentationIntent {
    Text,
    Table,
    FlowCanvas,
    Json,
}

impl PresentationIntent {
    fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Table => "table",
            Self::FlowCanvas => "flow_canvas",
            Self::Json => "json",
        }
    }

    fn from_str(value: &str) -> Self {
        match value.trim() {
            "table" => Self::Table,
            "flow_canvas" => Self::FlowCanvas,
            "json" => Self::Json,
            _ => Self::Text,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ExecutionIntent {
    action: ActionIntent,
    target: TargetIntent,
    presentation: PresentationIntent,
}

impl Default for ExecutionIntent {
    fn default() -> Self {
        Self {
            action: ActionIntent::Answer,
            target: TargetIntent::None,
            presentation: PresentationIntent::Text,
        }
    }
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
    let request = request_with_execution_intent(&request, execution_intent);

    let response = if let Some(answer) =
        build_current_memory_entries_flow_answer(&state, &memory_ctx, &request).await
    {
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
            Err(err) => return api_error_response(err, request_id),
        };
        let chat_request = request_with_execution_intent(&request.chat, execution_intent);
        let generation_guard = session.request_guard().await;
        let plan_completion = if flow_canvas_output_requested(&chat_request)
            && !memory_entry_flow_requested(&chat_request)
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

fn plan_canvas_enabled(request: &ChatRequest) -> bool {
    request
        .metadata
        .as_ref()
        .and_then(|metadata| metadata.get("enablePlanCanvas"))
        .and_then(|value| match value {
            serde_json::Value::Bool(value) => Some(*value),
            serde_json::Value::String(value) => value.parse::<bool>().ok(),
            _ => None,
        })
        .unwrap_or(false)
}

fn request_execution_intent(request: &ChatRequest) -> ExecutionIntent {
    let Some(metadata) = request.metadata.as_ref() else {
        return ExecutionIntent::default();
    };

    ExecutionIntent {
        action: metadata
            .get("actionIntent")
            .and_then(|value| value.as_str())
            .map(ActionIntent::from_str)
            .unwrap_or(ActionIntent::Answer),
        target: metadata
            .get("targetIntent")
            .and_then(|value| value.as_str())
            .map(TargetIntent::from_str)
            .unwrap_or(TargetIntent::None),
        presentation: metadata
            .get("presentationIntent")
            .and_then(|value| value.as_str())
            .map(PresentationIntent::from_str)
            .unwrap_or(PresentationIntent::Text),
    }
}

fn request_has_execution_intent(request: &ChatRequest) -> bool {
    request.metadata.as_ref().is_some_and(|metadata| {
        metadata.contains_key("actionIntent")
            || metadata.contains_key("targetIntent")
            || metadata.contains_key("presentationIntent")
    })
}

fn request_with_execution_intent(
    request: &ChatRequest,
    intent: ExecutionIntent,
) -> ChatRequest {
    let mut request = request.clone();
    let mut metadata = request.metadata.take().unwrap_or_default();
    metadata.insert(
        "actionIntent".to_string(),
        serde_json::Value::String(intent.action.as_str().to_string()),
    );
    metadata.insert(
        "targetIntent".to_string(),
        serde_json::Value::String(intent.target.as_str().to_string()),
    );
    metadata.insert(
        "presentationIntent".to_string(),
        serde_json::Value::String(intent.presentation.as_str().to_string()),
    );
    request.metadata = Some(metadata);
    request
}

fn flow_canvas_output_requested(request: &ChatRequest) -> bool {
    if !plan_canvas_enabled(request) {
        return false;
    }

    request_execution_intent(request).presentation == PresentationIntent::FlowCanvas
}

fn memory_entry_flow_requested(request: &ChatRequest) -> bool {
    if !plan_canvas_enabled(request) {
        return false;
    }

    let intent = request_execution_intent(request);
    intent.target == TargetIntent::Memory && intent.presentation == PresentationIntent::FlowCanvas
}

fn parse_execution_intent_response(content: &str) -> ExecutionIntent {
    let trimmed = content.trim();
    let json_text = if trimmed.starts_with('{') {
        trimmed
    } else if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        &trimmed[start..=end]
    } else {
        return ExecutionIntent::default();
    };

    serde_json::from_str::<serde_json::Value>(json_text)
        .ok()
        .map(|value| {
            let action = value
                .get("actionIntent")
                .or_else(|| value.get("action"))
                .and_then(|intent| intent.as_str())
                .map(ActionIntent::from_str)
                .unwrap_or(ActionIntent::Answer);
            let target = value
                .get("targetIntent")
                .or_else(|| value.get("target"))
                .and_then(|intent| intent.as_str())
                .map(TargetIntent::from_str)
                .unwrap_or(TargetIntent::None);
            let presentation = value
                .get("presentationIntent")
                .or_else(|| value.get("presentation"))
                .and_then(|intent| intent.as_str())
                .map(PresentationIntent::from_str)
                .unwrap_or(PresentationIntent::Text);

            ExecutionIntent {
                action,
                target,
                presentation,
            }
        })
        .unwrap_or_default()
}

async fn classify_execution_intent(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
) -> Result<ExecutionIntent, AppError> {
    if !plan_canvas_enabled(request) {
        return Ok(ExecutionIntent::default());
    }

    if request_has_execution_intent(request) {
        return Ok(request_execution_intent(request));
    }

    let mut user_context = String::new();
    if let Some(history) = request.history.as_ref() {
        for item in history.iter().rev().take(8).rev() {
            user_context.push_str(item.role.trim());
            user_context.push_str(": ");
            user_context.push_str(item.content.trim());
            user_context.push('\n');
        }
    }
    user_context.push_str("user: ");
    user_context.push_str(request.message.trim());

    let classifier_request = ProviderGenerateRequest {
        meta: RequestContext {
            request_id: format!("{}:execution-intent", request_id),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            trace_id: trace_id.to_string(),
            deadline_ms: state.config.llm.timeout_ms,
        },
        provider: request.provider.clone().unwrap_or_default(),
        model: request.model.clone().unwrap_or_default(),
        messages: vec![
            ProviderChatMessage {
                role: "system".to_string(),
                content: r#"你是 koduck-ai 的 execution intent router。你的任务是把当前用户请求拆成三个独立维度：动作、目标、表现形式。
只输出 JSON 对象，不要输出解释。JSON schema:
{"actionIntent":"answer|query|research|plan|summarize","targetIntent":"none|knowledge|memory|conversation","presentationIntent":"text|table|flow_canvas|json","confidence":0.0}

判定标准:
- actionIntent=answer: 直接回答、解释、说明。
- actionIntent=query: 查询或展示已有信息。
- actionIntent=research: 需要研究、分析、综合判断。
- actionIntent=plan: 生成计划、步骤、执行方案、工作流。
- actionIntent=summarize: 总结已有内容。
- targetIntent=memory: 目标是 memory entry、记忆条目、当前会话记忆、聊天 memory。
- targetIntent=knowledge: 目标是知识库、领域知识、资料。
- targetIntent=conversation: 目标是当前对话、聊天记录、上下文。
- targetIntent=none: 没有明确外部目标。
- presentationIntent=flow_canvas: 用户明确希望以 flow、canvas、流程图、节点图、可编辑流程展示。
- presentationIntent=table: 用户明确要求表格。
- presentationIntent=json: 用户明确要求 JSON。
- presentationIntent=text: 默认文本表达。
"#.to_string(),
                name: String::new(),
                metadata: HashMap::new(),
            },
            ProviderChatMessage {
                role: "user".to_string(),
                content: user_context,
                name: String::new(),
                metadata: HashMap::new(),
            },
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 80,
        tools: Vec::new(),
        response_format: "json_object".to_string(),
    };

    match state.llm_provider.generate(classifier_request).await {
        Ok(response) => Ok(parse_execution_intent_response(&response.message.content)),
        Err(err) => Err(err),
    }
}

fn flow_safe_snippet(content: &str) -> String {
    const MAX_CHARS: usize = 800;
    let normalized = content
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let mut snippet = normalized.chars().take(MAX_CHARS).collect::<String>();
    if normalized.chars().count() > MAX_CHARS {
        snippet.push('…');
    }
    snippet
}

fn build_memory_entry_flow_json(
    entries: Vec<(String, String, String, i64, i64)>,
) -> String {
    let mut previous_id: Option<String> = None;
    let steps = entries
        .into_iter()
        .filter(|(_, role, content, _, _)| {
            matches!(role.as_str(), "user" | "assistant") && !content.trim().is_empty()
        })
        .enumerate()
        .map(|(index, (entry_id, role, content, timestamp, sequence_num))| {
            let id = if entry_id.trim().is_empty() {
                format!("entry_{}", index + 1)
            } else {
                format!("entry_{}", entry_id.replace('-', "_"))
            };
            let depends_on = previous_id.iter().cloned().collect::<Vec<_>>();
            let step = json!({
                "id": id.clone(),
                "name": format!("{} #{}", if role == "user" { "用户消息" } else { "助手回复" }, sequence_num),
                "input": [
                    format!("entry_id={}", entry_id),
                    format!("role={}", role),
                    format!("timestamp={}", timestamp),
                ],
                "output": flow_safe_snippet(&content),
                "status": "completed",
                "editable": true,
                "dependsOn": depends_on,
            });
            previous_id = Some(id);
            step
        })
        .collect::<Vec<_>>();

    let payload = json!({
        "title": "当前聊天 memory entries",
        "version": "1.0",
        "steps": steps,
    });

    format!(
        "```json\n{}\n```",
        serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
    )
}

async fn build_current_memory_entries_flow_answer(
    state: &Arc<AppState>,
    ctx: &MemoryRequestContext,
    request: &ChatRequest,
) -> Option<String> {
    if !memory_entry_flow_requested(request) {
        return None;
    }

    if let Ok(entries) = memory::get_session_transcript(state, ctx).await {
        let transcript_entries = entries
            .into_iter()
            .map(|entry| {
                (
                    entry.entry_id,
                    entry.role,
                    entry.content,
                    entry.timestamp,
                    entry.sequence_num,
                )
            })
            .collect::<Vec<_>>();
        return Some(build_memory_entry_flow_json(transcript_entries));
    }

    let history_entries = request
        .history
        .as_ref()
        .map(|history| {
            history
                .iter()
                .enumerate()
                .map(|(index, item)| {
                    (
                        format!("history_{}", index + 1),
                        item.role.clone(),
                        item.content.clone(),
                        0,
                        (index + 1) as i64,
                    )
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(build_memory_entry_flow_json(history_entries))
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
                "{}. entity_id={} domain_class={} canonical_name={} entity_name={} match_type={} valid_window=[{} ~ {}] basic_profile_s3_uri={}",
                index + 1,
                hit.entity_id,
                if hit.domain_class.trim().is_empty() {
                    "-"
                } else {
                    hit.domain_class.as_str()
                },
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

    if knowledge.domain_class.trim().is_empty() {
        return Some(format!(
            "以下内容来自 koduck-knowledge 的跨 domain 候选实体搜索结果。当前尚未解析出 domain_class，因此还不能读取 basic profile 或 profile detail。\n你现在不要直接回答实体事实；请仅基于候选实体列表，引导用户回复想继续查看的 entity_id，或回复候选中的 canonical_name + domain_class 组合，以便下一轮继续查询。\n知识查询: query={} domain_class=<unresolved>\n\n候选实体:\n{}\n\n当前用户问题（请把它作为最终相关性判断依据）:\n{}\n如果候选实体为空，请明确说明知识库暂未命中，不要补造事实。",
            knowledge.query,
            candidates,
            user_message.trim()
        ));
    }

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

fn is_cjk_character(value: char) -> bool {
    matches!(
        value as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF | 0x2A700..=0x2B73F
    )
}

fn trim_query_noise(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch: char| {
            matches!(
                ch,
                ' '
                    | '\t'
                    | '\n'
                    | '\r'
                    | '，'
                    | ','
                    | '。'
                    | '.'
                    | '？'
                    | '?'
                    | '！'
                    | '!'
                    | '：'
                    | ':'
                    | '；'
                    | ';'
                    | '“'
                    | '”'
                    | '"'
                    | '\''
                    | '（'
                    | '）'
                    | '('
                    | ')'
            )
        })
        .trim_end_matches(|ch: char| matches!(ch, '吧' | '吗' | '呢' | '呀' | '啊'))
        .trim()
        .to_string()
}

fn is_generic_knowledge_query(value: &str) -> bool {
    let normalized = trim_query_noise(value);
    if normalized.is_empty() {
        return true;
    }

    let lowercase = normalized.to_ascii_lowercase();
    KNOWLEDGE_GENERIC_QUERIES.iter().any(|candidate| {
        normalized == *candidate || lowercase == candidate.to_ascii_lowercase()
    })
}

fn looks_like_entity_fragment(value: &str) -> bool {
    let normalized = trim_query_noise(value);
    if normalized.len() < 2 || normalized.len() > 48 || is_generic_knowledge_query(&normalized) {
        return false;
    }

    normalized
        .chars()
        .any(|ch| ch.is_ascii_alphanumeric() || is_cjk_character(ch))
}

fn extract_entity_like_query(value: &str) -> Option<String> {
    let trimmed = trim_query_noise(value);
    if trimmed.is_empty() || is_generic_knowledge_query(&trimmed) {
        return None;
    }

    for prefix in KNOWLEDGE_QUERY_PREFIXES {
        if let Some(candidate) = trimmed.strip_prefix(prefix) {
            let cleaned = trim_query_noise(candidate);
            if looks_like_entity_fragment(&cleaned) {
                return Some(cleaned);
            }
        }
    }

    if let Some((_, candidate)) = trimmed.split_once("关于") {
        let subject = trim_query_noise(
            candidate
                .split(['的', '，', ',', '。', '？', '?', '！', '!'])
                .next()
                .unwrap_or(candidate),
        );
        if looks_like_entity_fragment(&subject) {
            return Some(subject);
        }
    }

    for suffix in KNOWLEDGE_QUERY_SUFFIXES {
        if let Some(candidate) = trimmed.strip_suffix(suffix) {
            let cleaned = trim_query_noise(candidate);
            if looks_like_entity_fragment(&cleaned) {
                return Some(cleaned);
            }
        }
    }

    if looks_like_entity_fragment(&trimmed) {
        return Some(trimmed);
    }

    None
}

fn resolve_knowledge_query(request: &ChatRequest, args: &QueryKnowledgeToolArgs) -> Option<String> {
    if let Some(query) = args
        .query
        .as_deref()
        .and_then(extract_entity_like_query)
    {
        return Some(query);
    }

    if let Some(query) = extract_entity_like_query(&request.message) {
        return Some(query);
    }

    request
        .history
        .as_ref()
        .into_iter()
        .flatten()
        .rev()
        .find_map(|message| extract_entity_like_query(&message.content))
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
    let query = resolve_knowledge_query(request, &args).unwrap_or_default();
    let domain_class = args
        .domain_class
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| metadata_string(request, "domain_class"));

    if query.trim().is_empty() {
        warn!(
            request_id = %ctx.request_id,
            session_id = %ctx.session_id,
            tool_name = %tool_call.name,
            "query_knowledge skipped because entity query is unavailable"
        );
        return ConversationContextSnapshot::default();
    }

    if domain_class.trim().is_empty() {
        match knowledge::query_knowledge_candidates(state, &ctx.request_id, &query).await {
            Ok(result) => {
                if result.hits.is_empty() {
                    warn!(
                        request_id = %ctx.request_id,
                        session_id = %ctx.session_id,
                        tool_name = %tool_call.name,
                        query = %query,
                        "query_knowledge skipped because domain_class is unavailable and no candidate entities were found"
                    );
                    return ConversationContextSnapshot::default();
                }

                return ConversationContextSnapshot {
                    hits: Vec::new(),
                    knowledge: Some(KnowledgeContextSnapshot {
                        query,
                        domain_class: String::new(),
                        result,
                    }),
                    knowledge_profile_detail: None,
                };
            }
            Err(err) => {
                warn!(
                    request_id = %ctx.request_id,
                    session_id = %ctx.session_id,
                    tool_name = %tool_call.name,
                    error = %err,
                    "tool selection chose query_knowledge without domain_class and candidate search failed; continuing without structured knowledge"
                );
                return ConversationContextSnapshot::default();
            }
        }
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
    let direct_ctx = MemoryRequestContext::from_auth(
        request_id.to_string(),
        session_id.to_string(),
        trace_id.to_string(),
        state.config.llm.timeout_ms,
        auth_ctx,
    );
    if let Some(answer) = build_current_memory_entries_flow_answer(state, &direct_ctx, request).await
    {
        return Ok(StreamLlmPlan::ReadyAnswer(answer));
    }

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

    if flow_canvas_output_requested(request) {
        system_content.push_str(
            r#"

Koduck Flow Canvas 输出契约：
- 当用户要求生成 flow、canvas、流程图、可编辑流程或节点化计划时，你必须只输出一个 fenced JSON 代码块，语言标记必须是 json。
- 不要输出 Markdown 标题、说明文字、表格、Mermaid、ASCII 图、列表解释或 JSON 之外的任何文本。
- JSON 顶层必须是对象，字段必须包含 title、version、steps。
- steps 必须是数组；每个节点必须包含 id、name、input、output、status、editable、dependsOn。
- input 与 dependsOn 必须是字符串数组；output 必须是字符串；editable 必须是 true；status 只能是 pending、running、waiting_approval、completed、failed、skipped 之一。
- 用户要求几个研究步骤就生成几个研究步骤；如果用户要求信息不足时插入人工确认节点，只在确有信息不足时追加一个 status 为 waiting_approval 的人工确认节点。
- 节点 id 使用稳定英文 snake_case，例如 step_1、step_2、human_confirm、conclusion。

示例结构：
```json
{
  "title": "主题",
  "version": "1.0",
  "steps": [
    {
      "id": "step_1",
      "name": "背景梳理",
      "input": ["输入材料"],
      "output": "输出产物",
      "status": "pending",
      "editable": true,
      "dependsOn": []
    }
  ]
}
```
"#,
        );
    }

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

#[cfg(test)]
mod tests {
    use super::{
        extract_entity_like_query, resolve_knowledge_query, ChatHistoryMessage, ChatRequest,
        QueryKnowledgeToolArgs,
    };

    #[test]
    fn extract_entity_like_query_rejects_generic_follow_up() {
        assert_eq!(extract_entity_like_query("知识库吧"), None);
        assert_eq!(extract_entity_like_query("继续吧"), None);
    }

    #[test]
    fn extract_entity_like_query_keeps_fact_subject() {
        assert_eq!(
            extract_entity_like_query("我们有没有关于威廉的可靠信息？"),
            Some("威廉".to_string())
        );
        assert_eq!(
            extract_entity_like_query("介绍一下Wilhelm II"),
            Some("Wilhelm II".to_string())
        );
    }

    #[test]
    fn resolve_knowledge_query_falls_back_to_recent_history_entity() {
        let request = ChatRequest {
            session_id: None,
            message: "知识库吧".to_string(),
            history: Some(vec![
                ChatHistoryMessage {
                    role: "user".to_string(),
                    content: "我们有没有关于威廉的可靠信息？".to_string(),
                },
                ChatHistoryMessage {
                    role: "assistant".to_string(),
                    content: "我可以继续从知识库开始介绍。".to_string(),
                },
            ]),
            provider: None,
            model: None,
            temperature: None,
            max_tokens: None,
            retrieve_policy: None,
            metadata: None,
        };

        assert_eq!(
            resolve_knowledge_query(&request, &QueryKnowledgeToolArgs::default()),
            Some("威廉".to_string())
        );
    }
}
