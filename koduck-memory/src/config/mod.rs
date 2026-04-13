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
    pub retry: RetrySection,
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
    pub llm_enabled: bool,
    pub llm_provider: String,
    pub llm_api_key: String,
    pub llm_base_url: String,
    pub llm_model: String,
    pub llm_timeout_ms: u64,
    pub llm_max_concurrency: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RetrySection {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
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
        self.summary.llm_enabled = other.summary.llm_enabled;
        if !other.summary.llm_provider.trim().is_empty() {
            self.summary.llm_provider = other.summary.llm_provider;
        }
        if !other.summary.llm_api_key.trim().is_empty() {
            self.summary.llm_api_key = other.summary.llm_api_key;
        }
        if !other.summary.llm_base_url.trim().is_empty() {
            self.summary.llm_base_url = other.summary.llm_base_url;
        }
        if !other.summary.llm_model.trim().is_empty() {
            self.summary.llm_model = other.summary.llm_model;
        }
        if other.summary.llm_timeout_ms > 0 {
            self.summary.llm_timeout_ms = other.summary.llm_timeout_ms;
        }
        if other.summary.llm_max_concurrency > 0 {
            self.summary.llm_max_concurrency = other.summary.llm_max_concurrency;
        }
        if other.retry.max_attempts > 0 {
            self.retry.max_attempts = other.retry.max_attempts;
        }
        if other.retry.initial_delay_ms > 0 {
            self.retry.initial_delay_ms = other.retry.initial_delay_ms;
        }
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

        if self.retry.max_attempts == 0 {
            anyhow::bail!("retry.max_attempts must be greater than 0");
        }

        if self.retry.initial_delay_ms == 0 {
            anyhow::bail!("retry.initial_delay_ms must be greater than 0");
        }

        if self.summary.llm_enabled {
            validate_non_empty("summary.llm_provider", &self.summary.llm_provider)?;
            validate_non_empty("summary.llm_api_key", &self.summary.llm_api_key)?;
            validate_non_empty("summary.llm_base_url", &self.summary.llm_base_url)?;
            validate_non_empty("summary.llm_model", &self.summary.llm_model)?;
            if self.summary.llm_timeout_ms == 0 {
                anyhow::bail!("summary.llm_timeout_ms must be greater than 0");
            }
            if self.summary.llm_max_concurrency == 0 {
                anyhow::bail!("summary.llm_max_concurrency must be greater than 0");
            }
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
                "llm_enabled": self.summary.llm_enabled,
                "llm_provider": self.summary.llm_provider,
                "llm_api_key": mask_secret(&self.summary.llm_api_key),
                "llm_base_url": self.summary.llm_base_url,
                "llm_model": self.summary.llm_model,
                "llm_timeout_ms": self.summary.llm_timeout_ms,
                "llm_max_concurrency": self.summary.llm_max_concurrency,
            },
            "retry": {
                "max_attempts": self.retry.max_attempts,
                "initial_delay_ms": self.retry.initial_delay_ms,
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
    if let Some(value) = env_override("SUMMARY__LLM_ENABLED") {
        config.summary.llm_enabled = parse_bool("SUMMARY__LLM_ENABLED", &value)?;
    }
    if let Some(value) = env_override("SUMMARY__LLM_PROVIDER") {
        config.summary.llm_provider = value;
    } else if let Some(value) = std::env::var("KODUCK_AI__LLM__DEFAULT_PROVIDER").ok() {
        config.summary.llm_provider = value;
    }
    if let Some(value) = env_override("SUMMARY__LLM_API_KEY") {
        config.summary.llm_api_key = value;
    } else if let Some(value) = std::env::var("KODUCK_AI__LLM__MINIMAX__API_KEY").ok() {
        config.summary.llm_api_key = value;
    }
    if let Some(value) = env_override("SUMMARY__LLM_BASE_URL") {
        config.summary.llm_base_url = value;
    } else if let Some(value) = std::env::var("KODUCK_AI__LLM__MINIMAX__BASE_URL").ok() {
        config.summary.llm_base_url = value;
    }
    if let Some(value) = env_override("SUMMARY__LLM_MODEL") {
        config.summary.llm_model = value;
    } else if let Some(value) = std::env::var("KODUCK_AI__LLM__MINIMAX__DEFAULT_MODEL").ok() {
        config.summary.llm_model = value;
    }
    if let Some(value) = env_override("SUMMARY__LLM_TIMEOUT_MS") {
        config.summary.llm_timeout_ms = parse_u64("SUMMARY__LLM_TIMEOUT_MS", &value)?;
    }
    if let Some(value) = env_override("SUMMARY__LLM_MAX_CONCURRENCY") {
        config.summary.llm_max_concurrency =
            parse_u64("SUMMARY__LLM_MAX_CONCURRENCY", &value)? as usize;
    }
    if let Some(value) = env_override("RETRY__MAX_ATTEMPTS") {
        config.retry.max_attempts = parse_u32("RETRY__MAX_ATTEMPTS", &value)?;
    }
    if let Some(value) = env_override("RETRY__INITIAL_DELAY_MS") {
        config.retry.initial_delay_ms = parse_u64("RETRY__INITIAL_DELAY_MS", &value)?;
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

fn parse_u32(key: &str, value: &str) -> Result<u32> {
    value
        .parse::<u32>()
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
            llm_enabled = false
            llm_provider = "minimax"
            llm_api_key = ""
            llm_base_url = "https://api.minimax.chat/v1"
            llm_model = "MiniMax-M2.7"
            llm_timeout_ms = 15000

            [retry]
            max_attempts = 3
            initial_delay_ms = 500
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
