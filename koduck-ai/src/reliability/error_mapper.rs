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
mod tests {
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
}
