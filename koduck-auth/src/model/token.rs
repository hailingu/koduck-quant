//! Token model definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Token type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

/// JWT Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user_id
    pub username: String,
    pub email: String,
    pub roles: Vec<String>,
    #[serde(rename = "type")]
    pub token_type: TokenType,
    pub exp: usize,
    pub iat: usize,
    pub jti: String,        // JWT ID
    pub iss: String,
    pub aud: String,
}

/// Refresh token record in database
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RefreshTokenRecord {
    pub id: i64,
    pub user_id: i64,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// Password reset token record
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PasswordResetToken {
    pub id: i64,
    pub user_id: i64,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub used_at: Option<DateTime<Utc>>,
}

/// Token pair response
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

impl TokenPair {
    pub fn new(access_token: String, refresh_token: String, expires_in: i64) -> Self {
        Self {
            access_token,
            refresh_token,
            token_type: "Bearer".to_string(),
            expires_in,
        }
    }
}
