//! JWT token generation

use crate::{
    error::{AppError, Result},
    model::{Claims, TokenType},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use uuid::Uuid;

/// JWT service for token generation and validation
pub struct JwtService {
    encoding_key: EncodingKey,
    key_id: String,
    access_expiration: i64,
    refresh_expiration: i64,
    issuer: String,
    audience: String,
}

impl JwtService {
    /// Create new JWT service
    pub fn new(
        private_key_pem: &str,
        key_id: String,
        access_expiration: i64,
        refresh_expiration: i64,
        issuer: String,
        audience: String,
    ) -> Result<Self> {
        let encoding_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())
            .map_err(|e| AppError::Jwt(e.to_string()))?;

        Ok(Self {
            encoding_key,
            key_id,
            access_expiration,
            refresh_expiration,
            issuer,
            audience,
        })
    }

    /// Generate access token
    pub fn generate_access_token(
        &self,
        user_id: i64,
        username: &str,
        email: &str,
        roles: &[String],
    ) -> Result<String> {
        let now = Utc::now();
        let expiration = now + Duration::seconds(self.access_expiration);

        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            email: email.to_string(),
            roles: roles.to_vec(),
            token_type: TokenType::Access,
            exp: expiration.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: Uuid::new_v4().to_string(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
        };

        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.key_id.clone());

        encode(&header, &claims, &self.encoding_key)
            .map_err(|e| AppError::Jwt(e.to_string()))
    }

    /// Generate refresh token
    pub fn generate_refresh_token(&self, user_id: i64) -> Result<String> {
        let now = Utc::now();
        let expiration = now + Duration::seconds(self.refresh_expiration);

        let claims = Claims {
            sub: user_id.to_string(),
            username: String::new(),
            email: String::new(),
            roles: vec![],
            token_type: TokenType::Refresh,
            exp: expiration.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: Uuid::new_v4().to_string(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
        };

        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.key_id.clone());

        encode(&header, &claims, &self.encoding_key)
            .map_err(|e| AppError::Jwt(e.to_string()))
    }

    /// Get key ID
    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}
