//! RSA key loading utilities

use crate::error::{AppError, Result};
use rsa::{RsaPrivateKey, RsaPublicKey};
use std::path::Path;
use tracing::{info, warn};

/// Load RSA private key from PEM file
pub async fn load_private_key<P: AsRef<Path>>(path: P) -> Result<String> {
    let path = path.as_ref();
    
    if !path.exists() {
        return Err(AppError::Config(format!(
            "Private key file not found: {}",
            path.display()
        )));
    }

    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| AppError::Config(format!("Failed to read private key: {}", e)))
}

/// Load RSA public key from PEM file
pub async fn load_public_key<P: AsRef<Path>>(path: P) -> Result<String> {
    let path = path.as_ref();
    
    if !path.exists() {
        return Err(AppError::Config(format!(
            "Public key file not found: {}",
            path.display()
        )));
    }

    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| AppError::Config(format!("Failed to read public key: {}", e)))
}

/// Generate RSA key pair for development
pub async fn generate_dev_keys(private_path: &str, public_path: &str) -> Result<(String, String)> {
    warn!("Generating development RSA key pair...");
    
    use rsa::pkcs1::{EncodeRsaPrivateKey, EncodeRsaPublicKey};
    use rsa::rand_core::OsRng;
    
    let mut rng = OsRng;
    let private_key = RsaPrivateKey::new(&mut rng, 2048)
        .map_err(|e| AppError::Internal(format!("Failed to generate RSA key: {}", e)))?;
    let public_key = RsaPublicKey::from(&private_key);
    
    // Encode to PEM
    let private_pem = private_key
        .to_pkcs1_pem()
        .map_err(|e| AppError::Internal(format!("Failed to encode private key: {}", e)))?;
    
    let public_pem = public_key
        .to_pkcs1_pem()
        .map_err(|e| AppError::Internal(format!("Failed to encode public key: {}", e)))?;
    
    // Save to files
    if let Some(parent) = std::path::Path::new(private_path).parent() {
        tokio::fs::create_dir_all(parent).await.ok();
    }
    
    tokio::fs::write(private_path, &private_pem)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write private key: {}", e)))?;
    
    tokio::fs::write(public_path, &public_pem)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to write public key: {}", e)))?;
    
    info!("Development RSA key pair generated successfully");
    
    Ok((private_pem.to_string(), public_pem))
}

/// Load or generate RSA keys
pub async fn load_or_generate_keys(
    private_path: &str,
    public_path: &str,
    auto_generate: bool,
) -> Result<(String, String)> {
    let private_exists = std::path::Path::new(private_path).exists();
    let public_exists = std::path::Path::new(public_path).exists();
    
    if private_exists && public_exists {
        let private_key = load_private_key(private_path).await?;
        let public_key = load_public_key(public_path).await?;
        return Ok((private_key, public_key));
    }
    
    if auto_generate {
        generate_dev_keys(private_path, public_path).await
    } else {
        Err(AppError::Config(
            "RSA keys not found and auto-generate is disabled".to_string(),
        ))
    }
}
