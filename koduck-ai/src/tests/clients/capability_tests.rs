use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use futures::stream;

use super::*;
use crate::config::LlmProviderConfig;
use crate::llm::{
    CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse, ListModelsRequest,
    LlmProvider, ModelInfo, ProviderEventStream, StreamEvent,
};
use crate::registry::{CapabilityProbe, ServiceEndpoint, ServiceKind, ServiceProtocol};

fn make_capability(service: &str, versions: Vec<&str>) -> proto::Capability {
    proto::Capability {
        service: service.to_string(),
        contract_versions: versions.into_iter().map(String::from).collect(),
        features: HashMap::new(),
        limits: HashMap::new(),
    }
}

struct MockDirectProvider;

#[async_trait]
impl LlmProvider for MockDirectProvider {
    async fn generate(&self, _req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        unreachable!("generate is not used in capability tests")
    }

    async fn stream_generate(
        &self,
        _req: GenerateRequest,
    ) -> Result<ProviderEventStream, AppError> {
        Ok(Box::pin(stream::empty::<Result<StreamEvent, AppError>>()))
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        Ok(vec![ModelInfo {
            id: format!("{}-model", req.provider),
            provider: req.provider.clone(),
            display_name: format!("{} model", req.provider),
            max_context_tokens: 8192,
            max_output_tokens: 4096,
            supports_streaming: true,
            supports_tools: false,
            supported_features: vec!["chat".to_string(), "stream".to_string()],
        }])
    }

    async fn count_tokens(
        &self,
        _req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        unreachable!("count_tokens is not used in capability tests")
    }
}

#[test]
fn test_cached_capability_not_expired() {
    let cap = make_capability("test", vec!["v1"]);
    let cached = CachedCapability::new(cap);

    assert!(!cached.is_expired(Duration::from_secs(1)));
    assert!(!cached.is_expired(Duration::from_secs(60)));
}

#[test]
fn test_cached_capability_expired() {
    let cap = make_capability("test", vec!["v1"]);
    let cached = CachedCapability::new(cap);

    std::thread::sleep(Duration::from_millis(10));
    assert!(cached.is_expired(Duration::from_millis(1)));
}

#[test]
fn test_version_matches_exact() {
    assert!(version_matches("v1", "v1"));
    assert!(version_matches("v2", "v2"));
}

#[test]
fn test_version_matches_suffix() {
    assert!(version_matches("memory.v1", "v1"));
    assert!(version_matches("tool.v1", "v1"));
    assert!(version_matches("llm.v1", "v1"));
    assert!(version_matches("memory.v2", "v2"));
}

#[test]
fn test_version_matches_rejects_incompatible() {
    assert!(!version_matches("v2", "v1"));
    assert!(!version_matches("memory.v2", "v1"));
    assert!(!version_matches("foo", "v1"));
    assert!(!version_matches("", "v1"));
}

#[test]
fn test_check_version_compatibility_all_match() {
    let memory = make_capability("memory", vec!["v1"]);
    let tool = make_capability("tool", vec!["v1"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig::default();
    let metrics = CapabilityMetrics::new();

    assert!(check_version_compatibility(&memory, &tool, &llm, &config, &metrics).is_ok());
}

#[test]
fn test_check_version_compatibility_service_prefixed_versions() {
    let memory = make_capability("memory", vec!["memory.v1"]);
    let tool = make_capability("tool", vec!["tool.v1"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig::default();
    let metrics = CapabilityMetrics::new();

    assert!(check_version_compatibility(&memory, &tool, &llm, &config, &metrics).is_ok());
}

#[test]
fn test_check_version_compatibility_multiple_versions() {
    let memory = make_capability("memory", vec!["v1", "v2"]);
    let tool = make_capability("tool", vec!["v2", "v1"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig::default();
    let metrics = CapabilityMetrics::new();

    assert!(check_version_compatibility(&memory, &tool, &llm, &config, &metrics).is_ok());
}

#[test]
fn test_check_version_compatibility_strict_mode_mismatch() {
    let memory = make_capability("memory", vec!["v1"]);
    let tool = make_capability("tool", vec!["v2"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig::default();
    let metrics = CapabilityMetrics::new();

    let result = check_version_compatibility(&memory, &tool, &llm, &config, &metrics);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.code, ErrorCode::DependencyFailed);
}

#[test]
fn test_check_version_compatibility_non_strict_mode() {
    let memory = make_capability("memory", vec!["v1"]);
    let tool = make_capability("tool", vec!["v2"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig {
        strict_mode: false,
        ..CapabilitiesConfig::default()
    };
    let metrics = CapabilityMetrics::new();

    assert!(check_version_compatibility(&memory, &tool, &llm, &config, &metrics).is_ok());
}

#[test]
fn test_version_mismatch_records_metrics() {
    let memory = make_capability("memory", vec!["v2"]);
    let tool = make_capability("tool", vec!["v2"]);
    let llm = make_capability("llm", vec!["v1"]);
    let config = CapabilitiesConfig {
        strict_mode: false,
        ..CapabilitiesConfig::default()
    };
    let metrics = CapabilityMetrics::new();

    let _ = check_version_compatibility(&memory, &tool, &llm, &config, &metrics);
    let snapshot = metrics.snapshot();
    assert_eq!(snapshot.version_mismatch_total, 2);
}

#[test]
fn test_collect_mismatches_multiple() {
    let memory = make_capability("memory", vec!["v2"]);
    let tool = make_capability("tool", vec!["v2"]);
    let llm = make_capability("llm", vec!["v1"]);
    let mismatches = collect_mismatches(&memory, &tool, &llm, "v1");
    assert_eq!(mismatches.len(), 2);
    assert_eq!(mismatches[0].service, "memory");
    assert_eq!(mismatches[1].service, "tool");
}

#[test]
fn test_collect_mismatches_empty() {
    let memory = make_capability("memory", vec!["v1"]);
    let tool = make_capability("tool", vec!["v1"]);
    let llm = make_capability("llm", vec!["v1"]);

    let mismatches = collect_mismatches(&memory, &tool, &llm, "v1");
    assert!(mismatches.is_empty());
}

#[test]
fn test_version_mismatch_alert_serialization() {
    let alert = VersionMismatchAlert {
        service: "memory".to_string(),
        expected_version: "v1".to_string(),
        actual_versions: vec!["v2".to_string()],
        severity: "critical".to_string(),
    };

    let json = serde_json::to_string(&alert).unwrap();
    assert!(json.contains("\"service\":\"memory\""));
    assert!(json.contains("\"expected_version\":\"v1\""));
    assert!(json.contains("\"severity\":\"critical\""));
}

#[test]
fn test_enabled_llm_providers_returns_only_enabled_entries() {
    let llm_config = LlmConfig {
        openai: LlmProviderConfig {
            enabled: true,
            ..LlmProviderConfig::default()
        },
        deepseek: LlmProviderConfig {
            enabled: false,
            ..LlmProviderConfig::default()
        },
        minimax: LlmProviderConfig {
            enabled: true,
            ..LlmProviderConfig::default()
        },
        ..LlmConfig::default()
    };

    assert_eq!(
        enabled_llm_providers(&llm_config),
        vec!["openai".to_string(), "minimax".to_string()]
    );
}

#[test]
fn test_capability_probe_meta_contains_required_request_fields() {
    let meta = capability_probe_meta("memory", "memory.v1", 4_321);

    assert_eq!(meta.request_id, "capability-probe-memory");
    assert_eq!(meta.session_id, "capability-probe");
    assert_eq!(meta.user_id, "system");
    assert_eq!(meta.tenant_id, "system");
    assert_eq!(meta.trace_id, "trace-capability-probe-memory");
    assert_eq!(meta.idempotency_key, "");
    assert_eq!(meta.deadline_ms, 4_321);
    assert_eq!(meta.api_version, "memory.v1");
}

#[test]
fn test_http_capability_to_proto_preserves_features_and_limits() {
    let service = DiscoveredService {
        name: "dev-koduck-knowledge".to_string(),
        service_kind: ServiceKind::Knowledge,
        expose_to_ai: true,
        description: None,
        endpoint: ServiceEndpoint {
            protocol: ServiceProtocol::Http,
            target: "http://dev-koduck-knowledge:8084".to_string(),
            service_ref: None,
        },
        capability_probe: Some(CapabilityProbe {
            protocol: ServiceProtocol::Http,
            target: "http://dev-koduck-knowledge:8084".to_string(),
            grpc_service: None,
            grpc_method: None,
            http_path: Some("/internal/capabilities".to_string()),
        }),
        tool_discovery: None,
        feature_hints: vec![],
        version_hints: vec![],
    };
    let payload = HttpCapabilityResponse {
        service: "koduck-knowledge".to_string(),
        service_kind: Some("knowledge".to_string()),
        contract_versions: vec!["v1".to_string()],
        features: vec!["entity_search".to_string(), "basic_profile".to_string()],
        limits: HashMap::from([
            (
                "recommended_timeout_ms".to_string(),
                serde_json::Value::String("5000".to_string()),
            ),
            (
                "max_results".to_string(),
                serde_json::Value::Number(serde_json::Number::from(20)),
            ),
        ]),
    };

    let capability = http_capability_to_proto(&service, payload);
    assert_eq!(capability.service, "koduck-knowledge");
    assert_eq!(capability.contract_versions, vec!["v1".to_string()]);
    assert_eq!(
        capability.features.get("entity_search"),
        Some(&"true".to_string())
    );
    assert_eq!(
        capability.features.get("registry_name"),
        Some(&"dev-koduck-knowledge".to_string())
    );
    assert_eq!(capability.limits.get("max_results"), Some(&"20".to_string()));
}

#[test]
fn test_aggregate_registry_tool_capability_merges_service_features() {
    let knowledge = proto::Capability {
        service: "koduck-knowledge".to_string(),
        contract_versions: vec!["v1".to_string()],
        features: HashMap::from([
            ("entity_search".to_string(), "true".to_string()),
            ("basic_profile".to_string(), "true".to_string()),
        ]),
        limits: HashMap::from([("recommended_timeout_ms".to_string(), "5000".to_string())]),
    };
    let tool = proto::Capability {
        service: "koduck-tool".to_string(),
        contract_versions: vec!["tool.v1".to_string()],
        features: HashMap::from([("lookup_quote".to_string(), "true".to_string())]),
        limits: HashMap::new(),
    };

    let aggregated = aggregate_registry_tool_capability(&[knowledge, tool]);
    assert_eq!(aggregated.service, "tool-registry");
    assert_eq!(aggregated.features.get("mode"), Some(&"registry".to_string()));
    assert_eq!(aggregated.features.get("service_count"), Some(&"2".to_string()));
    assert_eq!(
        aggregated
            .features
            .get("service.koduck_knowledge.entity_search"),
        Some(&"true".to_string())
    );
    assert_eq!(
        aggregated.features.get("service.koduck_tool.lookup_quote"),
        Some(&"true".to_string())
    );
}

#[tokio::test]
async fn test_fetch_direct_llm_capability_builds_static_capability_after_probe() {
    let llm_config = LlmConfig {
        default_provider: "openai".to_string(),
        timeout_ms: 3210,
        openai: LlmProviderConfig {
            enabled: true,
            base_url: "https://api.openai.com/v1".to_string(),
            default_model: "gpt-4.1-mini".to_string(),
            ..LlmProviderConfig::default()
        },
        deepseek: LlmProviderConfig {
            enabled: true,
            base_url: "https://api.deepseek.com".to_string(),
            default_model: "deepseek-v4-flash".to_string(),
            ..LlmProviderConfig::default()
        },
        minimax: LlmProviderConfig {
            enabled: false,
            ..LlmProviderConfig::default()
        },
        ..LlmConfig::default()
    };

    let capability = fetch_direct_llm_capability(&llm_config, Arc::new(MockDirectProvider), "v1")
        .await
        .unwrap();

    assert_eq!(capability.service, "llm");
    assert_eq!(capability.contract_versions, vec!["v1".to_string()]);
    assert_eq!(capability.features.get("mode"), Some(&"direct".to_string()));
    assert_eq!(
        capability.features.get("available_providers"),
        Some(&"openai,deepseek".to_string())
    );
    assert_eq!(
        capability.limits.get("provider.openai.models"),
        Some(&"1".to_string())
    );
    assert_eq!(
        capability.limits.get("provider.deepseek.models"),
        Some(&"1".to_string())
    );
}

#[test]
fn test_capability_metrics_counters() {
    let metrics = CapabilityMetrics::new();

    metrics.record_negotiation_success();
    metrics.record_negotiation_success();
    metrics.record_negotiation_failure();
    metrics.record_refresh_success();
    metrics.record_refresh_failure();
    metrics.record_refresh_failure();

    let snapshot = metrics.snapshot();
    assert_eq!(snapshot.negotiation_total, 3);
    assert_eq!(snapshot.negotiation_success, 2);
    assert_eq!(snapshot.negotiation_failure, 1);
    assert_eq!(snapshot.refresh_total, 3);
    assert_eq!(snapshot.refresh_success, 1);
    assert_eq!(snapshot.refresh_failure, 2);
}

#[test]
fn test_negotiation_status_default() {
    let status = NegotiationStatus::default();
    assert!(matches!(status.memory, ServiceNegotiationStatus::Pending));
    assert!(matches!(status.tool, ServiceNegotiationStatus::Pending));
    assert!(matches!(status.llm, ServiceNegotiationStatus::Pending));
    assert!(status.negotiated_at.is_none());
}

#[test]
fn test_negotiation_status_serialization() {
    let status = NegotiationStatus {
        memory: ServiceNegotiationStatus::Ok,
        tool: ServiceNegotiationStatus::Failed,
        llm: ServiceNegotiationStatus::Ok,
        negotiated_at: Some("2026-04-12T00:00:00Z".to_string()),
    };

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"memory\":\"ok\""));
    assert!(json.contains("\"tool\":\"failed\""));
    assert!(json.contains("\"llm\":\"ok\""));
}

#[tokio::test]
async fn test_capability_cache_negotiation_status_tracking() {
    let config = CapabilitiesConfig::default();
    let cache = CapabilityCache::new(config);

    let status = cache.get_negotiation_status().await;
    assert!(matches!(status.memory, ServiceNegotiationStatus::Pending));

    let metrics = cache.get_metrics_snapshot();
    assert_eq!(metrics.negotiation_total, 0);
}
