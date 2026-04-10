//! Configuration management for koduck-ai
//!
//! Supports layered configuration: defaults → config files → environment variables.
//! Sensitive fields use `secrecy::SecretString` to prevent accidental log leakage.

use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
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
    pub adapter_grpc_target: String,
    pub default_provider: String,
    pub timeout_ms: u64,
    /// Enable local stub response when downstream LLM adapter is not ready.
    pub stub_enabled: bool,
    /// API keys per provider — wrapped in SecretString to prevent log leakage.
    #[serde(default)]
    pub openai_api_key: Option<SecretString>,
    #[serde(default)]
    pub deepseek_api_key: Option<SecretString>,
    #[serde(default)]
    pub anthropic_api_key: Option<SecretString>,
}

/// Stream / SSE transport configuration
#[derive(Debug, Deserialize, Clone)]
pub struct StreamConfig {
    pub max_duration_ms: u64,
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
        Ok(())
    }
}

impl StreamConfig {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.max_duration_ms == 0 {
            return Err(ValidationError {
                message: "stream.max_duration_ms must be greater than 0".to_string(),
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
            adapter_grpc_target: "http://localhost:50054".to_string(),
            default_provider: "openai".to_string(),
            timeout_ms: 30_000,
            stub_enabled: false,
            openai_api_key: None,
            deepseek_api_key: None,
            anthropic_api_key: None,
        }
    }
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            max_duration_ms: 300_000, // 5 minutes
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
            .set_default("llm.adapter_grpc_target", "http://localhost:50054")?
            .set_default("llm.default_provider", "openai")?
            .set_default("llm.timeout_ms", 30_000)?
            .set_default("llm.stub_enabled", false)?
            // Defaults — StreamConfig
            .set_default("stream.max_duration_ms", 300_000)?
            // Defaults — AuthConfig
            .set_default("auth.jwks_url", "http://localhost:8081/.well-known/jwks.json")?
            // Defaults — CapabilitiesConfig
            .set_default("capabilities.ttl_secs", 60)?
            .set_default("capabilities.startup_timeout_ms", 5_000)?
            .set_default("capabilities.required_version", "v1")?
            .set_default("capabilities.strict_mode", true)?
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
        Ok(())
    }

    /// Expose a provider API key for use in LLM client initialization.
    /// Returns `None` if the key is not configured.
    pub fn openai_api_key(&self) -> Option<&str> {
        self.llm.openai_api_key.as_ref().map(|k| k.expose_secret().as_str())
    }

    pub fn deepseek_api_key(&self) -> Option<&str> {
        self.llm.deepseek_api_key.as_ref().map(|k| k.expose_secret().as_str())
    }

    pub fn anthropic_api_key(&self) -> Option<&str> {
        self.llm.anthropic_api_key.as_ref().map(|k| k.expose_secret().as_str())
    }
}

// ---------------------------------------------------------------------------
// Display — Secret fields are masked as ***
// ---------------------------------------------------------------------------

impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{ server: {:?}, memory: {:?}, tools: {:?}, llm: LlmConfig {{ adapter_grpc_target: {:?}, default_provider: {:?}, timeout_ms: {}, stub_enabled: {}, api_keys: ***, ... }}, stream: {:?}, auth: {:?}, capabilities: {:?} }}",
            self.server,
            self.memory,
            self.tools,
            self.llm.adapter_grpc_target,
            self.llm.default_provider,
            self.llm.timeout_ms,
            self.llm.stub_enabled,
            self.stream,
            self.auth,
            self.capabilities,
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
        let config = StreamConfig { max_duration_ms: 0 };
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
                openai_api_key: Some(SecretString::from("sk-super-secret-key")),
                deepseek_api_key: Some(SecretString::from("sk-another-secret")),
                ..LlmConfig::default()
            },
            stream: StreamConfig::default(),
            auth: AuthConfig::default(),
            capabilities: CapabilitiesConfig::default(),
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
                openai_api_key: Some(SecretString::from("sk-test")),
                deepseek_api_key: None,
                anthropic_api_key: Some(SecretString::from("sk-anthropic")),
                ..LlmConfig::default()
            },
            stream: StreamConfig::default(),
            auth: AuthConfig::default(),
            capabilities: CapabilitiesConfig::default(),
        };
        assert_eq!(config.openai_api_key(), Some("sk-test"));
        assert_eq!(config.deepseek_api_key(), None);
        assert_eq!(config.anthropic_api_key(), Some("sk-anthropic"));
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
}
