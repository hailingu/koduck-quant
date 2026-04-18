use axum::http::StatusCode;
use axum::response::IntoResponse;

use super::*;

#[test]
fn test_all_error_codes_constructible() {
    let codes = [
        ErrorCode::Ok,
        ErrorCode::InvalidArgument,
        ErrorCode::AuthFailed,
        ErrorCode::ResourceNotFound,
        ErrorCode::Conflict,
        ErrorCode::TokenBudgetExceeded,
        ErrorCode::RateLimited,
        ErrorCode::ServerBusy,
        ErrorCode::UpstreamUnavailable,
        ErrorCode::DependencyFailed,
        ErrorCode::InternalError,
        ErrorCode::StreamTimeout,
        ErrorCode::StreamInterrupted,
    ];

    for code in &codes {
        let serialized =
            serde_json::to_string(code).expect(&format!("Failed to serialize {:?}", code));
        assert!(serialized.len() > 2, "Serialized code too short: {}", serialized);
    }
}

#[test]
fn test_error_code_display() {
    assert_eq!(ErrorCode::InvalidArgument.to_string(), "INVALID_ARGUMENT");
    assert_eq!(ErrorCode::AuthFailed.to_string(), "AUTH_FAILED");
    assert_eq!(ErrorCode::RateLimited.to_string(), "RATE_LIMITED");
    assert_eq!(
        ErrorCode::TokenBudgetExceeded.to_string(),
        "TOKEN_BUDGET_EXCEEDED"
    );
    assert_eq!(ErrorCode::UpstreamUnavailable.to_string(), "UPSTREAM_UNAVAILABLE");
    assert_eq!(ErrorCode::StreamTimeout.to_string(), "STREAM_TIMEOUT");
}

#[test]
fn test_retryable_codes() {
    assert!(ErrorCode::RateLimited.retryable());
    assert!(ErrorCode::ServerBusy.retryable());
    assert!(ErrorCode::UpstreamUnavailable.retryable());
    assert!(ErrorCode::StreamTimeout.retryable());
    assert!(ErrorCode::StreamInterrupted.retryable());

    assert!(!ErrorCode::InvalidArgument.retryable());
    assert!(!ErrorCode::AuthFailed.retryable());
    assert!(!ErrorCode::ResourceNotFound.retryable());
    assert!(!ErrorCode::Conflict.retryable());
    assert!(!ErrorCode::TokenBudgetExceeded.retryable());
    assert!(!ErrorCode::InternalError.retryable());
    assert!(!ErrorCode::DependencyFailed.retryable());
    assert!(!ErrorCode::Ok.retryable());
}

#[test]
fn test_degradable_codes() {
    assert!(ErrorCode::RateLimited.degradable());
    assert!(ErrorCode::ServerBusy.degradable());
    assert!(ErrorCode::UpstreamUnavailable.degradable());
    assert!(ErrorCode::DependencyFailed.degradable());
    assert!(ErrorCode::StreamTimeout.degradable());
    assert!(ErrorCode::StreamInterrupted.degradable());

    assert!(!ErrorCode::InvalidArgument.degradable());
    assert!(!ErrorCode::AuthFailed.degradable());
    assert!(!ErrorCode::InternalError.degradable());
}

#[test]
fn test_http_status_mapping() {
    assert_eq!(ErrorCode::InvalidArgument.http_status(), StatusCode::BAD_REQUEST);
    assert_eq!(ErrorCode::AuthFailed.http_status(), StatusCode::UNAUTHORIZED);
    assert_eq!(ErrorCode::ResourceNotFound.http_status(), StatusCode::NOT_FOUND);
    assert_eq!(ErrorCode::Conflict.http_status(), StatusCode::CONFLICT);
    assert_eq!(
        ErrorCode::TokenBudgetExceeded.http_status(),
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(ErrorCode::RateLimited.http_status(), StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(ErrorCode::ServerBusy.http_status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(ErrorCode::UpstreamUnavailable.http_status(), StatusCode::BAD_GATEWAY);
    assert_eq!(
        ErrorCode::DependencyFailed.http_status(),
        StatusCode::FAILED_DEPENDENCY
    );
    assert_eq!(
        ErrorCode::InternalError.http_status(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(ErrorCode::StreamTimeout.http_status(), StatusCode::GATEWAY_TIMEOUT);
    assert_eq!(ErrorCode::StreamInterrupted.http_status(), StatusCode::BAD_GATEWAY);
    assert_eq!(ErrorCode::Ok.http_status(), StatusCode::OK);
}

#[test]
fn test_grpc_code_mapping() {
    assert_eq!(ErrorCode::InvalidArgument.grpc_code(), Code::InvalidArgument);
    assert_eq!(ErrorCode::AuthFailed.grpc_code(), Code::Unauthenticated);
    assert_eq!(ErrorCode::ResourceNotFound.grpc_code(), Code::NotFound);
    assert_eq!(ErrorCode::Conflict.grpc_code(), Code::AlreadyExists);
    assert_eq!(ErrorCode::TokenBudgetExceeded.grpc_code(), Code::FailedPrecondition);
    assert_eq!(ErrorCode::RateLimited.grpc_code(), Code::ResourceExhausted);
    assert_eq!(ErrorCode::ServerBusy.grpc_code(), Code::Unavailable);
    assert_eq!(ErrorCode::UpstreamUnavailable.grpc_code(), Code::Unavailable);
    assert_eq!(ErrorCode::DependencyFailed.grpc_code(), Code::FailedPrecondition);
    assert_eq!(ErrorCode::InternalError.grpc_code(), Code::Internal);
    assert_eq!(ErrorCode::StreamTimeout.grpc_code(), Code::DeadlineExceeded);
    assert_eq!(ErrorCode::StreamInterrupted.grpc_code(), Code::Cancelled);
}

#[test]
fn test_grpc_code_to_error_code_roundtrip() {
    let one_to_one = [
        Code::InvalidArgument,
        Code::NotFound,
        Code::Unauthenticated,
        Code::ResourceExhausted,
        Code::Internal,
        Code::DeadlineExceeded,
        Code::Cancelled,
    ];

    for grpc_code in &one_to_one {
        let error_code = grpc_code_to_error_code(*grpc_code);
        assert_eq!(
            error_code.grpc_code(),
            *grpc_code,
            "Roundtrip failed for {:?} → {:?} → {:?}",
            grpc_code,
            error_code,
            error_code.grpc_code()
        );
    }
}

#[test]
fn test_grpc_code_to_error_code_all_variants() {
    let all_codes = [
        Code::Ok,
        Code::Cancelled,
        Code::Unknown,
        Code::InvalidArgument,
        Code::DeadlineExceeded,
        Code::NotFound,
        Code::AlreadyExists,
        Code::PermissionDenied,
        Code::ResourceExhausted,
        Code::FailedPrecondition,
        Code::Aborted,
        Code::OutOfRange,
        Code::Unimplemented,
        Code::Internal,
        Code::Unavailable,
        Code::DataLoss,
        Code::Unauthenticated,
    ];

    for grpc_code in &all_codes {
        let _ = grpc_code_to_error_code(*grpc_code);
    }
}

#[test]
fn test_app_error_new() {
    let err = AppError::new(ErrorCode::InvalidArgument, "missing field 'prompt'");
    assert_eq!(err.code, ErrorCode::InvalidArgument);
    assert_eq!(err.message, "missing field 'prompt'");
    assert!(!err.retryable);
    assert!(!err.degraded);
    assert!(err.upstream.is_none());
    assert!(err.retry_after_ms.is_none());
    assert!(err.request_id.is_none());
}

#[test]
fn test_app_error_builder_pattern() {
    let err = AppError::new(ErrorCode::UpstreamUnavailable, "memory service timeout")
        .with_request_id("req-123")
        .with_upstream(UpstreamService::Memory)
        .with_degraded()
        .with_retry_after_ms(5000);

    assert_eq!(err.code, ErrorCode::UpstreamUnavailable);
    assert_eq!(err.request_id.as_deref(), Some("req-123"));
    assert_eq!(err.upstream, Some(UpstreamService::Memory));
    assert!(err.degraded);
    assert_eq!(err.retry_after_ms, Some(5000));
    assert!(err.retryable);
}

#[test]
fn test_app_error_from_grpc_status() {
    let status = tonic::Status::new(Code::Unavailable, "connection refused");
    let err = AppError::from_grpc_status(&status, UpstreamService::Tool);

    assert_eq!(err.code, ErrorCode::UpstreamUnavailable);
    assert_eq!(err.upstream, Some(UpstreamService::Tool));
    assert!(err.retryable);
}

#[test]
fn test_app_error_from_grpc_status_masks_internal_details() {
    let status = tonic::Status::new(
        Code::Internal,
        "postgres connection string: postgres://admin:secret@db:5432",
    );
    let err = AppError::from_grpc_status(&status, UpstreamService::Memory);

    assert_eq!(err.code, ErrorCode::InternalError);
    assert!(!err.message.contains("postgres"));
    assert!(!err.message.contains("secret"));
}

#[test]
fn test_app_error_to_error_response() {
    let err = AppError::new(ErrorCode::RateLimited, "too many requests")
        .with_request_id("req-456")
        .with_upstream(UpstreamService::Llm)
        .with_retry_after_ms(3000);

    let response = err.to_error_response();
    assert_eq!(response.code, "RATE_LIMITED");
    assert_eq!(response.message, "too many requests");
    assert_eq!(response.request_id.as_deref(), Some("req-456"));
    assert!(response.retryable);
    assert!(!response.degraded);
    assert_eq!(response.upstream.as_deref(), Some("llm"));
    assert_eq!(response.retry_after_ms, Some(3000));
}

#[test]
fn test_app_error_serialization_no_source_leak() {
    let err = AppError::new(ErrorCode::UpstreamUnavailable, "db password: super_secret_123")
        .with_source(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "connection refused to db.internal:5432",
        ));

    let response = err.to_error_response();
    let json = serde_json::to_string(&response).unwrap();

    assert!(!json.contains("super_secret_123"));
    assert!(!json.contains("db.internal"));
    assert!(!json.contains("connection refused to db"));
}

#[test]
fn test_app_error_into_tonic_status() {
    let err = AppError::new(ErrorCode::InvalidArgument, "bad input");
    let status: tonic::Status = err.into();
    assert_eq!(status.code(), Code::InvalidArgument);
    assert_eq!(status.message(), "bad input");
}

#[test]
fn test_app_error_into_response() {
    let err = AppError::new(ErrorCode::ResourceNotFound, "session not found")
        .with_request_id("req-789");

    let response = err.into_response();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[test]
fn test_upstream_service_display() {
    assert_eq!(UpstreamService::Memory.to_string(), "memory");
    assert_eq!(UpstreamService::Knowledge.to_string(), "knowledge");
    assert_eq!(UpstreamService::Tool.to_string(), "tool");
    assert_eq!(UpstreamService::Llm.to_string(), "llm");
    assert_eq!(UpstreamService::Auth.to_string(), "auth");
}

#[test]
fn test_retryable_override() {
    let err = AppError::new(ErrorCode::RateLimited, "budget exhausted").with_retryable(false);
    assert!(!err.retryable);
}
