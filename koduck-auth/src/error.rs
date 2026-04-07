//! Error handling for koduck-auth

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;
use tonic::Status;

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
    pub code: u16,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
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
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let message = self.client_message();
        let code = status.as_u16();

        let body = Json(json!({
            "success": false,
            "code": code,
            "message": message,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));

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
