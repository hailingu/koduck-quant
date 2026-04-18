//! Unified error framework for koduck-ai.
//!
//! Provides structured error codes, a unified error object, and bidirectional
//! gRPC ↔ HTTP status code mapping as defined in the design doc §14 (Appendix A).

use axum::http::StatusCode;
use serde::Serialize;
use strum::{Display, IntoStaticStr};
use tonic::Code;
use tracing::error;

// ---------------------------------------------------------------------------
// Error Code Enum (V1) — §14.2
// ---------------------------------------------------------------------------

/// V1 error codes defined in the design doc Appendix A §14.2.
///
/// Each variant carries compile-time metadata: retryability, degradability,
/// default HTTP status, and default gRPC code.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, IntoStaticStr, Serialize)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// Success (not used as an error variant, but included for completeness).
    Ok,

    /// Request parameters are invalid (HTTP 400).
    InvalidArgument,

    /// Authentication or authorization failed (HTTP 401/403).
    AuthFailed,

    /// Requested resource does not exist (HTTP 404).
    ResourceNotFound,

    /// Idempotent conflict or state conflict (HTTP 409).
    Conflict,

    /// Token or context budget exceeded (HTTP 413/422).
    TokenBudgetExceeded,

    /// Rate limit triggered; prefer returning `retry_after_ms` (HTTP 429).
    RateLimited,

    /// Concurrency protection triggered, request rejected (HTTP 503).
    ServerBusy,

    /// Downstream service unavailable or timed out (HTTP 502/503/504).
    UpstreamUnavailable,

    /// Downstream business failure, not a network error (HTTP 424/500).
    DependencyFailed,

    /// Unclassified internal error (HTTP 500).
    InternalError,

    /// Streaming request timed out (HTTP 504).
    StreamTimeout,

    /// Stream interrupted or client disconnected (HTTP 499/502).
    StreamInterrupted,
}

impl ErrorCode {
    /// Whether this error is retryable by default.
    pub const fn retryable(self) -> bool {
        matches!(
            self,
            ErrorCode::RateLimited
                | ErrorCode::ServerBusy
                | ErrorCode::UpstreamUnavailable
                | ErrorCode::StreamTimeout
                | ErrorCode::StreamInterrupted
        )
    }

    /// Whether this error allows graceful degradation.
    pub const fn degradable(self) -> bool {
        matches!(
            self,
            ErrorCode::RateLimited
                | ErrorCode::ServerBusy
                | ErrorCode::UpstreamUnavailable
                | ErrorCode::DependencyFailed
                | ErrorCode::StreamTimeout
                | ErrorCode::StreamInterrupted
        )
    }

    /// Map to HTTP status code.
    pub const fn http_status(self) -> StatusCode {
        match self {
            ErrorCode::Ok => StatusCode::OK,
            ErrorCode::InvalidArgument => StatusCode::BAD_REQUEST,
            ErrorCode::AuthFailed => StatusCode::UNAUTHORIZED,
            ErrorCode::ResourceNotFound => StatusCode::NOT_FOUND,
            ErrorCode::Conflict => StatusCode::CONFLICT,
            ErrorCode::TokenBudgetExceeded => StatusCode::UNPROCESSABLE_ENTITY,
            ErrorCode::RateLimited => StatusCode::TOO_MANY_REQUESTS,
            ErrorCode::ServerBusy => StatusCode::SERVICE_UNAVAILABLE,
            ErrorCode::UpstreamUnavailable => StatusCode::BAD_GATEWAY,
            ErrorCode::DependencyFailed => StatusCode::FAILED_DEPENDENCY,
            ErrorCode::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
            ErrorCode::StreamTimeout => StatusCode::GATEWAY_TIMEOUT,
            ErrorCode::StreamInterrupted => StatusCode::BAD_GATEWAY,
        }
    }

    /// Map to gRPC status code.
    pub const fn grpc_code(self) -> Code {
        match self {
            ErrorCode::Ok => Code::Ok,
            ErrorCode::InvalidArgument => Code::InvalidArgument,
            ErrorCode::AuthFailed => Code::Unauthenticated,
            ErrorCode::ResourceNotFound => Code::NotFound,
            ErrorCode::Conflict => Code::AlreadyExists,
            ErrorCode::TokenBudgetExceeded => Code::FailedPrecondition,
            ErrorCode::RateLimited => Code::ResourceExhausted,
            ErrorCode::ServerBusy => Code::Unavailable,
            ErrorCode::UpstreamUnavailable => Code::Unavailable,
            ErrorCode::DependencyFailed => Code::FailedPrecondition,
            ErrorCode::InternalError => Code::Internal,
            ErrorCode::StreamTimeout => Code::DeadlineExceeded,
            ErrorCode::StreamInterrupted => Code::Cancelled,
        }
    }
}

// ---------------------------------------------------------------------------
// Upstream Service Identifier
// ---------------------------------------------------------------------------

/// Identifies which downstream service produced the error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Display, Serialize)]
#[strum(serialize_all = "lowercase")]
pub enum UpstreamService {
    Memory,
    Knowledge,
    Tool,
    Llm,
    Auth,
}

// ---------------------------------------------------------------------------
// Unified Error Object — §14.1
// ---------------------------------------------------------------------------

/// Unified error object for all north-facing API responses.
///
/// Design doc §14.1 defines the canonical fields:
/// `code`, `message`, `request_id`, `retryable`, `degraded`, `upstream`, `retry_after_ms`
///
/// The optional `source` field stores the original downstream error for logging
/// and debugging but is **never** serialized to client responses.
#[derive(Debug)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub request_id: Option<String>,
    pub retryable: bool,
    pub degraded: bool,
    pub upstream: Option<UpstreamService>,
    pub retry_after_ms: Option<u64>,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

/// JSON-serializable error response body.
///
/// This is what clients receive. Internal details (`source`) are excluded.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub request_id: Option<String>,
    pub retryable: bool,
    pub degraded: bool,
    pub upstream: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
}

impl AppError {
    /// Create a new error with the given code and message.
    /// Uses the code's default retryability.
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            request_id: None,
            retryable: code.retryable(),
            degraded: false,
            upstream: None,
            retry_after_ms: None,
            source: None,
        }
    }

    /// Create an error from a downstream gRPC status.
    ///
    /// Maps the gRPC code to the appropriate ErrorCode and attaches
    /// the original status as the source (never serialized).
    pub fn from_grpc_status(status: &tonic::Status, upstream: UpstreamService) -> Self {
        let code = grpc_code_to_error_code(status.code());
        let retryable = code.retryable();

        error!(
            error.code = %code,
            error.grpc_code = %status.code(),
            error.message = %status.message(),
            upstream = %upstream,
            "Downstream gRPC error mapped to AppError"
        );

        Self {
            code,
            message: client_safe_message(&code, status.message()),
            request_id: None,
            retryable,
            degraded: false,
            upstream: Some(upstream),
            retry_after_ms: None,
            source: Some(Box::new(StatusError(status.to_string()))),
        }
    }

    /// Set the request ID.
    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = Some(id.into());
        self
    }

    /// Override retryability.
    pub fn with_retryable(mut self, retryable: bool) -> Self {
        self.retryable = retryable;
        self
    }

    /// Mark this error as a degraded response.
    pub fn with_degraded(mut self) -> Self {
        self.degraded = true;
        self
    }

    /// Set the upstream service that caused this error.
    pub fn with_upstream(mut self, upstream: UpstreamService) -> Self {
        self.upstream = Some(upstream);
        self
    }

    /// Set retry_after_ms (typically from 429 responses).
    pub fn with_retry_after_ms(mut self, ms: u64) -> Self {
        self.retry_after_ms = Some(ms);
        self
    }

    /// Attach the original error source for logging (not serialized).
    pub fn with_source(mut self, err: impl std::error::Error + Send + Sync + 'static) -> Self {
        self.source = Some(Box::new(err));
        self
    }

    /// Get the HTTP status code for this error.
    pub fn http_status(&self) -> StatusCode {
        self.code.http_status()
    }

    /// Convert to the serializable error response.
    pub fn to_error_response(&self) -> ErrorResponse {
        ErrorResponse {
            code: self.code.to_string(),
            message: client_safe_message(&self.code, &self.message),
            request_id: self.request_id.clone(),
            retryable: self.retryable,
            degraded: self.degraded,
            upstream: self.upstream.map(|u| u.to_string()),
            retry_after_ms: self.retry_after_ms,
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        self.source
            .as_ref()
            .map(|s| s.as_ref() as &(dyn std::error::Error + 'static))
    }
}

/// Implement axum `IntoResponse` so `AppError` can be returned directly from handlers.
impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = self.http_status();
        let body = self.to_error_response();
        (status, axum::Json(body)).into_response()
    }
}

/// Implement `From<AppError> for tonic::Status` for south-facing gRPC error conversion.
impl From<AppError> for tonic::Status {
    fn from(err: AppError) -> Self {
        tonic::Status::new(err.code.grpc_code(), err.message)
    }
}

/// Result type alias for application code.
pub type Result<T> = std::result::Result<T, AppError>;

// ---------------------------------------------------------------------------
// gRPC Code → ErrorCode mapping
// ---------------------------------------------------------------------------

/// Map a tonic gRPC Code to the appropriate ErrorCode.
///
/// Uses the mapping from design doc §14.2.
pub fn grpc_code_to_error_code(code: Code) -> ErrorCode {
    match code {
        Code::Ok => ErrorCode::Ok,
        Code::Cancelled => ErrorCode::StreamInterrupted,
        Code::Unknown => ErrorCode::InternalError,
        Code::InvalidArgument => ErrorCode::InvalidArgument,
        Code::DeadlineExceeded => ErrorCode::StreamTimeout,
        Code::NotFound => ErrorCode::ResourceNotFound,
        Code::AlreadyExists => ErrorCode::Conflict,
        Code::PermissionDenied => ErrorCode::AuthFailed,
        Code::ResourceExhausted => ErrorCode::RateLimited,
        Code::FailedPrecondition => ErrorCode::DependencyFailed,
        Code::Aborted => ErrorCode::Conflict,
        Code::OutOfRange => ErrorCode::TokenBudgetExceeded,
        Code::Unimplemented => ErrorCode::InternalError,
        Code::Internal => ErrorCode::InternalError,
        Code::Unavailable => ErrorCode::UpstreamUnavailable,
        Code::DataLoss => ErrorCode::InternalError,
        Code::Unauthenticated => ErrorCode::AuthFailed,
    }
}

// ---------------------------------------------------------------------------
// Client-safe message helper
// ---------------------------------------------------------------------------

/// Returns a client-safe error message, masking internal details.
fn client_safe_message(code: &ErrorCode, raw_message: &str) -> String {
    match code {
        ErrorCode::InternalError => "An internal error occurred".to_string(),
        ErrorCode::UpstreamUnavailable => "A downstream service is temporarily unavailable".to_string(),
        ErrorCode::DependencyFailed => "A dependency service reported an error".to_string(),
        // Non-internal errors: pass through the message (may still contain
        // downstream details but are not security-sensitive).
        _ => raw_message.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Internal error wrapper for source chain
// ---------------------------------------------------------------------------

/// Wrapper to store error messages as `Error` sources.
#[derive(Debug)]
struct StatusError(String);

impl std::fmt::Display for StatusError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for StatusError {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[path = "../tests/reliability/error_tests.rs"]
mod tests;
