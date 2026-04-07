//! Password hashing utilities using Argon2

use crate::error::{AppError, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

/// Hash a password using Argon2id
pub async fn hash_password(password: &str) -> Result<String> {
    let password = password.to_string();
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| AppError::PasswordHash(e.to_string()))
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
}

/// Verify a password against a hash
pub async fn verify_password(password: &str, hash: &str) -> Result<bool> {
    let password = password.to_string();
    let hash = hash.to_string();
    
    tokio::task::spawn_blocking(move || {
        let parsed_hash = PasswordHash::new(&hash)
            .map_err(|e| AppError::PasswordHash(e.to_string()))?;
        
        let argon2 = Argon2::default();
        
        Ok::<bool, AppError>(
            argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok()
        )
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?
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
