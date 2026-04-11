use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::Result;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    pub app: AppSection,
    pub server: ServerSection,
    pub postgres: PostgresSection,
    pub object_store: ObjectStoreSection,
    pub index: IndexSection,
    pub capabilities: CapabilitiesSection,
    pub summary: SummarySection,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PostgresSection {
    pub dsn: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ObjectStoreSection {
    pub endpoint: String,
    pub bucket: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IndexSection {
    pub mode: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CapabilitiesSection {
    pub ttl_secs: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SummarySection {
    pub async_enabled: bool,
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

        apply_env_overrides(&mut config)?;
        if config.app.version.trim().is_empty() {
            config.app.version = env!("CARGO_PKG_VERSION").to_string();
        }
        config.validate()?;
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
        if !other.postgres.dsn.trim().is_empty() {
            self.postgres.dsn = other.postgres.dsn;
        }
        if !other.object_store.endpoint.trim().is_empty() {
            self.object_store.endpoint = other.object_store.endpoint;
        }
        if !other.object_store.bucket.trim().is_empty() {
            self.object_store.bucket = other.object_store.bucket;
        }
        if !other.object_store.access_key.trim().is_empty() {
            self.object_store.access_key = other.object_store.access_key;
        }
        if !other.object_store.secret_key.trim().is_empty() {
            self.object_store.secret_key = other.object_store.secret_key;
        }
        if !other.object_store.region.trim().is_empty() {
            self.object_store.region = other.object_store.region;
        }
        if !other.index.mode.trim().is_empty() {
            self.index.mode = other.index.mode;
        }
        if other.capabilities.ttl_secs > 0 {
            self.capabilities.ttl_secs = other.capabilities.ttl_secs;
        }
        self.summary.async_enabled = other.summary.async_enabled;
    }

    fn validate(&self) -> Result<()> {
        validate_non_empty("app.name", &self.app.name)?;
        validate_non_empty("app.env", &self.app.env)?;
        validate_non_empty("server.grpc_addr", &self.server.grpc_addr)?;
        validate_non_empty("server.metrics_addr", &self.server.metrics_addr)?;
        validate_non_empty("postgres.dsn", &self.postgres.dsn)?;
        validate_non_empty("object_store.endpoint", &self.object_store.endpoint)?;
        validate_non_empty("object_store.bucket", &self.object_store.bucket)?;
        validate_non_empty("object_store.access_key", &self.object_store.access_key)?;
        validate_non_empty("object_store.secret_key", &self.object_store.secret_key)?;
        validate_non_empty("object_store.region", &self.object_store.region)?;
        validate_non_empty("index.mode", &self.index.mode)?;

        if self.capabilities.ttl_secs == 0 {
            anyhow::bail!("capabilities.ttl_secs must be greater than 0");
        }

        Ok(())
    }

    pub fn redacted_summary(&self) -> String {
        serde_json::json!({
            "app": {
                "name": self.app.name,
                "env": self.app.env,
                "version": self.app.version,
            },
            "server": {
                "grpc_addr": self.server.grpc_addr,
                "metrics_addr": self.server.metrics_addr,
            },
            "postgres": {
                "dsn": mask_connection_string(&self.postgres.dsn),
            },
            "object_store": {
                "endpoint": self.object_store.endpoint,
                "bucket": self.object_store.bucket,
                "access_key": mask_secret(&self.object_store.access_key),
                "secret_key": mask_secret(&self.object_store.secret_key),
                "region": self.object_store.region,
            },
            "index": {
                "mode": self.index.mode,
            },
            "capabilities": {
                "ttl_secs": self.capabilities.ttl_secs,
            },
            "summary": {
                "async_enabled": self.summary.async_enabled,
            }
        })
        .to_string()
    }
}

fn apply_env_overrides(config: &mut AppConfig) -> Result<()> {
    if let Some(value) = env_override("APP__NAME") {
        config.app.name = value;
    }
    if let Some(value) = env_override("APP__ENV") {
        config.app.env = value;
    }
    if let Some(value) = env_override("APP__VERSION") {
        config.app.version = value;
    }
    if let Some(value) = env_override("SERVER__GRPC_ADDR") {
        config.server.grpc_addr = value;
    }
    if let Some(value) = env_override("SERVER__METRICS_ADDR") {
        config.server.metrics_addr = value;
    }
    if let Some(value) = env_override("POSTGRES__DSN") {
        config.postgres.dsn = value;
    }
    if let Some(value) = env_override("OBJECT_STORE__ENDPOINT") {
        config.object_store.endpoint = value;
    }
    if let Some(value) = env_override("OBJECT_STORE__BUCKET") {
        config.object_store.bucket = value;
    }
    if let Some(value) = env_override("OBJECT_STORE__ACCESS_KEY") {
        config.object_store.access_key = value;
    }
    if let Some(value) = env_override("OBJECT_STORE__SECRET_KEY") {
        config.object_store.secret_key = value;
    }
    if let Some(value) = env_override("OBJECT_STORE__REGION") {
        config.object_store.region = value;
    }
    if let Some(value) = env_override("INDEX__MODE") {
        config.index.mode = value;
    }
    if let Some(value) = env_override("CAPABILITIES__TTL_SECS") {
        config.capabilities.ttl_secs = parse_u64("CAPABILITIES__TTL_SECS", &value)?;
    }
    if let Some(value) = env_override("SUMMARY__ASYNC_ENABLED") {
        config.summary.async_enabled = parse_bool("SUMMARY__ASYNC_ENABLED", &value)?;
    }
    Ok(())
}

fn env_override(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .or_else(|| std::env::var(format!("KODUCK_MEMORY__{key}")).ok())
}

fn validate_non_empty(field: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        anyhow::bail!("{field} must not be empty");
    }
    Ok(())
}

fn parse_u64(key: &str, value: &str) -> Result<u64> {
    value
        .parse::<u64>()
        .map_err(|_| anyhow::anyhow!("{key} must be a valid unsigned integer"))
}

fn parse_bool(key: &str, value: &str) -> Result<bool> {
    value
        .parse::<bool>()
        .map_err(|_| anyhow::anyhow!("{key} must be either true or false"))
}

fn mask_secret(value: &str) -> String {
    if value.trim().is_empty() {
        return "<empty>".to_string();
    }
    if value.len() <= 4 {
        return "****".to_string();
    }
    format!("{}***{}", &value[..2], &value[value.len() - 2..])
}

fn mask_connection_string(value: &str) -> String {
    if value.trim().is_empty() {
        return "<empty>".to_string();
    }
    if let Some((scheme, rest)) = value.split_once("://") {
        if let Some((auth, tail)) = rest.split_once('@') {
            let masked_auth = if let Some((username, _)) = auth.split_once(':') {
                format!("{username}:***")
            } else {
                "***".to_string()
            };
            return format!("{scheme}://{masked_auth}@{tail}");
        }
    }
    "***".to_string()
}

#[cfg(test)]
mod tests {
    use super::{mask_connection_string, mask_secret, AppConfig};

    fn sample_config() -> AppConfig {
        toml::from_str(
            r#"
            [app]
            name = "koduck-memory"
            env = "test"
            version = "0.1.0"

            [server]
            grpc_addr = "127.0.0.1:50051"
            metrics_addr = "127.0.0.1:9090"

            [postgres]
            dsn = "postgresql://koduck:supersecret@postgres:5432/koduck_memory"

            [object_store]
            endpoint = "http://minio:9000"
            bucket = "koduck-memory"
            access_key = "minioadmin"
            secret_key = "supersecret"
            region = "ap-east-1"

            [index]
            mode = "domain-first"

            [capabilities]
            ttl_secs = 60

            [summary]
            async_enabled = true
            "#,
        )
        .expect("valid test config")
    }

    #[test]
    fn redacted_summary_hides_secrets() {
        let summary = sample_config().redacted_summary();
        assert!(summary.contains("mi***in"));
        assert!(summary.contains("su***et"));
        assert!(!summary.contains("supersecret@postgres"));
        assert!(!summary.contains("\"secret_key\":\"supersecret\""));
    }

    #[test]
    fn secret_masking_is_stable() {
        assert_eq!(mask_secret("abcd"), "****");
        assert_eq!(mask_secret("abcdef"), "ab***ef");
        assert_eq!(
            mask_connection_string("postgresql://koduck:supersecret@postgres:5432/koduck_memory"),
            "postgresql://koduck:***@postgres:5432/koduck_memory"
        );
    }
}
