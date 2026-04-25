use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use secrecy::SecretString;

use crate::config::{
    AuthConfig, CapabilitiesConfig, Config, LlmConfig, LlmMode, LlmProviderConfig, MemoryConfig,
    ReliabilityConfig, ServerConfig, StreamConfig, ToolConfig,
};

use super::{parse_provider_model, AdapterLlmProvider, LlmRouter};

#[test]
fn parses_model_prefix_variants() {
    assert_eq!(
        parse_provider_model("", "openai:gpt-4.1-mini"),
        (Some("openai".to_string()), Some("gpt-4.1-mini".to_string()))
    );
    assert_eq!(
        parse_provider_model("", "deepseek/deepseek-v4-flash"),
        (
            Some("deepseek".to_string()),
            Some("deepseek-v4-flash".to_string())
        )
    );
    assert_eq!(
        parse_provider_model("minimax", "MiniMax-M1"),
        (Some("minimax".to_string()), Some("MiniMax-M1".to_string()))
    );
    assert_eq!(
        parse_provider_model("", "kimi/kimi-for-coding"),
        (Some("kimi".to_string()), Some("kimi-for-coding".to_string()))
    );
}

#[test]
fn config_validation_rejects_unknown_default_provider_in_direct_mode() {
    let config = Config {
        server: ServerConfig::default(),
        memory: MemoryConfig::default(),
        tools: ToolConfig::default(),
        llm: LlmConfig {
            mode: LlmMode::Direct,
            default_provider: "unknown".to_string(),
            openai: LlmProviderConfig {
                api_key: Some(SecretString::from("sk-test".to_string())),
                enabled: true,
                base_url: "https://api.openai.com/v1".to_string(),
                default_model: "gpt-4.1-mini".to_string(),
            },
            deepseek: LlmProviderConfig {
                api_key: None,
                enabled: false,
                base_url: "https://api.deepseek.com".to_string(),
                default_model: "deepseek-v4-flash".to_string(),
            },
            minimax: LlmProviderConfig {
                api_key: None,
                enabled: false,
                base_url: "https://api.minimax.chat/v1".to_string(),
                default_model: "MiniMax-M1".to_string(),
            },
            kimi: LlmProviderConfig {
                api_key: None,
                enabled: false,
                base_url: "https://api.kimi.com/coding/v1".to_string(),
                default_model: "kimi-for-coding".to_string(),
            },
            ..LlmConfig::default()
        },
        stream: StreamConfig::default(),
        auth: AuthConfig::default(),
        capabilities: CapabilitiesConfig::default(),
        reliability: ReliabilityConfig::default(),
        registry: crate::config::RegistryConfig::default(),
    };

    let result = config.validate();
    assert!(result.is_err());
}

#[test]
fn direct_mode_rejects_unenabled_provider_without_fallback() {
    let router = LlmRouter {
        mode: LlmMode::Direct,
        default_provider: "openai".to_string(),
        enabled_providers: ["openai".to_string()].into_iter().collect(),
        direct_providers: HashMap::new(),
        adapter_provider: Arc::new(AdapterLlmProvider::new("http://localhost:50054")),
    };

    match router.resolve_route("deepseek", "deepseek-v4-flash") {
        Ok(_) => panic!("expected provider route resolution to fail"),
        Err(err) => assert!(err.message.contains("no implicit fallback")),
    }
}

#[test]
fn adapter_mode_routes_to_existing_compat_provider() {
    let router = LlmRouter {
        mode: LlmMode::Adapter,
        default_provider: "openai".to_string(),
        enabled_providers: HashSet::new(),
        direct_providers: HashMap::new(),
        adapter_provider: Arc::new(AdapterLlmProvider::new("http://localhost:50054")),
    };

    let route = router.resolve_route("", "").unwrap();
    assert_eq!(route.provider, "openai");
    assert!(route.model.is_empty());
}
