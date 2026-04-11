//! Token management service

use crate::{
    error::Result,
    jwt::JwtValidator,
    model::token::{TokenIntrospectionResult, TokenType},
    repository::{RedisCache, RefreshTokenRepository},
};

/// Token management service
#[derive(Clone)]
pub struct TokenService {
    token_repo: RefreshTokenRepository,
    redis: RedisCache,
    jwt_validator: JwtValidator,
}

impl TokenService {
    /// Create new token service
    pub fn new(
        token_repo: RefreshTokenRepository,
        redis: RedisCache,
        jwt_validator: JwtValidator,
    ) -> Self {
        Self {
            token_repo,
            redis,
            jwt_validator,
        }
    }

    /// Introspect access token
    /// Returns full token information according to RFC 7662
    pub async fn introspect_token(&self, token: &str) -> Result<TokenIntrospectionResult> {
        // Validate JWT signature and claims
        let claims = match self.jwt_validator.validate(token) {
            Ok(c) => c,
            Err(_) => return Ok(TokenIntrospectionResult::inactive()),
        };

        // Check token type - only introspect access tokens
        if !matches!(claims.token_type, TokenType::Access) {
            return Ok(TokenIntrospectionResult::inactive());
        }

        // Check if token is in blacklist
        let is_revoked = self.redis.is_token_revoked(&claims.jti).await?;
        if is_revoked {
            return Ok(TokenIntrospectionResult::inactive());
        }

        // Token is valid and active
        Ok(TokenIntrospectionResult::from_claims(&claims))
    }

    /// Revoke token
    /// Adds access token to blacklist and revokes refresh token
    pub async fn revoke_token(&self, token: &str, _user_id: i64) -> Result<()> {
        // Parse token to get JTI and expiration (without full validation)
        // We need to extract claims even for potentially expired tokens
        let claims = match self.jwt_validator.validate(token) {
            Ok(c) => c,
            Err(_) => {
                // Token is invalid or expired - still try to revoke refresh token
                // Revoke refresh token from database
                self.token_repo.revoke(token).await?;
                return Ok(());
            }
        };

        // Check token type
        if !matches!(claims.token_type, TokenType::Access) {
            return Err(crate::error::AppError::Validation(
                "Only access tokens can be revoked".to_string()
            ));
        }

        // Add JTI to blacklist in Redis with TTL = remaining token lifetime
        self.redis
            .add_to_token_blacklist(&claims.jti, claims.exp)
            .await?;

        // Revoke refresh token from database
        self.token_repo.revoke(token).await?;

        Ok(())
    }

    /// Check if a token is revoked
    pub async fn is_token_revoked(&self, jti: &str) -> Result<bool> {
        self.redis.is_token_revoked(jti).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jwt::JwtGenerator;

    // Helper function to create test validator and generator
    fn create_test_jwt_pair() -> (JwtValidator, JwtGenerator) {
        use crate::jwt::KeyPair;

        let key_pair = KeyPair::generate().unwrap();
        let validator = JwtValidator::new(
            &key_pair.public_key_pem,
            "test-audience".to_string(),
            "test-issuer".to_string(),
        )
        .unwrap();

        let generator = JwtGenerator::new(
            &key_pair.private_key_pem,
            "test-audience".to_string(),
            "test-issuer".to_string(),
            3600, // access token expiry
            86400 * 7, // refresh token expiry
        )
        .unwrap();

        (validator, generator)
    }

    #[test]
    fn test_token_introspection_result_inactive() {
        let result = TokenIntrospectionResult::inactive();
        assert!(!result.active);
        assert!(result.sub.is_none());
        assert!(result.username.is_none());
        assert!(result.email.is_none());
        assert!(result.jti.is_none());
        assert!(result.roles.is_empty());
        assert!(result.exp.is_none());
        assert!(result.iat.is_none());
    }

    #[test]
    fn test_token_introspection_result_from_claims() {
        use crate::model::token::{Claims, TokenType};

        let claims = Claims {
            sub: "123".to_string(),
            tenant_id: "tenant-a".to_string(),
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
            roles: vec!["user".to_string(), "admin".to_string()],
            token_type: TokenType::Access,
            exp: 1234567890,
            iat: 1234567800,
            jti: "jti-123".to_string(),
            iss: "test-issuer".to_string(),
            aud: "test-audience".to_string(),
        };

        let result = TokenIntrospectionResult::from_claims(&claims);
        assert!(result.active);
        assert_eq!(result.sub, Some("123".to_string()));
        assert_eq!(result.username, Some("testuser".to_string()));
        assert_eq!(result.email, Some("test@example.com".to_string()));
        assert_eq!(result.jti, Some("jti-123".to_string()));
        assert_eq!(result.roles, vec!["user".to_string(), "admin".to_string()]);
        assert_eq!(result.exp, Some(1234567890));
        assert_eq!(result.iat, Some(1234567800));
    }
}
