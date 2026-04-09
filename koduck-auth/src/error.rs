//! Error handling for koduck-auth

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;
use tonic::Status;
use tracing::error;

/// Application error types
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Authentication failed: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Resource locked: {0}")]
    Locked(String),

    #[error("Rate limit exceeded: {0}")]
    TooManyRequests(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("JWT error: {0}")]
    Jwt(String),

    #[error("Password hash error: {0}")]
    PasswordHash(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Error response structure
#[derive(Serialize, Debug)]
pub struct ErrorResponse {
    pub success: bool,
    pub code: String,
    pub message: String,
    pub timestamp: String,
    pub error_id: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl AppError {
    /// Get HTTP status code for the error
    pub fn status_code(&self) -> StatusCode {
        match self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Locked(_) => StatusCode::LOCKED,
            AppError::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Config(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Jwt(_) => StatusCode::UNAUTHORIZED,
            AppError::PasswordHash(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Get error code string for the error
    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            AppError::Forbidden(_) => "FORBIDDEN",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Conflict(_) => "CONFLICT",
            AppError::Locked(_) => "RESOURCE_LOCKED",
            AppError::TooManyRequests(_) => "RATE_LIMIT_EXCEEDED",
            AppError::Internal(_) => "INTERNAL_ERROR",
            AppError::ServiceUnavailable(_) => "SERVICE_UNAVAILABLE",
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Config(_) => "CONFIG_ERROR",
            AppError::Jwt(_) => "JWT_ERROR",
            AppError::PasswordHash(_) => "PASSWORD_HASH_ERROR",
            AppError::Io(_) => "IO_ERROR",
        }
    }

    /// Get safe error message for client (hides internal details)
    pub fn client_message(&self) -> String {
        match self {
            // Internal errors should not expose details to client
            AppError::Internal(_) => "An internal error occurred".to_string(),
            AppError::Database(_) => "A database error occurred".to_string(),
            AppError::Config(_) => "A configuration error occurred".to_string(),
            AppError::PasswordHash(_) => "An authentication error occurred".to_string(),
            AppError::Io(_) => "An internal error occurred".to_string(),
            // Other errors can expose their messages
            _ => self.to_string(),
        }
    }

    /// Whether client may safely retry this error.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            AppError::ServiceUnavailable(_) | AppError::TooManyRequests(_) | AppError::Io(_)
        )
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let message = self.client_message();
        let code = self.error_code().to_string();

        // Log internal errors for debugging
        // Only log errors that indicate system issues, not user errors
        match &self {
            AppError::Internal(msg) => {
                error!(error = %self, error_code = %code, message = %msg, "Internal server error occurred");
            }
            AppError::Database(err) => {
                error!(error = %self, error_code = %code, error_source = %err, "Database error occurred");
            }
            AppError::Config(msg) => {
                error!(error = %self, error_code = %code, message = %msg, "Configuration error occurred");
            }
            AppError::PasswordHash(msg) => {
                error!(error = %self, error_code = %code, message = %msg, "Password hash error occurred");
            }
            AppError::Io(err) => {
                error!(error = %self, error_code = %code, error_source = %err, "I/O error occurred");
            }
            // User errors are not logged at error level to avoid noise
            // They can be traced at debug level if needed
            _ => {
                tracing::debug!(error = %self, error_code = %code, "User-facing error occurred");
            }
        }

        let body = Json(ErrorResponse {
            success: false,
            code,
            message,
            timestamp: chrono::Utc::now().to_rfc3339(),
            error_id: uuid::Uuid::new_v4().to_string(),
            retryable: self.is_retryable(),
            request_id: None,
            path: None,
        });

        (status, body).into_response()
    }
}

impl From<AppError> for Status {
    fn from(error: AppError) -> Self {
        match error {
            AppError::Unauthorized(msg) => Status::unauthenticated(msg),
            AppError::Forbidden(msg) => Status::permission_denied(msg),
            AppError::NotFound(msg) => Status::not_found(msg),
            AppError::Validation(msg) => Status::invalid_argument(msg),
            AppError::Conflict(msg) => Status::already_exists(msg),
            AppError::Locked(msg) => Status::failed_precondition(msg),
            AppError::TooManyRequests(msg) => Status::resource_exhausted(msg),
            AppError::ServiceUnavailable(msg) => Status::unavailable(msg),
            _ => Status::internal(error.to_string()),
        }
    }
}

impl From<argon2::password_hash::Error> for AppError {
    fn from(err: argon2::password_hash::Error) -> Self {
        AppError::PasswordHash(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::Jwt(err.to_string())
    }
}

impl From<config::ConfigError> for AppError {
    fn from(err: config::ConfigError) -> Self {
        AppError::Config(err.to_string())
    }
}

impl From<deadpool_redis::PoolError> for AppError {
    fn from(err: deadpool_redis::PoolError) -> Self {
        AppError::Internal(format!("Redis pool error: {}", err))
    }
}

impl From<deadpool_redis::redis::RedisError> for AppError {
    fn from(err: deadpool_redis::redis::RedisError) -> Self {
        AppError::Internal(format!("Redis error: {}", err))
    }
}

impl From<validator::ValidationErrors> for AppError {
    fn from(err: validator::ValidationErrors) -> Self {
        AppError::Validation(err.to_string())
    }
}

impl From<Box<dyn std::error::Error>> for AppError {
    fn from(err: Box<dyn std::error::Error>) -> Self {
        AppError::Internal(err.to_string())
    }
}

/// Result type alias for the application
pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_code_mapping() {
        // Test that all error types have correct error codes
        assert_eq!(AppError::Unauthorized("test".to_string()).error_code(), "UNAUTHORIZED");
        assert_eq!(AppError::Forbidden("test".to_string()).error_code(), "FORBIDDEN");
        assert_eq!(AppError::NotFound("test".to_string()).error_code(), "NOT_FOUND");
        assert_eq!(AppError::Validation("test".to_string()).error_code(), "VALIDATION_ERROR");
        assert_eq!(AppError::Conflict("test".to_string()).error_code(), "CONFLICT");
        assert_eq!(AppError::Locked("test".to_string()).error_code(), "RESOURCE_LOCKED");
        assert_eq!(AppError::TooManyRequests("test".to_string()).error_code(), "RATE_LIMIT_EXCEEDED");
        assert_eq!(AppError::Internal("test".to_string()).error_code(), "INTERNAL_ERROR");
        assert_eq!(AppError::ServiceUnavailable("test".to_string()).error_code(), "SERVICE_UNAVAILABLE");
        assert_eq!(AppError::Config("test".to_string()).error_code(), "CONFIG_ERROR");
        assert_eq!(AppError::Jwt("test".to_string()).error_code(), "JWT_ERROR");
        assert_eq!(AppError::PasswordHash("test".to_string()).error_code(), "PASSWORD_HASH_ERROR");
    }

    #[test]
    fn test_status_code_mapping() {
        assert_eq!(AppError::Unauthorized("test".to_string()).status_code(), StatusCode::UNAUTHORIZED);
        assert_eq!(AppError::Forbidden("test".to_string()).status_code(), StatusCode::FORBIDDEN);
        assert_eq!(AppError::NotFound("test".to_string()).status_code(), StatusCode::NOT_FOUND);
        assert_eq!(AppError::Validation("test".to_string()).status_code(), StatusCode::BAD_REQUEST);
        assert_eq!(AppError::Conflict("test".to_string()).status_code(), StatusCode::CONFLICT);
        assert_eq!(AppError::Internal("test".to_string()).status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_client_message_hides_internal_details() {
        // Internal errors should hide details
        let internal = AppError::Internal("sensitive database password: secret123".to_string());
        assert_eq!(internal.client_message(), "An internal error occurred");
        
        let db_error = AppError::Database(sqlx::Error::RowNotFound);
        assert_eq!(db_error.client_message(), "A database error occurred");
        
        let config_error = AppError::Config("secret key: abc".to_string());
        assert_eq!(config_error.client_message(), "A configuration error occurred");
        
        // User errors should show details
        let validation = AppError::Validation("Invalid email format".to_string());
        assert!(validation.client_message().contains("Invalid email format"));
        
        let unauthorized = AppError::Unauthorized("Invalid credentials".to_string());
        assert!(unauthorized.client_message().contains("Invalid credentials"));
    }

    #[test]
    fn test_error_response_format() {
        // Create an error and verify the response structure
        let error = AppError::Validation("Field 'email' is required".to_string());
        
        // Verify error code is string
        assert_eq!(error.error_code(), "VALIDATION_ERROR");
        
        // Verify status code
        assert_eq!(error.status_code(), StatusCode::BAD_REQUEST);
        
        // Verify client message
        assert!(error.client_message().contains("email"));
    }

    #[test]
    fn test_tonic_status_conversion() {
        let app_error = AppError::Unauthorized("token expired".to_string());
        let tonic_status: Status = app_error.into();
        assert_eq!(tonic_status.code(), tonic::Code::Unauthenticated);
        
        let app_error = AppError::NotFound("user not found".to_string());
        let tonic_status: Status = app_error.into();
        assert_eq!(tonic_status.code(), tonic::Code::NotFound);
        
        let app_error = AppError::Validation("invalid input".to_string());
        let tonic_status: Status = app_error.into();
        assert_eq!(tonic_status.code(), tonic::Code::InvalidArgument);
    }

    #[test]
    fn test_from_argon2_error() {
        // This tests the From implementation compiles correctly
        // We can't easily create a real argon2::password_hash::Error in test
        // So we just verify the conversion exists
        fn _verify_from_impl(err: argon2::password_hash::Error) -> AppError {
            err.into()
        }
    }

    #[test]
    fn test_from_jwt_error() {
        // Similar to above, verify the conversion exists
        fn _verify_from_impl(err: jsonwebtoken::errors::Error) -> AppError {
            err.into()
        }
    }

    #[test]
    fn test_error_chaining_display() {
        let error = AppError::Internal("database connection failed".to_string());
        let display = format!("{}", error);
        assert!(display.contains("database connection failed"));
        assert!(display.contains("Internal server error"));
    }
}
