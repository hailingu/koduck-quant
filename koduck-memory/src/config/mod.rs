use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::Result;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    pub app: AppSection,
    pub server: ServerSection,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppSection {
    pub name: String,
    pub env: String,
    pub version: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerSection {
    pub grpc_addr: String,
    pub metrics_addr: String,
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        let _ = dotenvy::dotenv();

        let default_raw = std::fs::read_to_string(Path::new("config/default.toml"))?;
        let mut config: Self = toml::from_str(&default_raw)?;

        if Path::new("config/local.toml").exists() {
            let local_raw = std::fs::read_to_string(Path::new("config/local.toml"))?;
            let local: Self = toml::from_str(&local_raw)?;
            config.merge(local);
        }

        apply_env_overrides(&mut config);
        if config.app.version.trim().is_empty() {
            config.app.version = env!("CARGO_PKG_VERSION").to_string();
        }
        Ok(config)
    }

    fn merge(&mut self, other: Self) {
        if !other.app.name.trim().is_empty() {
            self.app.name = other.app.name;
        }
        if !other.app.env.trim().is_empty() {
            self.app.env = other.app.env;
        }
        if !other.app.version.trim().is_empty() {
            self.app.version = other.app.version;
        }
        if !other.server.grpc_addr.trim().is_empty() {
            self.server.grpc_addr = other.server.grpc_addr;
        }
        if !other.server.metrics_addr.trim().is_empty() {
            self.server.metrics_addr = other.server.metrics_addr;
        }
    }
}

fn apply_env_overrides(config: &mut AppConfig) {
    if let Ok(value) = std::env::var("KODUCK_MEMORY__APP__NAME") {
        config.app.name = value;
    }
    if let Ok(value) = std::env::var("KODUCK_MEMORY__APP__ENV") {
        config.app.env = value;
    }
    if let Ok(value) = std::env::var("KODUCK_MEMORY__APP__VERSION") {
        config.app.version = value;
    }
    if let Ok(value) = std::env::var("KODUCK_MEMORY__SERVER__GRPC_ADDR") {
        config.server.grpc_addr = value;
    }
    if let Ok(value) = std::env::var("KODUCK_MEMORY__SERVER__METRICS_ADDR") {
        config.server.metrics_addr = value;
    }
}
