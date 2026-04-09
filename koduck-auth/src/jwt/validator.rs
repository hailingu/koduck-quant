//! JWT token validation

use crate::{
    error::{AppError, Result},
    model::Claims,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

/// JWT validator
#[derive(Clone)]
pub struct JwtValidator {
    decoding_key: DecodingKey,
    audience: String,
    issuer: String,
}

impl JwtValidator {
    /// Create new JWT validator
    pub fn new(public_key_pem: &str, audience: String, issuer: String) -> Result<Self> {
        let decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
            .map_err(|e| AppError::Jwt(e.to_string()))?;

        Ok(Self {
            decoding_key,
            audience,
            issuer,
        })
    }

    /// Validate and decode token
    pub fn validate(&self, token: &str) -> Result<Claims> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[&self.audience]);
        validation.set_issuer(&[&self.issuer]);

        let token_data = decode::<Claims>(token, &self.decoding_key, &validation)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    AppError::Unauthorized("Token has expired".to_string())
                }
                _ => AppError::Unauthorized(format!("Invalid token: {}", e)),
            })?;

        Ok(token_data.claims)
    }
}
