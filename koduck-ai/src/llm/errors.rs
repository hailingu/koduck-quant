//! HTTP and stream error normalization helpers for provider-native LLM integrations.

use reqwest::{
    header::HeaderMap,
    StatusCode,
};
use serde::Deserialize;
use serde_json::Value;

use crate::reliability::error::{AppError, ErrorCode, UpstreamService};

pub fn map_http_transport_error(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    err: &reqwest::Error,
) -> AppError {
    let request_id = request_id.into();

    let (code, message) = if err.is_timeout() {
        (
            ErrorCode::StreamTimeout,
            "llm provider request timed out before the local deadline".to_string(),
        )
    } else if err.is_connect() {
        (
            ErrorCode::UpstreamUnavailable,
            "llm provider connection failed".to_string(),
        )
    } else if err.is_body() || err.is_decode() {
        (
            ErrorCode::StreamInterrupted,
            "llm provider stream body could not be read completely".to_string(),
        )
    } else {
        (
            ErrorCode::UpstreamUnavailable,
            "llm provider request failed".to_string(),
        )
    };

    AppError::new(code, message)
        .with_request_id(request_id)
        .with_upstream(upstream)
        .with_source(HttpTransportSnapshot(err.to_string()))
}

pub fn map_http_status_error(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    status: StatusCode,
    headers: &HeaderMap,
    body: &str,
) -> AppError {
    let request_id = request_id.into();
    let parsed = parse_error_payload(body);
    let code = classify_error_code(
        status,
        parsed.code.as_deref(),
        parsed.error_type.as_deref(),
        parsed.http_code,
    );
    let message = parsed
        .message
        .unwrap_or_else(|| default_message_for_status(status, code));

    let mut err = AppError::new(code, message)
        .with_request_id(request_id)
        .with_upstream(upstream)
        .with_source(HttpStatusSnapshot {
            status,
            body: truncate_for_snapshot(body),
        });

    if let Some(retry_after_ms) = parsed
        .retry_after_ms
        .or_else(|| retry_after_ms_from_headers(headers))
    {
        err = err.with_retry_after_ms(retry_after_ms);
    }

    err
}

pub fn map_stream_eof(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    context: &'static str,
) -> AppError {
    AppError::new(
        ErrorCode::StreamInterrupted,
        format!("llm provider stream ended before a complete {context} event was received"),
    )
    .with_request_id(request_id)
    .with_upstream(upstream)
}

pub fn map_malformed_stream_chunk(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    context: &'static str,
) -> AppError {
    AppError::new(
        ErrorCode::StreamInterrupted,
        format!("llm provider stream emitted a malformed {context} chunk"),
    )
    .with_request_id(request_id)
    .with_upstream(upstream)
}

fn classify_error_code(
    status: StatusCode,
    body_code: Option<&str>,
    error_type: Option<&str>,
    http_code: Option<u16>,
) -> ErrorCode {
    if is_server_busy_signal(status, body_code, error_type, http_code) {
        return ErrorCode::ServerBusy;
    }

    if is_rate_limit_code(body_code) {
        return ErrorCode::RateLimited;
    }

    match status {
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => ErrorCode::InvalidArgument,
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => ErrorCode::AuthFailed,
        StatusCode::NOT_FOUND => ErrorCode::ResourceNotFound,
        StatusCode::CONFLICT => ErrorCode::Conflict,
        StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => ErrorCode::StreamTimeout,
        StatusCode::TOO_MANY_REQUESTS => ErrorCode::RateLimited,
        StatusCode::SERVICE_UNAVAILABLE => ErrorCode::ServerBusy,
        StatusCode::BAD_GATEWAY => ErrorCode::UpstreamUnavailable,
        _ if status.is_server_error() => ErrorCode::DependencyFailed,
        _ => ErrorCode::DependencyFailed,
    }
}

fn is_rate_limit_code(code: Option<&str>) -> bool {
    code.map(|value| value.to_ascii_lowercase())
        .map(|value| {
            value.contains("rate")
                || value.contains("quota")
                || value.contains("too_many_requests")
                || value.contains("resource_exhausted")
        })
        .unwrap_or(false)
}

fn default_message_for_status(status: StatusCode, code: ErrorCode) -> String {
    match code {
        ErrorCode::ServerBusy => "llm provider is temporarily busy".to_string(),
        ErrorCode::RateLimited => "llm provider rate limit exceeded".to_string(),
        ErrorCode::StreamTimeout => "llm provider request timed out".to_string(),
        _ => match status {
        StatusCode::TOO_MANY_REQUESTS => "llm provider rate limit exceeded".to_string(),
        StatusCode::SERVICE_UNAVAILABLE => "llm provider is temporarily busy".to_string(),
        StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => {
            "llm provider request timed out".to_string()
        }
        _ if status.is_server_error() => "llm provider returned a server error".to_string(),
        _ => "llm provider request failed".to_string(),
        },
    }
}

fn is_server_busy_signal(
    status: StatusCode,
    body_code: Option<&str>,
    error_type: Option<&str>,
    http_code: Option<u16>,
) -> bool {
    status.as_u16() == 529
        || http_code == Some(529)
        || matches_busy_token(body_code)
        || matches_busy_token(error_type)
}

fn retry_after_ms_from_headers(headers: &HeaderMap) -> Option<u64> {
    headers
        .get("retry-after-ms")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .or_else(|| {
            headers
                .get("retry-after")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.trim().parse::<u64>().ok())
                .map(|seconds| seconds.saturating_mul(1000))
        })
}

#[derive(Debug, Default)]
struct ParsedErrorPayload {
    message: Option<String>,
    code: Option<String>,
    error_type: Option<String>,
    http_code: Option<u16>,
    retry_after_ms: Option<u64>,
}

fn parse_error_payload(body: &str) -> ParsedErrorPayload {
    if body.trim().is_empty() {
        return ParsedErrorPayload::default();
    }

    if let Ok(envelope) = serde_json::from_str::<OpenAiErrorEnvelope>(body) {
        if let Some(error) = envelope.error {
            return ParsedErrorPayload {
                message: error.message.filter(|value| !value.trim().is_empty()),
                code: error.code.and_then(json_value_to_string),
                error_type: error.error_type.filter(|value| !value.trim().is_empty()),
                http_code: error
                    .http_code
                    .as_deref()
                    .and_then(|value| value.trim().parse::<u16>().ok()),
                retry_after_ms: error.retry_after_ms,
            };
        }
    }

    if let Ok(envelope) = serde_json::from_str::<FlatErrorEnvelope>(body) {
        return ParsedErrorPayload {
            message: envelope
                .message
                .or(envelope.error_description)
                .filter(|value| !value.trim().is_empty()),
            code: envelope.code.and_then(json_value_to_string),
            error_type: None,
            http_code: None,
            retry_after_ms: envelope.retry_after_ms,
        };
    }

    ParsedErrorPayload {
        message: Some(truncate_message(body)),
        code: None,
        error_type: None,
        http_code: None,
        retry_after_ms: None,
    }
}

fn json_value_to_string(value: Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text),
        other => Some(other.to_string()),
    }
}

fn matches_busy_token(value: Option<&str>) -> bool {
    value
        .map(|raw| raw.trim().to_ascii_lowercase())
        .map(|normalized| {
            normalized.contains("overloaded")
                || normalized.contains("overload")
                || normalized.contains("server_busy")
                || normalized.contains("busy")
        })
        .unwrap_or(false)
}

fn truncate_message(body: &str) -> String {
    truncate_for_snapshot(body)
}

fn truncate_for_snapshot(body: &str) -> String {
    const MAX_LEN: usize = 256;

    if body.len() <= MAX_LEN {
        body.to_string()
    } else {
        format!("{}...", &body[..MAX_LEN])
    }
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorEnvelope {
    error: Option<OpenAiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct OpenAiErrorBody {
    message: Option<String>,
    code: Option<Value>,
    #[serde(rename = "type")]
    error_type: Option<String>,
    http_code: Option<String>,
    #[serde(default)]
    retry_after_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct FlatErrorEnvelope {
    message: Option<String>,
    error_description: Option<String>,
    code: Option<Value>,
    #[serde(default)]
    retry_after_ms: Option<u64>,
}

#[derive(Debug)]
struct HttpTransportSnapshot(String);

impl std::fmt::Display for HttpTransportSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for HttpTransportSnapshot {}

#[derive(Debug)]
struct HttpStatusSnapshot {
    status: StatusCode,
    body: String,
}

impl std::fmt::Display for HttpStatusSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "status={} body={}", self.status, self.body)
    }
}

impl std::error::Error for HttpStatusSnapshot {}

#[cfg(test)]
mod tests {
    use reqwest::{
        header::{HeaderMap, HeaderValue},
        StatusCode,
    };

    use super::{
        map_http_status_error, map_malformed_stream_chunk, map_stream_eof, retry_after_ms_from_headers,
    };
    use crate::reliability::error::{ErrorCode, UpstreamService};

    #[test]
    fn maps_429_with_retry_after_header() {
        let mut headers = HeaderMap::new();
        headers.insert("retry-after", HeaderValue::from_static("3"));

        let err = map_http_status_error(
            UpstreamService::Llm,
            "req-1",
            StatusCode::TOO_MANY_REQUESTS,
            &headers,
            r#"{"error":{"message":"rate limit","code":"rate_limit_exceeded"}}"#,
        );

        assert_eq!(err.code, ErrorCode::RateLimited);
        assert_eq!(err.retry_after_ms, Some(3000));
    }

    #[test]
    fn maps_503_to_server_busy() {
        let err = map_http_status_error(
            UpstreamService::Llm,
            "req-2",
            StatusCode::SERVICE_UNAVAILABLE,
            &HeaderMap::new(),
            r#"{"message":"temporarily unavailable"}"#,
        );

        assert_eq!(err.code, ErrorCode::ServerBusy);
        assert_eq!(err.request_id.as_deref(), Some("req-2"));
    }

    #[test]
    fn maps_gateway_timeout_to_stream_timeout() {
        let err = map_http_status_error(
            UpstreamService::Llm,
            "req-3",
            StatusCode::GATEWAY_TIMEOUT,
            &HeaderMap::new(),
            "",
        );

        assert_eq!(err.code, ErrorCode::StreamTimeout);
    }

    #[test]
    fn parses_retry_after_ms_override_header() {
        let mut headers = HeaderMap::new();
        headers.insert("retry-after-ms", HeaderValue::from_static("1500"));

        assert_eq!(retry_after_ms_from_headers(&headers), Some(1500));
    }

    #[test]
    fn maps_stream_level_interruptions() {
        let eof = map_stream_eof(UpstreamService::Llm, "req-4", "delta");
        let malformed = map_malformed_stream_chunk(UpstreamService::Llm, "req-5", "sse");

        assert_eq!(eof.code, ErrorCode::StreamInterrupted);
        assert_eq!(malformed.code, ErrorCode::StreamInterrupted);
    }
}
