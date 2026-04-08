//! Password hashing utilities using Argon2

use crate::{
    config::SecurityConfig,
    error::{AppError, Result},
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use std::sync::Arc;

/// Password hasher with configurable Argon2 parameters
#[derive(Clone)]
pub struct PasswordHasher {
    argon2: Arc<Argon2<'static>>,
}

impl PasswordHasher {
    /// Create new password hasher with default Argon2 parameters
    pub fn new() -> Self {
        Self {
            argon2: Arc::new(Argon2::default()),
        }
    }

    /// Create new password hasher with custom Argon2 parameters
    pub fn with_config(config: &SecurityConfig) -> Result<Self> {
        let params = Params::new(
            config.argon2_memory_cost,
            config.argon2_time_cost,
            config.argon2_parallelism,
            None, // output length (default)
        )
        .map_err(|e| AppError::Config(format!("Invalid Argon2 parameters: {}", e)))?;

        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

        Ok(Self {
            argon2: Arc::new(argon2),
        })
    }

    /// Hash a password using Argon2id
    pub async fn hash_password(&self, password: &str) -> Result<String> {
        let password = password.to_string();
        let argon2 = self.argon2.clone();

        tokio::task::spawn_blocking(move || {
            let salt = SaltString::generate(&mut OsRng);

            argon2
                .hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|e| AppError::PasswordHash(e.to_string()))
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
    }

    /// Verify a password against a hash
    pub async fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        let password = password.to_string();
        let hash = hash.to_string();
        let argon2 = self.argon2.clone();

        tokio::task::spawn_blocking(move || {
            let parsed_hash = PasswordHash::new(&hash)
                .map_err(|e| AppError::PasswordHash(e.to_string()))?;

            Ok::<bool, AppError>(
                argon2
                    .verify_password(password.as_bytes(), &parsed_hash)
                    .is_ok(),
            )
        })
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
    }
}

impl Default for PasswordHasher {
    fn default() -> Self {
        Self::new()
    }
}

/// Hash a password using Argon2id with default parameters
/// Deprecated: Use PasswordHasher::with_config() for configurable parameters
pub async fn hash_password(password: &str) -> Result<String> {
    let hasher = PasswordHasher::new();
    hasher.hash_password(password).await
}

/// Verify a password against a hash with default parameters
/// Deprecated: Use PasswordHasher::with_config() for configurable parameters
pub async fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let hasher = PasswordHasher::new();
    hasher.verify_password(password, hash).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_password_hash_and_verify() {
        let password = "test_password_123";
        
        // Hash password
        let hash = hash_password(password).await.unwrap();
        assert!(!hash.is_empty());
        
        // Verify correct password
        let is_valid = verify_password(password, &hash).await.unwrap();
        assert!(is_valid);
        
        // Verify wrong password
        let is_valid = verify_password("wrong_password", &hash).await.unwrap();
        assert!(!is_valid);
    }
}
