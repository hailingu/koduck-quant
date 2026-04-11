//! Configuration management for koduck-ai
//!
//! Supports layered configuration: defaults → config files → environment variables.
//! Sensitive fields use `secrecy::SecretString` to prevent accidental log leakage.

use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use strum::{Display, EnumString};
use std::fmt;

/// Custom validation error for configuration
#[derive(Debug)]
pub struct ValidationError {
    pub message: String,
}

impl std::error::Error for ValidationError {}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Configuration validation error: {}", self.message)
    }
}

impl From<ValidationError> for ConfigError {
    fn from(err: ValidationError) -> Self {
        ConfigError::Message(err.message)
    }
}

/// Application configuration
#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub memory: MemoryConfig,
    pub tools: ToolConfig,
    pub llm: LlmConfig,
    pub stream: StreamConfig,
    pub auth: AuthConfig,
    pub capabilities: CapabilitiesConfig,
    pub reliability: ReliabilityConfig,
}

/// Server configuration (HTTP, gRPC, metrics)
#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub http_addr: String,
    pub grpc_addr: String,
    pub metrics_addr: String,
}

/// Memory service gRPC client configuration
#[derive(Debug, Deserialize, Clone)]
pub struct MemoryConfig {
    pub grpc_target: String,
}

/// Tool service gRPC client configuration
#[derive(Debug, Deserialize, Clone)]
pub struct ToolConfig {
    pub grpc_target: String,
}

/// LLM adapter configuration
#[derive(Debug, Deserialize, Clone)]
pub struct LlmConfig {
    pub mode: LlmMode,
    pub adapter_grpc_target: String,
    pub default_provider: String,
    pub timeout_ms: u64,
    /// Enable local stub response when downstream LLM adapter is not ready.
    pub stub_enabled: bool,
    pub openai: LlmProviderConfig,
    pub deepseek: LlmProviderConfig,
    pub minimax: LlmProviderConfig,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq, Display, EnumString)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum LlmMode {
    Direct,
    Adapter,
}

#[derive(Debug, Deserialize, Clone)]
pub struct LlmProviderConfig {
    pub enabled: bool,
    pub api_key: Option<SecretString>,
    pub base_url: String,
    pub default_model: String,
}

/// Stream / SSE transport configuration
#[derive(Debug, Deserialize, Clone)]
pub struct StreamConfig {
    pub max_duration_ms: u64,
    pub queue_capacity: usize,
    pub enqueue_timeout_ms: u64,
    pub shutdown_drain_timeout_ms: u64,
    pub shutdown_cleanup_timeout_ms: u64,
}

/// Auth configuration (JWKS endpoint)
#[derive(Debug, Deserialize, Clone)]
pub struct AuthConfig {
    pub jwks_url: String,
}

/// Capabilities negotiation configuration
#[derive(Debug, Deserialize, Clone)]
pub struct CapabilitiesConfig {
    /// TTL for cached capabilities in seconds (default: 60).
    pub ttl_secs: u64,
    /// Timeout for startup capabilities negotiation in ms (default: 5000).
    pub startup_timeout_ms: u64,
    /// Required contract version string (default: "v1").
    pub required_version: String,
    /// If true, version mismatch causes startup failure (default: true).
    pub strict_mode: bool,
}

/// Reliability configuration (degrade / retry / circuit).
#[derive(Debug, Deserialize, Clone)]
pub struct ReliabilityConfig {
    pub degrade: DegradeConfig,
    pub retry: RetryBudgetConfig,
}

/// Graceful degrade policy configuration.
#[derive(Debug, Deserialize, Clone)]
pub struct DegradeConfig {
    pub enabled: bool,
    pub chat_enabled: bool,
    pub chat_stream_enabled: bool,
    pub upstream_timeout_enabled: bool,
    pub budget_exhausted_enabled: bool,
    pub circuit_open_enabled: bool,
}

/// Retry / timeout budget policy configuration.
#[derive(Debug, Deserialize, Clone)]
pub struct RetryBudgetConfig {
    pub enabled: bool,
    pub max_retries: u32,
    pub total_timeout_ms: u64,
    pub base_backoff_ms: u64,
    pub max_backoff_ms: u64,
    #[serde(default)]
    pub retryable_codes: Vec<String>,
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

impl ServerConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_socket_addr(&self.http_addr, "server.http_addr")?;
        validate_socket_addr(&self.grpc_addr, "server.grpc_addr")?;
        validate_socket_addr(&self.metrics_addr, "server.metrics_addr")?;
        Ok(())
    }
}

impl MemoryConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.grpc_target.trim().is_empty() {
            return Err(ValidationError {
                message: "memory.grpc_target cannot be empty".to_string(),
            });
        }
        Ok(())
    }
}

impl ToolConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.grpc_target.trim().is_empty() {
            return Err(ValidationError {
                message: "tools.grpc_target cannot be empty".to_string(),
            });
        }
        Ok(())
    }
}

impl LlmConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.default_provider.trim().is_empty() {
            return Err(ValidationError {
                message: "llm.default_provider cannot be empty".to_string(),
            });
        }
        if self.timeout_ms == 0 {
            return Err(ValidationError {
                message: "llm.timeout_ms must be greater than 0".to_string(),
            });
        }
        if self.adapter_grpc_target.trim().is_empty() {
            return Err(ValidationError {
                message: "llm.adapter_grpc_target cannot be empty".to_string(),
            });
        }
        self.provider_config("openai").unwrap().validate("llm.openai")?;
        self.provider_config("deepseek").unwrap().validate("llm.deepseek")?;
        self.provider_config("minimax").unwrap().validate("llm.minimax")?;

        match self.mode {
            LlmMode::Direct => {
                let default_provider = self.default_provider.trim();
                let default_config = self.provider_config(default_provider).ok_or_else(|| {
                    ValidationError {
                        message: format!(
                            "llm.default_provider '{}' is not supported; expected one of openai, deepseek, minimax",
                            default_provider
                        ),
                    }
                })?;
                if !default_config.enabled {
                    return Err(ValidationError {
                        message: format!(
                            "llm.default_provider '{}' must reference an enabled provider in direct mode",
                            default_provider
                        ),
                    });
                }
            }
            LlmMode::Adapter => {}
        }
        Ok(())
    }

    pub fn provider_config(&self, provider: &str) -> Option<&LlmProviderConfig> {
        match provider.trim().to_ascii_lowercase().as_str() {
            "openai" => Some(&self.openai),
            "deepseek" => Some(&self.deepseek),
            "minimax" => Some(&self.minimax),
            _ => None,
        }
    }
}

impl LlmProviderConfig {
    pub fn validate(&self, field_name: &str) -> Result<(), ValidationError> {
        if self.default_model.trim().is_empty() {
            return Err(ValidationError {
                message: format!("{field_name}.default_model cannot be empty"),
            });
        }
        if self.base_url.trim().is_empty() {
            return Err(ValidationError {
                message: format!("{field_name}.base_url cannot be empty"),
            });
        }
        Ok(())
    }
}

impl Default for LlmProviderConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            api_key: None,
            base_url: String::new(),
            default_model: String::new(),
        }
    }
}

impl StreamConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.max_duration_ms == 0 {
            return Err(ValidationError {
                message: "stream.max_duration_ms must be greater than 0".to_string(),
            });
        }
        if self.queue_capacity == 0 {
            return Err(ValidationError {
                message: "stream.queue_capacity must be greater than 0".to_string(),
            });
        }
        if self.enqueue_timeout_ms == 0 {
            return Err(ValidationError {
                message: "stream.enqueue_timeout_ms must be greater than 0".to_string(),
            });
        }
        if self.shutdown_drain_timeout_ms == 0 {
            return Err(ValidationError {
                message: "stream.shutdown_drain_timeout_ms must be greater than 0".to_string(),
            });
        }
        if self.shutdown_cleanup_timeout_ms == 0 {
            return Err(ValidationError {
                message: "stream.shutdown_cleanup_timeout_ms must be greater than 0".to_string(),
            });
        }
        Ok(())
    }
}

impl AuthConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.jwks_url.trim().is_empty() {
            return Err(ValidationError {
                message: "auth.jwks_url cannot be empty".to_string(),
            });
        }
        Ok(())
    }
}

impl CapabilitiesConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.ttl_secs == 0 {
            return Err(ValidationError {
                message: "capabilities.ttl_secs must be greater than 0".to_string(),
            });
        }
        if self.startup_timeout_ms == 0 {
            return Err(ValidationError {
                message: "capabilities.startup_timeout_ms must be greater than 0".to_string(),
            });
        }
        if self.required_version.trim().is_empty() {
            return Err(ValidationError {
                message: "capabilities.required_version cannot be empty".to_string(),
            });
        }
        Ok(())
    }
}

impl ReliabilityConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        self.degrade.validate()?;
        self.retry.validate()
    }
}

impl DegradeConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        Ok(())
    }
}

impl RetryBudgetConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.total_timeout_ms == 0 {
            return Err(ValidationError {
                message: "reliability.retry.total_timeout_ms must be greater than 0".to_string(),
            });
        }
        if self.base_backoff_ms == 0 {
            return Err(ValidationError {
                message: "reliability.retry.base_backoff_ms must be greater than 0".to_string(),
            });
        }
        if self.max_backoff_ms == 0 {
            return Err(ValidationError {
                message: "reliability.retry.max_backoff_ms must be greater than 0".to_string(),
            });
        }
        if self.base_backoff_ms > self.max_backoff_ms {
            return Err(ValidationError {
                message: "reliability.retry.base_backoff_ms cannot exceed max_backoff_ms"
                    .to_string(),
            });
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            http_addr: "0.0.0.0:8083".to_string(),
            grpc_addr: "0.0.0.0:50051".to_string(),
            metrics_addr: "0.0.0.0:9090".to_string(),
        }
    }
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            grpc_target: "http://localhost:50052".to_string(),
        }
    }
}

impl Default for ToolConfig {
    fn default() -> Self {
        Self {
            grpc_target: "http://localhost:50053".to_string(),
        }
    }
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            mode: LlmMode::Direct,
            adapter_grpc_target: "http://localhost:50054".to_string(),
            default_provider: "openai".to_string(),
            timeout_ms: 30_000,
            stub_enabled: false,
            openai: LlmProviderConfig {
                enabled: true,
                api_key: None,
                base_url: "https://api.openai.com/v1".to_string(),
                default_model: "gpt-4.1-mini".to_string(),
            },
            deepseek: LlmProviderConfig {
                enabled: false,
                api_key: None,
                base_url: "https://api.deepseek.com/v1".to_string(),
                default_model: "deepseek-chat".to_string(),
            },
            minimax: LlmProviderConfig {
                enabled: false,
                api_key: None,
                base_url: "https://api.minimax.chat/v1".to_string(),
                default_model: "MiniMax-M1".to_string(),
            },
        }
    }
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            max_duration_ms: 300_000, // 5 minutes
            queue_capacity: 64,
            enqueue_timeout_ms: 1_000,
            shutdown_drain_timeout_ms: 10_000,
            shutdown_cleanup_timeout_ms: 2_000,
        }
    }
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwks_url: "http://localhost:8081/.well-known/jwks.json".to_string(),
        }
    }
}

impl Default for CapabilitiesConfig {
    fn default() -> Self {
        Self {
            ttl_secs: 60,
            startup_timeout_ms: 5_000,
            required_version: "v1".to_string(),
            strict_mode: true,
        }
    }
}

impl Default for ReliabilityConfig {
    fn default() -> Self {
        Self {
            degrade: DegradeConfig::default(),
            retry: RetryBudgetConfig::default(),
        }
    }
}

impl Default for DegradeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            chat_enabled: false,
            chat_stream_enabled: false,
            upstream_timeout_enabled: true,
            budget_exhausted_enabled: true,
            circuit_open_enabled: true,
        }
    }
}

impl Default for RetryBudgetConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 2,
            total_timeout_ms: 15_000,
            base_backoff_ms: 200,
            max_backoff_ms: 2_000,
            retryable_codes: vec![
                "RATE_LIMITED".to_string(),
                "SERVER_BUSY".to_string(),
                "UPSTREAM_UNAVAILABLE".to_string(),
                "STREAM_TIMEOUT".to_string(),
                "STREAM_INTERRUPTED".to_string(),
            ],
        }
    }
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

impl Config {
    /// Load configuration from environment variables and config files.
    ///
    /// Priority (highest wins): environment variables → config/local.toml → config/default.toml → defaults
    ///
    /// Fails fast if any validation rule is violated.
    pub fn from_env() -> Result<Self, ConfigError> {
        let config = Self::load()?;
        config.validate()?;
        Ok(config)
    }

    /// Load configuration without validation (for testing).
    pub(crate) fn load() -> Result<Self, ConfigError> {
        let _ = dotenvy::dotenv();

        let config = ConfigBuilder::builder()
            // Defaults — ServerConfig
            .set_default("server.http_addr", "0.0.0.0:8083")?
            .set_default("server.grpc_addr", "0.0.0.0:50051")?
            .set_default("server.metrics_addr", "0.0.0.0:9090")?
            // Defaults — MemoryConfig
            .set_default("memory.grpc_target", "http://localhost:50052")?
            // Defaults — ToolConfig
            .set_default("tools.grpc_target", "http://localhost:50053")?
            // Defaults — LlmConfig
            .set_default("llm.mode", "direct")?
            .set_default("llm.adapter_grpc_target", "http://localhost:50054")?
            .set_default("llm.default_provider", "openai")?
            .set_default("llm.timeout_ms", 30_000)?
            .set_default("llm.stub_enabled", false)?
            .set_default("llm.openai.enabled", true)?
            .set_default("llm.openai.base_url", "https://api.openai.com/v1")?
            .set_default("llm.openai.default_model", "gpt-4.1-mini")?
            .set_default("llm.deepseek.enabled", false)?
            .set_default("llm.deepseek.base_url", "https://api.deepseek.com/v1")?
            .set_default("llm.deepseek.default_model", "deepseek-chat")?
            .set_default("llm.minimax.enabled", false)?
            .set_default("llm.minimax.base_url", "https://api.minimax.chat/v1")?
            .set_default("llm.minimax.default_model", "MiniMax-M1")?
            // Defaults — StreamConfig
            .set_default("stream.max_duration_ms", 300_000)?
            .set_default("stream.queue_capacity", 64)?
            .set_default("stream.enqueue_timeout_ms", 1_000)?
            .set_default("stream.shutdown_drain_timeout_ms", 10_000)?
            .set_default("stream.shutdown_cleanup_timeout_ms", 2_000)?
            // Defaults — AuthConfig
            .set_default("auth.jwks_url", "http://localhost:8081/.well-known/jwks.json")?
            // Defaults — CapabilitiesConfig
            .set_default("capabilities.ttl_secs", 60)?
            .set_default("capabilities.startup_timeout_ms", 5_000)?
            .set_default("capabilities.required_version", "v1")?
            .set_default("capabilities.strict_mode", true)?
            // Defaults — ReliabilityConfig
            .set_default("reliability.degrade.enabled", false)?
            .set_default("reliability.degrade.chat_enabled", false)?
            .set_default("reliability.degrade.chat_stream_enabled", false)?
            .set_default("reliability.degrade.upstream_timeout_enabled", true)?
            .set_default("reliability.degrade.budget_exhausted_enabled", true)?
            .set_default("reliability.degrade.circuit_open_enabled", true)?
            .set_default("reliability.retry.enabled", true)?
            .set_default("reliability.retry.max_retries", 2)?
            .set_default("reliability.retry.total_timeout_ms", 15_000)?
            .set_default("reliability.retry.base_backoff_ms", 200)?
            .set_default("reliability.retry.max_backoff_ms", 2_000)?
            .set_default(
                "reliability.retry.retryable_codes",
                vec![
                    "RATE_LIMITED",
                    "SERVER_BUSY",
                    "UPSTREAM_UNAVAILABLE",
                    "STREAM_TIMEOUT",
                    "STREAM_INTERRUPTED",
                ],
            )?
            // Optional config files
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name("config/local").required(false))
            // Environment variables with prefix KODUCK_AI, separated by double underscore
            .add_source(Environment::with_prefix("KODUCK_AI").separator("__"))
            .build()?;

        config.try_deserialize()
    }

    /// Validate all configuration sections.
    pub fn validate(&self) -> Result<(), ValidationError> {
        self.server.validate()?;
        self.memory.validate()?;
        self.tools.validate()?;
        self.llm.validate()?;
        self.stream.validate()?;
        self.auth.validate()?;
        self.capabilities.validate()?;
        self.reliability.validate()?;
        Ok(())
    }

    /// Expose a provider API key for use in LLM client initialization.
    /// Returns `None` if the key is not configured.
    pub fn openai_api_key(&self) -> Option<&str> {
        self.llm.openai.api_key.as_ref().map(|k| k.expose_secret().as_str())
    }

    pub fn deepseek_api_key(&self) -> Option<&str> {
        self.llm.deepseek.api_key.as_ref().map(|k| k.expose_secret().as_str())
    }

    pub fn minimax_api_key(&self) -> Option<&str> {
        self.llm.minimax.api_key.as_ref().map(|k| k.expose_secret().as_str())
    }
}

// ---------------------------------------------------------------------------
// Display — Secret fields are masked as ***
// ---------------------------------------------------------------------------

impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{ server: {:?}, memory: {:?}, tools: {:?}, llm: LlmConfig {{ mode: {:?}, adapter_grpc_target: {:?}, default_provider: {:?}, timeout_ms: {}, stub_enabled: {}, providers: ***, ... }}, stream: {:?}, auth: {:?}, capabilities: {:?}, reliability: {:?} }}",
            self.server,
            self.memory,
            self.tools,
            self.llm.mode,
            self.llm.adapter_grpc_target,
            self.llm.default_provider,
            self.llm.timeout_ms,
            self.llm.stub_enabled,
            self.stream,
            self.auth,
            self.capabilities,
            self.reliability,
        )
    }
}

/// Validate that a string is a valid socket address (host:port).
fn validate_socket_addr(addr: &str, field_name: &str) -> Result<(), ValidationError> {
    match addr.parse::<std::net::SocketAddr>() {
        Ok(socket_addr) => {
            if socket_addr.port() == 0 {
                return Err(ValidationError {
                    message: format!("{}.port cannot be 0", field_name),
                });
            }
            Ok(())
        }
        Err(e) => Err(ValidationError {
            message: format!("{} ('{}') is not a valid socket address: {}", field_name, addr, e),
        }),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_socket_addr_valid() {
        assert!(validate_socket_addr("0.0.0.0:8083", "http_addr").is_ok());
        assert!(validate_socket_addr("127.0.0.1:50051", "grpc_addr").is_ok());
        assert!(validate_socket_addr("[::1]:9090", "metrics_addr").is_ok());
    }

    #[test]
    fn test_validate_socket_addr_invalid() {
        let result = validate_socket_addr("not-an-address", "http_addr");
        assert!(result.is_err());

        let result = validate_socket_addr("0.0.0.0", "http_addr");
        assert!(result.is_err());
    }

    #[test]
    fn test_server_config_default_valid() {
        let config = ServerConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_memory_config_default_valid() {
        let config = MemoryConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_memory_config_empty_target() {
        let config = MemoryConfig {
            grpc_target: "".to_string(),
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("grpc_target"));
    }

    #[test]
    fn test_tool_config_default_valid() {
        let config = ToolConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_tool_config_empty_target() {
        let config = ToolConfig {
            grpc_target: "".to_string(),
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("grpc_target"));
    }

    #[test]
    fn test_llm_config_default_valid() {
        let config = LlmConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_llm_config_empty_provider() {
        let config = LlmConfig {
            default_provider: "".to_string(),
            ..LlmConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("default_provider"));
    }

    #[test]
    fn test_llm_config_zero_timeout() {
        let config = LlmConfig {
            timeout_ms: 0,
            ..LlmConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("timeout_ms"));
    }

    #[test]
    fn test_llm_config_empty_adapter_target() {
        let config = LlmConfig {
            adapter_grpc_target: "".to_string(),
            ..LlmConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("adapter_grpc_target"));
    }

    #[test]
    fn test_stream_config_default_valid() {
        let config = StreamConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_stream_config_zero_duration() {
        let config = StreamConfig {
            max_duration_ms: 0,
            ..StreamConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("max_duration_ms"));
    }

    #[test]
    fn test_auth_config_default_valid() {
        let config = AuthConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_auth_config_empty_jwks() {
        let config = AuthConfig {
            jwks_url: "".to_string(),
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("jwks_url"));
    }

    #[test]
    fn test_config_display_masks_secrets() {
        let config = Config {
            server: ServerConfig::default(),
            memory: MemoryConfig::default(),
            tools: ToolConfig::default(),
            llm: LlmConfig {
                openai: LlmProviderConfig {
                    api_key: Some(SecretString::from("sk-super-secret-key".to_string())),
                    enabled: true,
                    base_url: "https://api.openai.com/v1".to_string(),
                    default_model: "gpt-4.1-mini".to_string(),
                },
                deepseek: LlmProviderConfig {
                    api_key: Some(SecretString::from("sk-another-secret".to_string())),
                    enabled: true,
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    default_model: "deepseek-chat".to_string(),
                },
                ..LlmConfig::default()
            },
            stream: StreamConfig::default(),
            auth: AuthConfig::default(),
            capabilities: CapabilitiesConfig::default(),
            reliability: ReliabilityConfig::default(),
        };
        let display = format!("{}", config);
        assert!(!display.contains("sk-super-secret-key"));
        assert!(!display.contains("sk-another-secret"));
        assert!(display.contains("***"));
    }

    #[test]
    fn test_config_api_key_accessors() {
        let config = Config {
            server: ServerConfig::default(),
            memory: MemoryConfig::default(),
            tools: ToolConfig::default(),
            llm: LlmConfig {
                openai: LlmProviderConfig {
                    api_key: Some(SecretString::from("sk-test".to_string())),
                    enabled: true,
                    base_url: "https://api.openai.com/v1".to_string(),
                    default_model: "gpt-4.1-mini".to_string(),
                },
                deepseek: LlmProviderConfig {
                    api_key: None,
                    enabled: true,
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    default_model: "deepseek-chat".to_string(),
                },
                minimax: LlmProviderConfig {
                    api_key: Some(SecretString::from("sk-minimax".to_string())),
                    enabled: true,
                    base_url: "https://api.minimax.chat/v1".to_string(),
                    default_model: "MiniMax-M1".to_string(),
                },
                ..LlmConfig::default()
            },
            stream: StreamConfig::default(),
            auth: AuthConfig::default(),
            capabilities: CapabilitiesConfig::default(),
            reliability: ReliabilityConfig::default(),
        };
        assert_eq!(config.openai_api_key(), Some("sk-test"));
        assert_eq!(config.deepseek_api_key(), None);
        assert_eq!(config.minimax_api_key(), Some("sk-minimax"));
    }

    #[test]
    fn test_capabilities_config_default_valid() {
        let config = CapabilitiesConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_capabilities_config_zero_ttl() {
        let config = CapabilitiesConfig {
            ttl_secs: 0,
            ..CapabilitiesConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("ttl_secs"));
    }

    #[test]
    fn test_capabilities_config_zero_startup_timeout() {
        let config = CapabilitiesConfig {
            startup_timeout_ms: 0,
            ..CapabilitiesConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("startup_timeout_ms"));
    }

    #[test]
    fn test_capabilities_config_empty_required_version() {
        let config = CapabilitiesConfig {
            required_version: "".to_string(),
            ..CapabilitiesConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("required_version"));
    }

    #[test]
    fn test_reliability_config_default_valid() {
        let config = ReliabilityConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_degrade_config_defaults_to_safe_rollout() {
        let config = DegradeConfig::default();
        assert!(!config.enabled);
        assert!(!config.chat_enabled);
        assert!(!config.chat_stream_enabled);
        assert!(config.upstream_timeout_enabled);
        assert!(config.budget_exhausted_enabled);
        assert!(config.circuit_open_enabled);
    }

    #[test]
    fn test_retry_budget_config_default_valid() {
        let config = RetryBudgetConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_retry_budget_config_rejects_invalid_backoff_window() {
        let config = RetryBudgetConfig {
            base_backoff_ms: 2_000,
            max_backoff_ms: 100,
            ..RetryBudgetConfig::default()
        };

        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("cannot exceed"));
    }
}
