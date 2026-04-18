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
