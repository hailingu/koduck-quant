use secrecy::SecretString;

use super::*;

fn test_config() -> Config {
    Config {
        server: ServerConfig::default(),
        memory: MemoryConfig::default(),
        tools: ToolConfig::default(),
        llm: LlmConfig::default(),
        stream: StreamConfig::default(),
        auth: AuthConfig::default(),
        capabilities: CapabilitiesConfig::default(),
        registry: RegistryConfig::default(),
        reliability: ReliabilityConfig::default(),
    }
}

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
fn test_memory_config_default_empty() {
    let config = MemoryConfig::default();
    assert!(config.grpc_target.is_empty());
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
fn test_config_validate_allows_empty_memory_target_when_registry_enabled() {
    let config = Config {
        registry: RegistryConfig {
            enabled: true,
            ..RegistryConfig::default()
        },
        ..test_config()
    };

    assert!(config.validate().is_ok());
}

#[test]
fn test_tool_config_default_valid() {
    let config = ToolConfig::default();
    assert!(config.validate().is_ok());
}

#[test]
fn test_tool_config_empty_target() {
    let config = ToolConfig {
        enabled: true,
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
fn test_registry_config_default_valid_when_disabled() {
    let config = RegistryConfig::default();
    assert!(config.validate().is_ok());
}

#[test]
fn test_registry_config_enabled_requires_namespace() {
    let config = RegistryConfig {
        enabled: true,
        api_base_url: "https://kubernetes.default.svc".to_string(),
        namespace: "".to_string(),
        poll_interval_secs: 30,
    };
    let result = config.validate();
    assert!(result.is_err());
    assert!(result.unwrap_err().message.contains("registry.namespace"));
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
                base_url: "https://api.deepseek.com".to_string(),
                default_model: "deepseek-v4-flash".to_string(),
            },
            ..LlmConfig::default()
        },
        stream: StreamConfig::default(),
        auth: AuthConfig::default(),
        capabilities: CapabilitiesConfig::default(),
        registry: RegistryConfig::default(),
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
                base_url: "https://api.deepseek.com".to_string(),
                default_model: "deepseek-v4-flash".to_string(),
            },
            minimax: LlmProviderConfig {
                api_key: Some(SecretString::from("sk-minimax".to_string())),
                enabled: true,
                base_url: "https://api.minimax.chat/v1".to_string(),
                default_model: "MiniMax-M1".to_string(),
            },
            kimi: LlmProviderConfig {
                api_key: Some(SecretString::from("sk-kimi".to_string())),
                enabled: true,
                base_url: "https://api.kimi.com/coding/v1".to_string(),
                default_model: "kimi-for-coding".to_string(),
            },
            ..LlmConfig::default()
        },
        stream: StreamConfig::default(),
        auth: AuthConfig::default(),
        capabilities: CapabilitiesConfig::default(),
        registry: RegistryConfig::default(),
        reliability: ReliabilityConfig::default(),
    };
    assert_eq!(config.openai_api_key(), Some("sk-test"));
    assert_eq!(config.deepseek_api_key(), None);
    assert_eq!(config.minimax_api_key(), Some("sk-minimax"));
    assert_eq!(config.kimi_api_key(), Some("sk-kimi"));
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
