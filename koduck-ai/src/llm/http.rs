//! Shared reqwest client, header injection, and SSE chunk parsing utilities for direct LLM providers.

use std::time::Duration;

use reqwest::{
    header::{
        HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE,
    },
    Client, Method, Request, Response,
};
use serde::Serialize;

use crate::reliability::error::{AppError, ErrorCode, UpstreamService};

use super::{
    errors::{map_http_transport_error, map_malformed_stream_chunk, map_stream_eof},
    types::RequestContext,
};

const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");
const TRACEPARENT: HeaderName = HeaderName::from_static("traceparent");

#[derive(Clone)]
pub struct LlmHttpClient {
    inner: Client,
}

#[derive(Clone)]
pub struct JsonRequestOptions {
    pub url: String,
    pub request_id: String,
    pub deadline_ms: u64,
    pub bearer_token: Option<String>,
    pub traceparent: Option<String>,
    pub accept: &'static str,
    pub extra_headers: HeaderMap,
}

impl JsonRequestOptions {
    pub fn json(url: impl Into<String>, meta: &RequestContext, bearer_token: Option<String>) -> Self {
        Self {
            url: url.into(),
            request_id: meta.request_id.clone(),
            deadline_ms: meta.deadline_ms,
            bearer_token,
            traceparent: (!meta.trace_id.trim().is_empty()).then(|| meta.trace_id.clone()),
            accept: "application/json",
            extra_headers: HeaderMap::new(),
        }
    }

    pub fn event_stream(mut self) -> Self {
        self.accept = "text/event-stream";
        self
    }

    pub fn with_extra_header(mut self, name: HeaderName, value: HeaderValue) -> Self {
        self.extra_headers.insert(name, value);
        self
    }
}

impl LlmHttpClient {
    pub fn new() -> Result<Self, AppError> {
        let inner = Client::builder()
            .use_rustls_tls()
            .connect_timeout(Duration::from_secs(3))
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(16)
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .map_err(|err| {
                AppError::new(
                    ErrorCode::InternalError,
                    "failed to build llm reqwest client",
                )
                .with_source(err)
            })?;

        Ok(Self { inner })
    }

    pub fn build_request<T: Serialize>(
        &self,
        method: Method,
        options: &JsonRequestOptions,
        body: Option<&T>,
    ) -> Result<Request, AppError> {
        let timeout = Duration::from_millis(options.deadline_ms.max(1));
        let mut builder = self
            .inner
            .request(method, &options.url)
            .timeout(timeout)
            .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
            .header(ACCEPT, HeaderValue::from_static(options.accept))
            .header(X_REQUEST_ID, header_value(&options.request_id)?);

        if let Some(traceparent) = options
            .traceparent
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            builder = builder.header(TRACEPARENT, header_value(traceparent)?);
        }

        if let Some(token) = options
            .bearer_token
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            builder = builder.header(AUTHORIZATION, header_value(&format!("Bearer {token}"))?);
        }

        for (name, value) in &options.extra_headers {
            builder = builder.header(name, value);
        }

        let builder = if let Some(body) = body {
            builder.json(body)
        } else {
            builder
        };

        builder.build().map_err(|err| {
            AppError::new(ErrorCode::InvalidArgument, "failed to build llm http request")
                .with_request_id(options.request_id.clone())
                .with_upstream(UpstreamService::Llm)
                .with_source(err)
        })
    }

    pub fn build_json_request<T: Serialize>(
        &self,
        method: Method,
        options: &JsonRequestOptions,
        body: &T,
    ) -> Result<Request, AppError> {
        self.build_request(method, options, Some(body))
    }

    pub async fn execute(
        &self,
        upstream: UpstreamService,
        request_id: &str,
        request: Request,
    ) -> Result<Response, AppError> {
        self.inner
            .execute(request)
            .await
            .map_err(|err| map_http_transport_error(upstream, request_id.to_string(), &err))
    }

    pub async fn post_json<T: Serialize>(
        &self,
        upstream: UpstreamService,
        options: &JsonRequestOptions,
        body: &T,
    ) -> Result<Response, AppError> {
        let request = self.build_json_request(Method::POST, options, body)?;
        self.execute(upstream, &options.request_id, request).await
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    pub event: Option<String>,
    pub data: String,
    pub id: Option<String>,
}

#[derive(Debug, Default)]
pub struct SseStreamParser {
    pending: Vec<u8>,
    current_event: Option<String>,
    current_id: Option<String>,
    current_data: Vec<String>,
}

impl SseStreamParser {
    pub fn push(
        &mut self,
        request_id: &str,
        chunk: &[u8],
    ) -> Result<Vec<SseEvent>, AppError> {
        self.pending.extend_from_slice(chunk);
        let mut events = Vec::new();

        while let Some(line_end) = self.pending.iter().position(|byte| *byte == b'\n') {
            let line_bytes = self.pending.drain(..=line_end).collect::<Vec<_>>();
            let line = normalize_line(&line_bytes);

            if line.is_empty() {
                if let Some(event) = self.finish_event() {
                    events.push(event);
                }
                continue;
            }

            if line.starts_with(':') {
                continue;
            }

            let (field, value) = line
                .split_once(':')
                .map(|(field, value)| (field, value.trim_start()))
                .unwrap_or((line.as_str(), ""));

            match field {
                "event" => self.current_event = Some(value.to_string()),
                "id" => self.current_id = Some(value.to_string()),
                "data" => self.current_data.push(value.to_string()),
                "retry" => {}
                _ => {
                    return Err(map_malformed_stream_chunk(
                        UpstreamService::Llm,
                        request_id.to_string(),
                        "sse",
                    ))
                }
            }
        }

        Ok(events)
    }

    pub fn finish(&mut self, request_id: &str) -> Result<Vec<SseEvent>, AppError> {
        if !self.pending.is_empty() {
            return Err(map_stream_eof(
                UpstreamService::Llm,
                request_id.to_string(),
                "sse",
            ));
        }

        Ok(self.finish_event().into_iter().collect())
    }

    fn finish_event(&mut self) -> Option<SseEvent> {
        if self.current_event.is_none() && self.current_id.is_none() && self.current_data.is_empty()
        {
            return None;
        }

        Some(SseEvent {
            event: self.current_event.take(),
            id: self.current_id.take(),
            data: self.current_data.drain(..).collect::<Vec<_>>().join("\n"),
        })
    }
}

fn normalize_line(line_bytes: &[u8]) -> String {
    let mut line = String::from_utf8_lossy(line_bytes).into_owned();
    while line.ends_with('\n') || line.ends_with('\r') {
        line.pop();
    }
    line
}

fn header_value(value: &str) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(value).map_err(|err| {
        AppError::new(ErrorCode::InvalidArgument, "invalid llm header value").with_source(err)
    })
}

#[cfg(test)]
mod tests {
    use reqwest::{
        header::{HeaderValue, ACCEPT, AUTHORIZATION},
        Method,
    };
    use serde_json::json;

    use super::{JsonRequestOptions, LlmHttpClient, SseEvent, SseStreamParser};
    use crate::llm::types::RequestContext;

    fn sample_meta() -> RequestContext {
        RequestContext {
            request_id: "req-1".to_string(),
            session_id: "sess-1".to_string(),
            user_id: "user-1".to_string(),
            trace_id: "00-abc-xyz-01".to_string(),
            deadline_ms: 1_500,
        }
    }

    #[test]
    fn builds_json_request_with_common_headers_and_timeout() {
        let client = LlmHttpClient::new().unwrap();
        let options = JsonRequestOptions::json(
            "https://example.com/v1/chat/completions",
            &sample_meta(),
            Some("secret-token".to_string()),
        )
        .with_extra_header(
            reqwest::header::HeaderName::from_static("x-provider"),
            HeaderValue::from_static("openai"),
        );

        let request = client
            .build_json_request(Method::POST, &options, &json!({"model": "gpt"}))
            .unwrap();

        assert_eq!(request.timeout(), Some(Duration::from_millis(1_500)));
        assert_eq!(
            request.headers().get(ACCEPT),
            Some(&HeaderValue::from_static("application/json"))
        );
        assert_eq!(
            request.headers().get(AUTHORIZATION),
            Some(&HeaderValue::from_static("Bearer secret-token"))
        );
        assert_eq!(
            request.headers().get("x-request-id"),
            Some(&HeaderValue::from_static("req-1"))
        );
        assert_eq!(
            request.headers().get("traceparent"),
            Some(&HeaderValue::from_static("00-abc-xyz-01"))
        );
        assert_eq!(
            request.headers().get("x-provider"),
            Some(&HeaderValue::from_static("openai"))
        );
    }

    #[test]
    fn sse_parser_reassembles_events_across_chunks() {
        let mut parser = SseStreamParser::default();
        let first = parser
            .push("req-2", b"id: evt-1\nevent: message\ndata: hel")
            .unwrap();
        assert!(first.is_empty());

        let second = parser
            .push("req-2", b"lo\ndata: world\n\n")
            .unwrap();

        assert_eq!(
            second,
            vec![SseEvent {
                event: Some("message".to_string()),
                id: Some("evt-1".to_string()),
                data: "hello\nworld".to_string(),
            }]
        );
    }

    #[test]
    fn sse_parser_requires_complete_frame_before_finish() {
        let mut parser = SseStreamParser::default();
        parser.push("req-3", b"data: partial").unwrap();

        let err = parser.finish("req-3").unwrap_err();
        assert_eq!(err.code.to_string(), "STREAM_INTERRUPTED");
    }

    #[test]
    fn event_stream_accept_header_can_be_switched() {
        let options = JsonRequestOptions::json("https://example.com/stream", &sample_meta(), None)
            .event_stream();

        assert_eq!(options.accept, "text/event-stream");
    }
}
