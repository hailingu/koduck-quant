use tonic::Status;
use tracing::error;

use crate::{
    clients::proto::ErrorDetail,
    reliability::error::{grpc_code_to_error_code, AppError, ErrorCode, UpstreamService},
};

pub fn map_transport_error(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    context: &'static str,
    err: impl std::fmt::Display,
) -> AppError {
    let request_id = request_id.into();
    let message = format!("{context}: {err}");
    let app_error = AppError::new(ErrorCode::UpstreamUnavailable, message)
        .with_request_id(request_id.clone())
        .with_upstream(upstream);

    emit_mapping_log(&app_error, "transport_error");
    app_error
}

pub fn map_grpc_status(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    status: &Status,
) -> AppError {
    let request_id = request_id.into();
    let code = grpc_code_to_error_code(status.code());
    let mut app_error = AppError::new(code, status.message().to_string())
        .with_request_id(request_id.clone())
        .with_upstream(upstream)
        .with_source(StatusSnapshot(status.to_string()));

    if let Some(retry_after_ms) = retry_after_ms_from_status(status) {
        app_error = app_error.with_retry_after_ms(retry_after_ms);
    }

    emit_mapping_log(&app_error, "grpc_status");
    app_error
}

pub fn map_contract_error_detail(
    upstream: UpstreamService,
    request_id: impl Into<String>,
    detail: Option<&ErrorDetail>,
    fallback_code: ErrorCode,
    fallback_message: &'static str,
) -> AppError {
    let request_id = request_id.into();

    let mut app_error = match detail {
        Some(detail) => {
            let code = parse_standard_error_code(&detail.code).unwrap_or(fallback_code);
            let message = if detail.message.trim().is_empty() {
                fallback_message.to_string()
            } else {
                detail.message.clone()
            };

            let mut app_error = AppError::new(code, message)
                .with_request_id(request_id.clone())
                .with_upstream(upstream)
                .with_retryable(detail.retryable)
                .with_source(ContractErrorSnapshot {
                    code: detail.code.clone(),
                    message: detail.message.clone(),
                });

            if detail.degraded {
                app_error = app_error.with_degraded();
            }
            if detail.retry_after_ms > 0 {
                app_error = app_error.with_retry_after_ms(detail.retry_after_ms as u64);
            }

            app_error
        }
        None => AppError::new(fallback_code, fallback_message)
            .with_request_id(request_id.clone())
            .with_upstream(upstream),
    };

    app_error = sanitize_mapped_error(app_error);
    emit_mapping_log(&app_error, "contract_error_detail");
    app_error
}

fn sanitize_mapped_error(mut err: AppError) -> AppError {
    err.message = match err.code {
        ErrorCode::InternalError => "An internal error occurred".to_string(),
        ErrorCode::UpstreamUnavailable => {
            "A downstream service is temporarily unavailable".to_string()
        }
        ErrorCode::DependencyFailed => "A dependency service reported an error".to_string(),
        _ => err.message,
    };
    err
}

fn retry_after_ms_from_status(status: &Status) -> Option<u64> {
    status
        .metadata()
        .get("retry-after-ms")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn parse_standard_error_code(raw: &str) -> Option<ErrorCode> {
    match raw.trim().to_ascii_uppercase().as_str() {
        "OK" => Some(ErrorCode::Ok),
        "INVALID_ARGUMENT" => Some(ErrorCode::InvalidArgument),
        "AUTH_FAILED" => Some(ErrorCode::AuthFailed),
        "RESOURCE_NOT_FOUND" => Some(ErrorCode::ResourceNotFound),
        "CONFLICT" => Some(ErrorCode::Conflict),
        "TOKEN_BUDGET_EXCEEDED" => Some(ErrorCode::TokenBudgetExceeded),
        "RATE_LIMITED" => Some(ErrorCode::RateLimited),
        "SERVER_BUSY" => Some(ErrorCode::ServerBusy),
        "UPSTREAM_UNAVAILABLE" => Some(ErrorCode::UpstreamUnavailable),
        "DEPENDENCY_FAILED" => Some(ErrorCode::DependencyFailed),
        "INTERNAL_ERROR" => Some(ErrorCode::InternalError),
        "STREAM_TIMEOUT" => Some(ErrorCode::StreamTimeout),
        "STREAM_INTERRUPTED" => Some(ErrorCode::StreamInterrupted),
        _ => None,
    }
}

fn emit_mapping_log(err: &AppError, source: &'static str) {
    error!(
        error.code = %err.code,
        error.retryable = err.retryable,
        error.degraded = err.degraded,
        error.upstream = ?err.upstream,
        error.retry_after_ms = ?err.retry_after_ms,
        mapping.source = source,
        "downstream error mapped to unified app error"
    );
}

#[derive(Debug)]
struct StatusSnapshot(String);

impl std::fmt::Display for StatusSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for StatusSnapshot {}

#[derive(Debug)]
struct ContractErrorSnapshot {
    code: String,
    message: String,
}

impl std::fmt::Display for ContractErrorSnapshot {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ContractErrorSnapshot {}

#[cfg(test)]
#[path = "../tests/reliability/error_mapper_tests.rs"]
mod tests;
