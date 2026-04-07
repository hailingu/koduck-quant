//! Token management service

use crate::{
    error::{AppError, Result},
    model::Claims,
    repository::{RedisCache, RefreshTokenRepository},
    service::JwtServiceWrapper,
};
use tracing::{info, warn};

/// Token management service
#[derive(Clone)]
pub struct TokenService {
    token_repo: RefreshTokenRepository,
    redis: RedisCache,
    jwt_service: JwtServiceWrapper,
}

impl TokenService {
    /// Create new token service
    pub fn new(
        token_repo: RefreshTokenRepository,
        redis: RedisCache,
        jwt_service: JwtServiceWrapper,
    ) -> Self {
        Self {
            token_repo,
            redis,
            jwt_service,
        }
    }

    /// Introspect access token
    /// Returns true if token is valid, false otherwise
    pub async fn introspect_token(&self, token: &str) -> Result<bool> {
        // Validate JWT signature and expiration
        let claims = match self.jwt_service.validate_token(token) {
            Ok(claims) => claims,
            Err(e) => {
                warn!("Token validation failed: {}", e);
                return Ok(false);
            }
        };

        // Check if token is in blacklist
        if self.is_token_revoked(&claims.jti).await? {
            warn!("Token is in blacklist: {}", claims.jti);
            return Ok(false);
        }

        Ok(true)
    }

    /// Introspect access token with details
    /// Returns the claims if token is valid
    pub async fn introspect_token_with_claims(&self, token: &str) -> Result<Option<Claims>> {
        // Validate JWT signature and expiration
        let claims = match self.jwt_service.validate_token(token) {
            Ok(claims) => claims,
            Err(_) => return Ok(None),
        };

        // Check if token is in blacklist
        if self.is_token_revoked(&claims.jti).await? {
            return Ok(None);
        }

        Ok(Some(claims))
    }

    /// Revoke token by JTI
    pub async fn revoke_token_by_jti(&self, jti: &str, exp: usize) -> Result<()> {
        // Add to Redis blacklist with TTL = token expiration time
        self.redis.add_to_token_blacklist(jti, exp).await?;
        info!("Token revoked: {}", jti);
        Ok(())
    }

    /// Revoke refresh token
    pub async fn revoke_token(&self, token: &str, _user_id: i64) -> Result<()> {
        // Calculate token hash
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(token);
        let token_hash = format!("{:x}", hasher.finalize());

        // Revoke refresh token from database
        self.token_repo.revoke(&token_hash).await?;

        // Also try to add access token to blacklist if it's provided
        // Note: For refresh tokens, we don't have a JTI in the same way,
        // but if the token is a JWT, we should blacklist it
        if let Ok(claims) = self.jwt_service.validate_token(token) {
            self.revoke_token_by_jti(&claims.jti, claims.exp).await?;
        }

        Ok(())
    }

    /// Check if token is revoked (in blacklist)
    async fn is_token_revoked(&self, jti: &str) -> Result<bool> {
        self.redis.is_token_revoked(jti).await
    }
}
