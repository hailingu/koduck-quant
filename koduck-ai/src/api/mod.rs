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
use tracing::info;
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::AuthContext,
    clients::proto::{
        ChatMessage as LlmChatMessage, GenerateRequest as LlmGenerateRequest, LlmServiceClient,
        RequestMeta, StreamGenerateEvent as LlmStreamGenerateEvent,
    },
    reliability::error::{AppError, ErrorCode, UpstreamService},
    stream::sse::{PendingStreamEvent, ResumeCursor, StreamEventData},
};

const MAX_ALLOWED_TOKENS: u32 = 32_768;

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub session_id: Option<String>,
    pub message: String,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    #[allow(dead_code)]
    pub retrieve_policy: Option<String>,
    #[allow(dead_code)]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
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

pub async fn chat(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ChatRequest>,
) -> Response {
    let request_id = extract_or_create_request_id(&headers);
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

    info!(
        request_id = %request_id,
        session_id = %session_id,
        trace_id = %extract_trace_id(&headers),
        "chat request received"
    );

    let response = if state.config.llm.stub_enabled {
        let model = request
            .model
            .unwrap_or_else(|| state.config.llm.default_provider.clone());
        let answer = build_stub_answer(&request.message);
        let prompt_tokens = estimate_tokens(&request.message);
        let completion_tokens = estimate_tokens(&answer);
        ChatResponse {
            request_id: request_id.clone(),
            session_id: session_id.clone(),
            answer,
            model,
            usage: TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            },
            degraded: true,
        }
    } else {
        match call_llm_generate(&state, &request, &request_id, &session_id, &auth_ctx).await {
            Ok(ok) => ok,
            Err(err) => return api_error_response(err, request_id),
        }
    };

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
    let request_id = extract_or_create_request_id(&headers);
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
        last_event_id = ?resume_cursor.last_event_id,
        from_sequence_num = ?resume_cursor.from_sequence_num,
        "stream request received"
    );

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
        if state.config.llm.stub_enabled {
            let stream_session = Arc::clone(&session);
            let chunks = build_stream_chunks(&request.chat.message);
            tokio::spawn(async move {
                for chunk in chunks {
                    tokio::time::sleep(Duration::from_millis(120)).await;
                    if let Err(err) = stream_session
                        .enqueue_event(StreamEventData::delta(
                            stream_session.request_id().to_string(),
                            stream_session.session_id().to_string(),
                            chunk,
                        ))
                        .await
                    {
                        info!(
                            request_id = %stream_session.request_id(),
                            session_id = %stream_session.session_id(),
                            error = %err,
                            "stream queue rejected stub event"
                        );
                        stream_session
                            .force_shutdown(
                                ErrorCode::StreamTimeout.to_string(),
                                "stream queue backpressure timeout",
                            )
                            .await;
                        return;
                    }
                }
                let _ = stream_session
                    .enqueue_event(StreamEventData::done(
                        stream_session.request_id().to_string(),
                        stream_session.session_id().to_string(),
                        "stop",
                    ))
                    .await;
            });
        } else {
            let upstream = match call_llm_stream(&state, &request.chat, &request_id, &session_id, &auth_ctx).await {
                Ok(stream) => stream,
                Err(err) => return api_error_response(err, request_id),
            };
            let stream_session = Arc::clone(&session);
            tokio::spawn(async move {
                let mut upstream = upstream;
                while let Some(next) = upstream.next().await {
                    match next {
                        Ok(ev) => {
                            if let Err(err) = stream_session
                                .enqueue_event(build_stream_event(
                                    &ev,
                                    stream_session.request_id(),
                                    stream_session.session_id(),
                                ))
                                .await
                            {
                                info!(
                                    request_id = %stream_session.request_id(),
                                    session_id = %stream_session.session_id(),
                                    error = %err,
                                    "stream queue rejected upstream event"
                                );
                                stream_session
                                    .force_shutdown(
                                        ErrorCode::StreamTimeout.to_string(),
                                        "stream queue backpressure timeout",
                                    )
                                    .await;
                                break;
                            }
                        }
                        Err(err) => {
                            info!(
                                request_id = %stream_session.request_id(),
                                session_id = %stream_session.session_id(),
                                error = %err,
                                "llm stream item failed"
                            );
                            let _ = stream_session
                                .enqueue_event(StreamEventData::error(
                                    stream_session.request_id().to_string(),
                                    stream_session.session_id().to_string(),
                                    ErrorCode::StreamInterrupted.to_string(),
                                    "llm stream interrupted",
                                ))
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
                        .enqueue_event(StreamEventData::done(
                            stream_session.request_id().to_string(),
                            stream_session.session_id().to_string(),
                            "stop",
                        ))
                        .await;
                }
            });
        }
    }

    let high_watermark = resume_cursor.high_watermark(Some(&session));
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

    Ok(())
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
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| format!("sess_{}", Uuid::new_v4()))
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

fn build_stub_answer(user_message: &str) -> String {
    format!(
        "这是 koduck-ai 的联调 stub 回答（{}）。下游 LLM adapter 未就绪时可用于前后端联调。你输入的是：{}",
        Utc::now().to_rfc3339(),
        user_message.trim()
    )
}

fn build_stream_chunks(user_message: &str) -> Vec<String> {
    vec![
        "这是 koduck-ai 的流式联调 stub。".to_string(),
        "当前下游 LLM adapter 尚未就绪，先返回可验证的 SSE 事件格式。".to_string(),
        format!("收到你的问题：{}", user_message.trim()),
    ]
}

async fn call_llm_generate(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
) -> Result<ChatResponse, AppError> {
    let target = grpc_target_with_scheme(&state.config.llm.adapter_grpc_target);
    let channel = tonic::transport::Channel::from_shared(target.clone())
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("invalid llm grpc target: {e}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Llm)
        })?
        .connect()
        .await
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("failed to connect llm adapter: {e}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Llm)
        })?;

    let mut client = LlmServiceClient::new(channel);
    let req = tonic::Request::new(LlmGenerateRequest {
        meta: Some(RequestMeta {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            tenant_id: String::new(),
            trace_id: String::new(),
            idempotency_key: String::new(),
            deadline_ms: 0,
            api_version: "v1".to_string(),
        }),
        model: request
            .model
            .clone()
            .unwrap_or_else(|| state.config.llm.default_provider.clone()),
        messages: vec![LlmChatMessage {
            role: "user".to_string(),
            content: request.message.clone(),
            name: String::new(),
            metadata: std::collections::HashMap::new(),
        }],
        temperature: request.temperature.unwrap_or(0.2),
        top_p: 1.0,
        max_tokens: request.max_tokens.unwrap_or(2048) as i32,
        tools: vec![],
        response_format: String::new(),
        provider: state.config.llm.default_provider.clone(),
    });

    let resp = client.generate(req).await.map_err(|e| {
        AppError::new(
            ErrorCode::UpstreamUnavailable,
            format!("llm generate failed: {e}"),
        )
        .with_request_id(request_id.to_string())
        .with_upstream(UpstreamService::Llm)
    })?;
    let body = resp.into_inner();
    if !body.ok {
        return Err(AppError::new(
            ErrorCode::DependencyFailed,
            body.error
                .as_ref()
                .map(|v| v.message.clone())
                .unwrap_or_else(|| "llm adapter returned not ok".to_string()),
        )
        .with_request_id(request_id.to_string())
        .with_upstream(UpstreamService::Llm));
    }

    let answer = body
        .message
        .as_ref()
        .map(|m| m.content.clone())
        .unwrap_or_default();
    let usage = body.usage.as_ref();
    Ok(ChatResponse {
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
        answer,
        model: request
            .model
            .clone()
            .unwrap_or_else(|| state.config.llm.default_provider.clone()),
        usage: TokenUsage {
            prompt_tokens: usage.map(|u| u.prompt_tokens as u32).unwrap_or(0),
            completion_tokens: usage.map(|u| u.completion_tokens as u32).unwrap_or(0),
            total_tokens: usage.map(|u| u.total_tokens as u32).unwrap_or(0),
        },
        degraded: false,
    })
}

async fn call_llm_stream(
    state: &Arc<AppState>,
    request: &ChatRequest,
    request_id: &str,
    session_id: &str,
    auth_ctx: &AuthContext,
) -> Result<tonic::Streaming<LlmStreamGenerateEvent>, AppError> {
    let target = grpc_target_with_scheme(&state.config.llm.adapter_grpc_target);
    let channel = tonic::transport::Channel::from_shared(target.clone())
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("invalid llm grpc target: {e}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Llm)
        })?
        .connect()
        .await
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("failed to connect llm adapter: {e}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Llm)
        })?;
    let mut client = LlmServiceClient::new(channel);
    let req = tonic::Request::new(LlmGenerateRequest {
        meta: Some(RequestMeta {
            request_id: request_id.to_string(),
            session_id: session_id.to_string(),
            user_id: auth_ctx.user_id.clone(),
            tenant_id: String::new(),
            trace_id: String::new(),
            idempotency_key: String::new(),
            deadline_ms: 0,
            api_version: "v1".to_string(),
        }),
        model: request
            .model
            .clone()
            .unwrap_or_else(|| state.config.llm.default_provider.clone()),
        messages: vec![LlmChatMessage {
            role: "user".to_string(),
            content: request.message.clone(),
            name: String::new(),
            metadata: std::collections::HashMap::new(),
        }],
        temperature: request.temperature.unwrap_or(0.2),
        top_p: 1.0,
        max_tokens: request.max_tokens.unwrap_or(2048) as i32,
        tools: vec![],
        response_format: String::new(),
        provider: state.config.llm.default_provider.clone(),
    });
    let stream = client
        .stream_generate(req)
        .await
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("llm stream_generate failed: {e}"),
            )
            .with_request_id(request_id.to_string())
            .with_upstream(UpstreamService::Llm)
        })?
        .into_inner();
    Ok(stream)
}

fn build_stream_event(
    ev: &LlmStreamGenerateEvent,
    request_id: &str,
    session_id: &str,
) -> PendingStreamEvent {
    let event_type = if ev.finish_reason.is_empty() { "delta" } else { "done" };
    let payload = if event_type == "done" {
        json!({ "finish_reason": &ev.finish_reason })
    } else {
        json!({ "text": &ev.delta })
    };

    PendingStreamEvent {
        event_type: event_type.to_string(),
        payload,
        event_id: Some(ev.event_id.clone()),
        sequence_num: Some(ev.sequence_num as u32),
        request_id: request_id.to_string(),
        session_id: session_id.to_string(),
    }
}

fn grpc_target_with_scheme(raw: &str) -> String {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("http://{raw}")
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
