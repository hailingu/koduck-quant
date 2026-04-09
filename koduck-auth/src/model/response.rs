//! HTTP response DTOs

use chrono::{DateTime, Utc};
use serde::Serialize;

use super::{TokenPair, UserInfo};

/// Standard API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    pub timestamp: DateTime<Utc>,
}

impl<T> ApiResponse<T> {
    /// Create success response
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            code: 200,
            message: None,
            data: Some(data),
            timestamp: Utc::now(),
        }
    }

    /// Create success response with message
    pub fn success_with_message(data: T, message: impl Into<String>) -> Self {
        Self {
            success: true,
            code: 200,
            message: Some(message.into()),
            data: Some(data),
            timestamp: Utc::now(),
        }
    }

    /// Create error response
    pub fn error(code: u16, message: impl Into<String>) -> Self {
        Self {
            success: false,
            code,
            message: Some(message.into()),
            data: None,
            timestamp: Utc::now(),
        }
    }
}

/// Token response with user info
#[derive(Debug, Serialize)]
pub struct TokenResponse {
    #[serde(flatten)]
    pub tokens: TokenPair,
    pub user: UserInfo,
}

impl TokenResponse {
    pub fn new(tokens: TokenPair, user: UserInfo) -> Self {
        Self { tokens, user }
    }
}

/// Security configuration response
#[derive(Debug, Serialize)]
pub struct SecurityConfigResponse {
    pub turnstile_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turnstile_site_key: Option<String>,
    pub registration_enabled: bool,
    pub oauth_google_enabled: bool,
    pub oauth_github_enabled: bool,
    pub password_policy: PasswordPolicyResponse,
}

/// Password policy response
#[derive(Debug, Serialize)]
pub struct PasswordPolicyResponse {
    pub min_length: u32,
    pub max_length: u32,
    pub require_uppercase: bool,
    pub require_lowercase: bool,
    pub require_digit: bool,
    pub require_special: bool,
}

/// JWKS response
#[derive(Debug, Serialize)]
pub struct JwksResponse {
    pub keys: Vec<JwkResponse>,
}

/// JWK key response
#[derive(Debug, Serialize)]
pub struct JwkResponse {
    pub kty: String,
    pub kid: String,
    pub r#use: String,
    pub n: String,
    pub e: String,
    pub alg: String,
}

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
}

/// Spring Boot actuator compatible health response
#[derive(Debug, Serialize)]
pub struct ActuatorHealthResponse {
    pub status: ActuatorStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ActuatorStatus {
    Up,
    Down,
}

/// Paged response wrapper
#[derive(Debug, Serialize)]
pub struct PagedResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}
