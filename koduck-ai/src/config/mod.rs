//! Configuration management for koduck-ai

use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use serde::Deserialize;

/// Application configuration
#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
}

/// Server configuration
#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub http_addr: String,
    pub grpc_addr: String,
    pub metrics_addr: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            http_addr: "0.0.0.0:8083".to_string(),
            grpc_addr: "0.0.0.0:50051".to_string(),
            metrics_addr: "0.0.0.0:9090".to_string(),
        }
    }
}

impl Config {
    /// Load configuration from environment variables and config files
    pub fn from_env() -> Result<Self, ConfigError> {
        let _ = dotenvy::dotenv();

        let config = ConfigBuilder::builder()
            // Default configuration
            .set_default("server.http_addr", "0.0.0.0:8083")?
            .set_default("server.grpc_addr", "0.0.0.0:50051")?
            .set_default("server.metrics_addr", "0.0.0.0:9090")?
            // Config file (optional)
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name("config/local").required(false))
            // Environment variables with prefix KODUCK_AI
            .add_source(Environment::with_prefix("KODUCK_AI").separator("__"))
            .build()?;

        config.try_deserialize()
    }
}
