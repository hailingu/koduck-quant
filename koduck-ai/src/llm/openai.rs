//! OpenAI-compatible direct LLM provider adapters.

use std::{
    collections::VecDeque,
    pin::Pin,
};

use async_trait::async_trait;
use futures::{Stream, StreamExt};
use hyper::body::Bytes;
use reqwest::Method;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::reliability::error::{AppError, ErrorCode, UpstreamService};

use super::{
    errors::{map_http_status_error, map_http_transport_error, map_malformed_stream_chunk, map_stream_eof},
    http::{JsonRequestOptions, LlmHttpClient, SseEvent, SseStreamParser},
    provider::{LlmProvider, ProviderEventStream},
    types::{
        ChatMessage, CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
        ListModelsRequest, ModelInfo, StreamEvent, TokenUsage, ToolDefinition,
    },
};

const OPENAI_PROFILE: ProviderProfile = ProviderProfile {
    provider: "openai",
    default_base_url: "https://api.openai.com/v1",
    models_path: "/models",
    chat_completions_path: "/chat/completions",
};

#[derive(Clone)]
pub struct OpenAiProvider {
    inner: OpenAiCompatibleProvider,
}

impl OpenAiProvider {
    pub fn new(
        api_key: impl Into<String>,
        base_url: Option<String>,
        default_model: impl Into<String>,
    ) -> Result<Self, AppError> {
        Ok(Self {
            inner: OpenAiCompatibleProvider::new(
                OPENAI_PROFILE,
                api_key.into(),
                base_url,
                default_model.into(),
            )?,
        })
    }
}

#[async_trait]
impl LlmProvider for OpenAiProvider {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        self.inner.generate_inner(req).await
    }

    async fn stream_generate(&self, req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        self.inner.stream_generate_inner(req).await
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        self.inner.list_models_inner(req).await
    }

    async fn count_tokens(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        self.inner.count_tokens_inner(req).await
    }
}

#[derive(Clone, Copy)]
pub(crate) struct ProviderProfile {
    pub provider: &'static str,
    pub default_base_url: &'static str,
    pub models_path: &'static str,
    pub chat_completions_path: &'static str,
}

#[derive(Clone)]
pub(crate) struct OpenAiCompatibleProvider {
    profile: ProviderProfile,
    http: LlmHttpClient,
    api_key: String,
    base_url: String,
    default_model: String,
}

impl OpenAiCompatibleProvider {
    pub(crate) fn new(
        profile: ProviderProfile,
        api_key: String,
        base_url: Option<String>,
        default_model: String,
    ) -> Result<Self, AppError> {
        if api_key.trim().is_empty() {
            return Err(AppError::new(
                ErrorCode::InvalidArgument,
                format!("{} api_key cannot be empty", profile.provider),
            ));
        }
        if default_model.trim().is_empty() {
            return Err(AppError::new(
                ErrorCode::InvalidArgument,
                format!("{} default_model cannot be empty", profile.provider),
            ));
        }

        Ok(Self {
            profile,
            http: LlmHttpClient::new()?,
            api_key,
            base_url: sanitize_base_url(base_url.as_deref(), profile.default_base_url),
            default_model,
        })
    }

    pub(crate) async fn generate_inner(
        &self,
        req: GenerateRequest,
    ) -> Result<GenerateResponse, AppError> {
        let model = self.resolve_model(&req.model);
        let body = build_chat_completions_request(&req, &model, false);
        let options =
            JsonRequestOptions::json(self.chat_completions_url(), &req.meta, Some(self.api_key.clone()));
        let response = self
            .http
            .post_json(UpstreamService::Llm, &options, &body)
            .await?;

        let status = response.status();
        let headers = response.headers().clone();
        let text = response
            .text()
            .await
            .map_err(|err| map_http_transport_error(UpstreamService::Llm, req.meta.request_id.clone(), &err))?;

        if !status.is_success() {
            return Err(map_http_status_error(
                UpstreamService::Llm,
                req.meta.request_id,
                status,
                &headers,
                &text,
            ));
        }

        let payload: OpenAiGenerateResponse = serde_json::from_str(&text).map_err(|err| {
            AppError::new(
                ErrorCode::DependencyFailed,
                "llm provider returned an invalid generate response body",
            )
            .with_request_id(req.meta.request_id.clone())
            .with_upstream(UpstreamService::Llm)
            .with_source(err)
        })?;

        parse_generate_response(self.profile.provider, &model, payload, &req.meta.request_id)
    }

    pub(crate) async fn stream_generate_inner(
        &self,
        req: GenerateRequest,
    ) -> Result<ProviderEventStream, AppError> {
        let model = self.resolve_model(&req.model);
        let body = build_chat_completions_request(&req, &model, true);
        let options = JsonRequestOptions::json(
            self.chat_completions_url(),
            &req.meta,
            Some(self.api_key.clone()),
        )
        .event_stream();
        let response = self
            .http
            .post_json(UpstreamService::Llm, &options, &body)
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let headers = response.headers().clone();
            let text = response
                .text()
                .await
                .map_err(|err| map_http_transport_error(UpstreamService::Llm, req.meta.request_id.clone(), &err))?;
            return Err(map_http_status_error(
                UpstreamService::Llm,
                req.meta.request_id,
                status,
                &headers,
                &text,
            ));
        }

        let state = StreamState {
            provider: self.profile.provider.to_string(),
            model,
            request_id: req.meta.request_id,
            inner: Box::pin(response.bytes_stream()),
            parser: SseStreamParser::default(),
            pending: VecDeque::new(),
            sequence_num: 0,
            saw_terminal_event: false,
        };

        let stream = futures::stream::try_unfold(state, |mut state| async move {
            loop {
                if let Some(event) = state.pending.pop_front() {
                    return Ok(Some((event, state)));
                }

                match state.inner.next().await {
                    Some(Ok(chunk)) => {
                        let events = state.parser.push(&state.request_id, &chunk)?;
                        for event in events {
                            state.ingest_sse_event(event)?;
                        }
                    }
                    Some(Err(err)) => {
                        return Err(map_http_transport_error(
                            UpstreamService::Llm,
                            state.request_id.clone(),
                            &err,
                        ))
                    }
                    None => {
                        let final_events = state.parser.finish(&state.request_id)?;
                        for event in final_events {
                            state.ingest_sse_event(event)?;
                        }

                        if let Some(event) = state.pending.pop_front() {
                            return Ok(Some((event, state)));
                        }

                        if state.saw_terminal_event {
                            return Ok(None);
                        }

                        return Err(map_stream_eof(
                            UpstreamService::Llm,
                            state.request_id,
                            "stream completion",
                        ));
                    }
                }
            }
        });

        Ok(Box::pin(stream))
    }

    pub(crate) async fn list_models_inner(
        &self,
        req: ListModelsRequest,
    ) -> Result<Vec<ModelInfo>, AppError> {
        let options = JsonRequestOptions::json(
            self.models_url(),
            &req.meta,
            Some(self.api_key.clone()),
        );
        let request = self
            .http
            .build_request::<Value>(Method::GET, &options, None)?;
        let response = self
            .http
            .execute(UpstreamService::Llm, &req.meta.request_id, request)
            .await?;

        let status = response.status();
        let headers = response.headers().clone();
        let text = response
            .text()
            .await
            .map_err(|err| map_http_transport_error(UpstreamService::Llm, req.meta.request_id.clone(), &err))?;

        if !status.is_success() {
            return Err(map_http_status_error(
                UpstreamService::Llm,
                req.meta.request_id,
                status,
                &headers,
                &text,
            ));
        }

        let payload: OpenAiModelsResponse = serde_json::from_str(&text).map_err(|err| {
            AppError::new(
                ErrorCode::DependencyFailed,
                "llm provider returned an invalid models response body",
            )
            .with_request_id(req.meta.request_id.clone())
            .with_upstream(UpstreamService::Llm)
            .with_source(err)
        })?;

        Ok(payload
            .data
            .into_iter()
            .map(|model| ModelInfo {
                id: model.id.clone(),
                provider: self.profile.provider.to_string(),
                display_name: model.id,
                max_context_tokens: 0,
                max_output_tokens: 0,
                supports_streaming: true,
                supports_tools: true,
                supported_features: vec![
                    "chat".to_string(),
                    "stream".to_string(),
                    "count_tokens".to_string(),
                ],
            })
            .collect())
    }

    pub(crate) async fn count_tokens_inner(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        Ok(CountTokensResponse {
            provider: self.profile.provider.to_string(),
            model: self.resolve_model(&req.model),
            total_tokens: estimate_tokens(&req.messages),
        })
    }

    fn resolve_model(&self, requested: &str) -> String {
        if requested.trim().is_empty() {
            self.default_model.clone()
        } else {
            requested.to_string()
        }
    }

    fn models_url(&self) -> String {
        format!("{}{}", self.base_url, self.profile.models_path)
    }

    fn chat_completions_url(&self) -> String {
        format!("{}{}", self.base_url, self.profile.chat_completions_path)
    }
}

#[async_trait]
impl LlmProvider for OpenAiCompatibleProvider {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        self.generate_inner(req).await
    }

    async fn stream_generate(&self, req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        self.stream_generate_inner(req).await
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        self.list_models_inner(req).await
    }

    async fn count_tokens(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        self.count_tokens_inner(req).await
    }
}

struct StreamState {
    provider: String,
    model: String,
    request_id: String,
    inner: Pin<Box<dyn Stream<Item = Result<Bytes, reqwest::Error>> + Send>>,
    parser: SseStreamParser,
    pending: VecDeque<StreamEvent>,
    sequence_num: u32,
    saw_terminal_event: bool,
}

impl StreamState {
    fn ingest_sse_event(&mut self, event: SseEvent) -> Result<(), AppError> {
        if event.data.trim() == "[DONE]" {
            self.saw_terminal_event = true;
            return Ok(());
        }

        let chunk: OpenAiStreamChunk = serde_json::from_str(&event.data).map_err(|_| {
            map_malformed_stream_chunk(
                UpstreamService::Llm,
                self.request_id.clone(),
                "json",
            )
        })?;

        if let Some(unified) = parse_stream_chunk(
            &self.provider,
            &self.model,
            event.id,
            &mut self.sequence_num,
            &mut self.saw_terminal_event,
            chunk,
        )? {
            self.pending.push_back(unified);
        }

        Ok(())
    }
}

fn build_chat_completions_request(
    req: &GenerateRequest,
    model: &str,
    stream: bool,
) -> Value {
    let mut payload = json!({
        "model": model,
        "messages": req.messages.iter().map(message_to_wire).collect::<Vec<_>>(),
        "temperature": req.temperature,
        "top_p": req.top_p,
        "max_tokens": req.max_tokens,
        "stream": stream,
    });

    if !req.tools.is_empty() {
        payload["tools"] = Value::Array(req.tools.iter().map(tool_to_wire).collect());
    }

    if !req.response_format.trim().is_empty() {
        payload["response_format"] = response_format_to_wire(&req.response_format);
    }

    if stream {
        payload["stream_options"] = json!({ "include_usage": true });
    }

    payload
}

fn message_to_wire(message: &ChatMessage) -> Value {
    let mut value = json!({
        "role": message.role,
        "content": message.content,
    });

    if !message.name.trim().is_empty() {
        value["name"] = Value::String(message.name.clone());
    }

    if !message.metadata.is_empty() {
        value["metadata"] = serde_json::to_value(&message.metadata).unwrap_or(Value::Null);
    }

    value
}

fn tool_to_wire(tool: &ToolDefinition) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": parse_json_or_string(&tool.input_schema),
        }
    })
}

fn response_format_to_wire(raw: &str) -> Value {
    serde_json::from_str::<Value>(raw).unwrap_or_else(|_| json!({ "type": raw }))
}

fn parse_generate_response(
    provider: &str,
    model: &str,
    payload: OpenAiGenerateResponse,
    request_id: &str,
) -> Result<GenerateResponse, AppError> {
    let choice = payload.choices.into_iter().next().ok_or_else(|| {
        AppError::new(
            ErrorCode::DependencyFailed,
            "llm provider returned an empty choices array",
        )
        .with_request_id(request_id.to_string())
        .with_upstream(UpstreamService::Llm)
    })?;

    Ok(GenerateResponse {
        provider: provider.to_string(),
        model: payload.model.unwrap_or_else(|| model.to_string()),
        message: ChatMessage {
            role: choice.message.role.unwrap_or_else(|| "assistant".to_string()),
            content: value_to_text(&choice.message.content),
            name: String::new(),
            metadata: Default::default(),
        },
        finish_reason: choice.finish_reason.unwrap_or_default(),
        usage: payload.usage.map(usage_to_unified),
    })
}

fn parse_stream_chunk(
    provider: &str,
    fallback_model: &str,
    event_id: Option<String>,
    sequence_num: &mut u32,
    saw_terminal_event: &mut bool,
    payload: OpenAiStreamChunk,
) -> Result<Option<StreamEvent>, AppError> {
    let choice = payload.choices.into_iter().next();
    let delta = choice
        .as_ref()
        .and_then(|choice| choice.delta.as_ref())
        .map(delta_to_text)
        .unwrap_or_default();
    let finish_reason = choice
        .as_ref()
        .and_then(|choice| choice.finish_reason.clone())
        .unwrap_or_default();
    let usage = payload.usage.map(usage_to_unified);

    if !finish_reason.is_empty() {
        *saw_terminal_event = true;
    }

    if delta.is_empty() && finish_reason.is_empty() && usage.is_none() {
        return Ok(None);
    }

    *sequence_num += 1;

    Ok(Some(StreamEvent {
        provider: provider.to_string(),
        model: payload.model.unwrap_or_else(|| fallback_model.to_string()),
        event_id: event_id
            .or(payload.id)
            .unwrap_or_else(|| format!("evt-{}", *sequence_num)),
        sequence_num: *sequence_num,
        delta,
        finish_reason,
        usage,
    }))
}

fn delta_to_text(delta: &OpenAiChoiceDelta) -> String {
    delta.content.as_ref().map(value_to_text).unwrap_or_default()
}

fn usage_to_unified(usage: OpenAiUsage) -> TokenUsage {
    TokenUsage {
        prompt_tokens: usage.prompt_tokens.max(0) as u32,
        completion_tokens: usage.completion_tokens.max(0) as u32,
        total_tokens: usage.total_tokens.max(0) as u32,
    }
}

fn value_to_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .filter_map(|item| match item {
                Value::String(text) => Some(text.clone()),
                Value::Object(object) => object
                    .get("text")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join(""),
        other => other.to_string(),
    }
}

fn parse_json_or_string(raw: &str) -> Value {
    serde_json::from_str::<Value>(raw).unwrap_or_else(|_| Value::String(raw.to_string()))
}

fn sanitize_base_url(base_url: Option<&str>, fallback: &str) -> String {
    let raw = base_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback);
    raw.trim_end_matches('/').to_string()
}

fn estimate_tokens(messages: &[ChatMessage]) -> u32 {
    messages
        .iter()
        .map(|message| {
            let text_len = message.content.chars().count() as u32;
            let name_bonus = (!message.name.is_empty()) as u32;
            (text_len / 4).max(1) + name_bonus + 4
        })
        .sum::<u32>()
        .max(1)
}

#[derive(Debug, Deserialize)]
struct OpenAiGenerateResponse {
    model: Option<String>,
    choices: Vec<OpenAiGenerateChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiGenerateChoice {
    message: OpenAiResponseMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponseMessage {
    role: Option<String>,
    #[serde(default)]
    content: Value,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    prompt_tokens: i64,
    completion_tokens: i64,
    total_tokens: i64,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamChunk {
    id: Option<String>,
    model: Option<String>,
    #[serde(default)]
    choices: Vec<OpenAiStreamChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamChoice {
    delta: Option<OpenAiChoiceDelta>,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoiceDelta {
    content: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelsResponse {
    data: Vec<OpenAiModelEntry>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModelEntry {
    id: String,
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serde_json::json;

    use super::{
        build_chat_completions_request, parse_generate_response, parse_stream_chunk,
        OpenAiGenerateResponse, OpenAiGenerateChoice, OpenAiResponseMessage, OpenAiStreamChunk,
        OpenAiStreamChoice, OpenAiChoiceDelta, OpenAiUsage,
    };
    use crate::llm::types::{ChatMessage, GenerateRequest, RequestContext, ToolDefinition};

    fn sample_request() -> GenerateRequest {
        GenerateRequest {
            meta: RequestContext {
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
                user_id: "user-1".to_string(),
                trace_id: "trace-1".to_string(),
                deadline_ms: 1500,
            },
            provider: "openai".to_string(),
            model: "gpt-4.1-mini".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "hello".to_string(),
                name: String::new(),
                metadata: HashMap::new(),
            }],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 256,
            tools: vec![ToolDefinition {
                name: "search".to_string(),
                description: "Search docs".to_string(),
                input_schema: r#"{"type":"object"}"#.to_string(),
            }],
            response_format: "json_object".to_string(),
        }
    }

    #[test]
    fn builds_openai_wire_request() {
        let body = build_chat_completions_request(&sample_request(), "gpt-4.1-mini", true);

        assert_eq!(body["model"], "gpt-4.1-mini");
        assert_eq!(body["stream"], true);
        assert_eq!(body["messages"][0]["content"], "hello");
        assert_eq!(body["tools"][0]["function"]["name"], "search");
        assert_eq!(body["response_format"]["type"], "json_object");
        assert_eq!(body["stream_options"]["include_usage"], true);
    }

    #[test]
    fn parses_non_stream_response_into_unified_shape() {
        let payload = OpenAiGenerateResponse {
            model: Some("gpt-4.1-mini".to_string()),
            choices: vec![OpenAiGenerateChoice {
                message: OpenAiResponseMessage {
                    role: Some("assistant".to_string()),
                    content: json!("world"),
                },
                finish_reason: Some("stop".to_string()),
            }],
            usage: Some(OpenAiUsage {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            }),
        };

        let response =
            parse_generate_response("openai", "fallback-model", payload, "req-1").unwrap();

        assert_eq!(response.provider, "openai");
        assert_eq!(response.model, "gpt-4.1-mini");
        assert_eq!(response.message.content, "world");
        assert_eq!(response.finish_reason, "stop");
        assert_eq!(response.usage.unwrap().total_tokens, 15);
    }

    #[test]
    fn parses_stream_chunks_into_unified_events() {
        let mut sequence_num = 0;
        let mut saw_terminal_event = false;
        let payload = OpenAiStreamChunk {
            id: Some("chunk-1".to_string()),
            model: Some("gpt-4.1-mini".to_string()),
            choices: vec![OpenAiStreamChoice {
                delta: Some(OpenAiChoiceDelta {
                    content: Some(json!("hello")),
                }),
                finish_reason: None,
            }],
            usage: None,
        };

        let event = parse_stream_chunk(
            "openai",
            "fallback-model",
            Some("evt-1".to_string()),
            &mut sequence_num,
            &mut saw_terminal_event,
            payload,
        )
        .unwrap()
        .unwrap();

        assert_eq!(event.sequence_num, 1);
        assert_eq!(event.delta, "hello");
        assert!(!saw_terminal_event);
    }

    #[test]
    fn parses_terminal_stream_chunk_with_usage() {
        let mut sequence_num = 0;
        let mut saw_terminal_event = false;
        let payload = OpenAiStreamChunk {
            id: Some("chunk-2".to_string()),
            model: None,
            choices: vec![OpenAiStreamChoice {
                delta: Some(OpenAiChoiceDelta { content: None }),
                finish_reason: Some("stop".to_string()),
            }],
            usage: Some(OpenAiUsage {
                prompt_tokens: 7,
                completion_tokens: 9,
                total_tokens: 16,
            }),
        };

        let event = parse_stream_chunk(
            "openai",
            "fallback-model",
            None,
            &mut sequence_num,
            &mut saw_terminal_event,
            payload,
        )
        .unwrap()
        .unwrap();

        assert_eq!(event.model, "fallback-model");
        assert_eq!(event.finish_reason, "stop");
        assert_eq!(event.usage.unwrap().total_tokens, 16);
        assert!(saw_terminal_event);
    }
}
