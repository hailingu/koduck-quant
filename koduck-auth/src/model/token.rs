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
    pub key: String,        // APISIX jwt-auth consumer key
    pub sub: String,        // user_id
    pub tenant_id: String,
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
    pub tenant_id: String,
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
    pub tenant_id: String,
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

/// Token introspection result (RFC 7662)
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenIntrospectionResult {
    pub active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub roles: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iat: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}

impl TokenIntrospectionResult {
    /// Create inactive introspection result
    pub fn inactive() -> Self {
        Self {
            active: false,
            sub: None,
            tenant_id: None,
            username: None,
            email: None,
            jti: None,
            roles: Vec::new(),
            exp: None,
            iat: None,
            token_type: None,
        }
    }

    /// Create active introspection result from claims
    pub fn from_claims(claims: &Claims) -> Self {
        Self {
            active: true,
            sub: Some(claims.sub.clone()),
            tenant_id: Some(claims.tenant_id.clone()),
            username: Some(claims.username.clone()),
            email: Some(claims.email.clone()),
            jti: Some(claims.jti.clone()),
            roles: claims.roles.clone(),
            exp: Some(claims.exp as i64),
            iat: Some(claims.iat as i64),
            token_type: Some(format!("{:?}", claims.token_type)),
        }
    }
}
