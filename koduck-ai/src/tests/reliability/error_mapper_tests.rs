use tonic::{Code, Status};

use crate::clients::proto::ErrorDetail;

use super::{map_contract_error_detail, map_grpc_status, map_transport_error};
use crate::reliability::error::{ErrorCode, UpstreamService};

#[test]
fn maps_memory_contract_error_to_standard_code() {
    let detail = ErrorDetail {
        code: "RESOURCE_NOT_FOUND".to_string(),
        message: "session missing".to_string(),
        retryable: false,
        degraded: false,
        upstream: "memory".to_string(),
        retry_after_ms: 0,
    };

    let err = map_contract_error_detail(
        UpstreamService::Memory,
        "req-1",
        Some(&detail),
        ErrorCode::DependencyFailed,
        "memory request failed",
    );

    assert_eq!(err.code, ErrorCode::ResourceNotFound);
    assert_eq!(err.request_id.as_deref(), Some("req-1"));
    assert_eq!(err.upstream, Some(UpstreamService::Memory));
}

#[test]
fn maps_tool_contract_unknown_code_to_fallback() {
    let detail = ErrorDetail {
        code: "TOOL_SCHEMA_ERROR".to_string(),
        message: "tool schema mismatch".to_string(),
        retryable: false,
        degraded: true,
        upstream: "tool".to_string(),
        retry_after_ms: 0,
    };

    let err = map_contract_error_detail(
        UpstreamService::Tool,
        "req-2",
        Some(&detail),
        ErrorCode::DependencyFailed,
        "tool request failed",
    );

    assert_eq!(err.code, ErrorCode::DependencyFailed);
    assert!(err.degraded);
    assert_eq!(err.upstream, Some(UpstreamService::Tool));
}

#[test]
fn maps_llm_rate_limit_and_preserves_retry_after() {
    let detail = ErrorDetail {
        code: "RATE_LIMITED".to_string(),
        message: "provider throttled".to_string(),
        retryable: true,
        degraded: false,
        upstream: "llm".to_string(),
        retry_after_ms: 1_500,
    };

    let err = map_contract_error_detail(
        UpstreamService::Llm,
        "req-3",
        Some(&detail),
        ErrorCode::DependencyFailed,
        "llm request failed",
    );

    assert_eq!(err.code, ErrorCode::RateLimited);
    assert!(err.retryable);
    assert_eq!(err.retry_after_ms, Some(1_500));
}

#[test]
fn maps_grpc_status_to_upstream_unavailable() {
    let status = Status::new(Code::Unavailable, "connection reset");
    let err = map_grpc_status(UpstreamService::Tool, "req-4", &status);

    assert_eq!(err.code, ErrorCode::UpstreamUnavailable);
    assert!(err.retryable);
    assert_eq!(err.upstream, Some(UpstreamService::Tool));
}

#[test]
fn maps_transport_error_to_unified_error() {
    let err = map_transport_error(
        UpstreamService::Llm,
        "req-5",
        "failed to connect llm adapter",
        "dns lookup failed",
    );

    assert_eq!(err.code, ErrorCode::UpstreamUnavailable);
    assert_eq!(err.request_id.as_deref(), Some("req-5"));
    assert_eq!(err.upstream, Some(UpstreamService::Llm));
}

#[test]
fn sanitizes_internal_contract_message() {
    let detail = ErrorDetail {
        code: "INTERNAL_ERROR".to_string(),
        message: "postgres password leaked".to_string(),
        retryable: false,
        degraded: false,
        upstream: "memory".to_string(),
        retry_after_ms: 0,
    };

    let err = map_contract_error_detail(
        UpstreamService::Memory,
        "req-6",
        Some(&detail),
        ErrorCode::DependencyFailed,
        "memory request failed",
    );

    assert_eq!(err.code, ErrorCode::InternalError);
    assert!(!err.message.contains("password"));
}
