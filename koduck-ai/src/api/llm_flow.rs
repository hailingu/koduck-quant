use std::sync::Arc;

use tracing::info;

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::{memory::MemoryRequestContext, tool_catalog},
    reliability::{
        degrade::DegradeRoute,
        error::{AppError, ErrorCode, UpstreamService},
        retry_budget::RetryDirective,
    },
};

use super::{
    flow_canvas::build_current_memory_entries_flow_answer,
    format_tool_call_names, is_first_class_tool,
    intent::ExecutionIntent,
    prompt::build_provider_generate_request,
    tool_resolution::{
        execute_supported_tool_call, resolve_tool_call, review_memory_hits_for_stream,
    },
    ChatRequest, ChatResponse, ConversationContextSnapshot, TokenUsage,
};

pub(super) enum StreamLlmPlan {
    Upstream(crate::llm::ProviderEventStream),
    ReadyAnswer(String),
}

pub(super) async fn call_llm_generate(
    state: &Arc<AppState>,
    request: &ChatRequest,
    memory_snapshot: &ConversationContextSnapshot,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    execution_intent: ExecutionIntent,
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
        execution_intent,
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
                    return Err(AppError::new(
                        ErrorCode::UpstreamUnavailable,
                        "retry timeout budget exhausted",
                    )
                    .with_request_id(request_id.to_string())
                    .with_upstream(UpstreamService::Llm)
                    .with_retryable(false))
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
            execution_intent,
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

    let answer = body.message.content.clone();
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

pub(super) async fn call_llm_stream(
    state: &Arc<AppState>,
    request: &ChatRequest,
    memory_snapshot: Option<&ConversationContextSnapshot>,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
    trace_id: &str,
    execution_intent: ExecutionIntent,
) -> Result<StreamLlmPlan, AppError> {
    const MAX_TOOL_ROUNDS: usize = 3;
    let direct_ctx = MemoryRequestContext::from_auth(
        request_id.to_string(),
        session_id.to_string(),
        trace_id.to_string(),
        state.config.llm.timeout_ms,
        auth_ctx,
    );
    if let Some(answer) =
        build_current_memory_entries_flow_answer(state, &direct_ctx, request, execution_intent).await
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
            discovered_tools.iter().cloned().collect(),
            execution_intent,
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
                    || next_snapshot.knowledge_profile_detail.is_some()
                    || next_snapshot.knowledge_profile_history.is_some()
                    || next_snapshot.knowledge_temporal_coverage.is_some());
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
                    return Err(AppError::new(
                        ErrorCode::UpstreamUnavailable,
                        "retry timeout budget exhausted",
                    )
                    .with_request_id(request_id.to_string())
                    .with_upstream(UpstreamService::Llm)
                    .with_retryable(false))
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
            execution_intent,
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
