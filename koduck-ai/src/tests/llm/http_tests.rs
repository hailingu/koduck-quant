use std::time::Duration;

use reqwest::{
    header::{HeaderValue, ACCEPT, ACCEPT_ENCODING, AUTHORIZATION},
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

    assert_eq!(request.timeout(), Some(Duration::from_millis(1_500)).as_ref());
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

    let second = parser.push("req-2", b"lo\ndata: world\n\n").unwrap();

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
    let options =
        JsonRequestOptions::json("https://example.com/stream", &sample_meta(), None).event_stream();

    assert_eq!(options.accept, "text/event-stream");
    assert_eq!(
        options.extra_headers.get(ACCEPT_ENCODING),
        Some(&HeaderValue::from_static("identity"))
    );
}
