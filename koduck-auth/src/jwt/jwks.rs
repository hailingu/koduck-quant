//! JWKS (JSON Web Key Set) generation

use crate::error::{AppError, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rsa::{traits::PublicKeyParts, RsaPublicKey, pkcs8::DecodePublicKey};

/// JWKS service
#[derive(Debug)]
pub struct JwksService {
    public_key: RsaPublicKey,
    key_id: String,
}

impl JwksService {
    /// Create new JWKS service
    pub fn new(public_key_pem: &str, key_id: String) -> Result<Self> {
        let public_key = RsaPublicKey::from_public_key_pem(public_key_pem)
            .map_err(|e| AppError::Jwt(format!("Failed to parse public key: {}", e)))?;

        Ok(Self {
            public_key,
            key_id,
        })
    }

    /// Get JWKS JSON
    pub fn get_jwks(&self) -> Result<serde_json::Value> {
        let n = URL_SAFE_NO_PAD.encode(self.public_key.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(self.public_key.e().to_bytes_be());

        Ok(serde_json::json!({
            "keys": [
                {
                    "kty": "RSA",
                    "kid": self.key_id,
                    "use": "sig",
                    "n": n,
                    "e": e,
                    "alg": "RS256"
                }
            ]
        }))
    }
}
