//! JWT Service wrapper for business logic

use crate::{
    config::Config,
    crypto::load_or_generate_keys,
    error::{AppError, Result},
    jwt::{JwtService, JwtValidator},
    model::Claims,
};
use std::sync::Arc;
use tracing::{info, warn};

/// JWT Service wrapper containing both generator and validator
#[derive(Clone)]
pub struct JwtServiceWrapper {
    generator: Arc<JwtService>,
    validator: Arc<JwtValidator>,
    public_key_pem: String,
}

impl JwtServiceWrapper {
    /// Create new JWT service wrapper
    pub async fn new(config: &Config) -> Result<Self> {
        let auto_generate = std::env::var("KODUCK_AUTH_DEV_MODE")
            .ok()
            .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(false);

        let (private_key, public_key) = load_or_generate_keys(
            &config.jwt.private_key_path,
            &config.jwt.public_key_path,
            auto_generate,
        )
        .await?;

        info!("Loading RSA keys for JWT service...");

        let generator = JwtService::new(
            &private_key,
            config.jwt.key_id.clone(),
            config.jwt.access_token_expiration_secs,
            config.jwt.refresh_token_expiration_secs,
            config.jwt.issuer.clone(),
            config.jwt.audience.clone(),
        )?;

        let validator = JwtValidator::new(
            &public_key,
            config.jwt.audience.clone(),
            config.jwt.issuer.clone(),
        )?;

        info!("JWT service initialized successfully");

        Ok(Self {
            generator: Arc::new(generator),
            validator: Arc::new(validator),
            public_key_pem: public_key,
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
        self.generator
            .generate_access_token(user_id, username, email, roles)
    }

    /// Generate refresh token
    pub fn generate_refresh_token(&self, user_id: i64) -> Result<String> {
        self.generator.generate_refresh_token(user_id)
    }

    /// Validate and decode token
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        self.validator.validate(token)
    }

    /// Get public key PEM (for JWKS)
    pub fn public_key_pem(&self) -> &str {
        &self.public_key_pem
    }

    /// Get key ID
    pub fn key_id(&self) -> &str {
        self.generator.key_id()
    }
}
