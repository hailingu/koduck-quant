use std::fmt;
use std::fs;
use std::sync::Arc;

use reqwest::Certificate;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tracing::{info, warn};

use crate::config::RegistryConfig;

const SERVICE_ACCOUNT_TOKEN_PATH: &str = "/var/run/secrets/kubernetes.io/serviceaccount/token";
const SERVICE_ACCOUNT_CA_PATH: &str = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceProtocol {
    Grpc,
    Http,
}

impl fmt::Display for ServiceProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Grpc => write!(f, "grpc"),
            Self::Http => write!(f, "http"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceKind {
    Memory,
    Knowledge,
    Tool,
    Llm,
    Ai,
    Gateway,
}

impl fmt::Display for ServiceKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Memory => write!(f, "memory"),
            Self::Knowledge => write!(f, "knowledge"),
            Self::Tool => write!(f, "tool"),
            Self::Llm => write!(f, "llm"),
            Self::Ai => write!(f, "ai"),
            Self::Gateway => write!(f, "gateway"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRef {
    pub name: String,
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEndpoint {
    pub protocol: ServiceProtocol,
    pub target: String,
    pub service_ref: Option<ServiceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityProbe {
    pub protocol: ServiceProtocol,
    pub target: String,
    pub grpc_service: Option<String>,
    pub grpc_method: Option<String>,
    pub http_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredService {
    pub name: String,
    pub service_kind: ServiceKind,
    pub expose_to_ai: bool,
    pub description: Option<String>,
    pub endpoint: ServiceEndpoint,
    pub capability_probe: Option<CapabilityProbe>,
    pub feature_hints: Vec<String>,
    pub version_hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySnapshot {
    pub enabled: bool,
    pub namespace: String,
    pub discovered_services: Vec<DiscoveredService>,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug)]
pub struct ServiceRegistry {
    config: RegistryConfig,
    client: Option<reqwest::Client>,
    state: Arc<RwLock<RegistrySnapshot>>,
}

impl ServiceRegistry {
    pub fn new(config: RegistryConfig) -> Self {
        let client = if config.enabled {
            match build_client() {
                Ok(client) => Some(client),
                Err(error) => {
                    warn!(
                        error = %error,
                        "failed to initialize kubernetes registry client; discovery will use static fallbacks"
                    );
                    None
                }
            }
        } else {
            None
        };

        Self {
            state: Arc::new(RwLock::new(RegistrySnapshot {
                enabled: config.enabled,
                namespace: config.namespace.clone(),
                discovered_services: Vec::new(),
                last_sync_at: None,
                last_error: None,
            })),
            config,
            client,
        }
    }

    pub fn enabled(&self) -> bool {
        self.config.enabled
    }

    pub async fn snapshot(&self) -> RegistrySnapshot {
        self.state.read().await.clone()
    }

    pub async fn resolve_grpc_target(&self, kind: ServiceKind, fallback: &str) -> String {
        if !self.config.enabled {
            return fallback.to_string();
        }

        self.state
            .read()
            .await
            .discovered_services
            .iter()
            .find(|service| {
                service.expose_to_ai
                    && service.service_kind == kind
                    && service.endpoint.protocol == ServiceProtocol::Grpc
            })
            .map(|service| service.endpoint.target.clone())
            .unwrap_or_else(|| fallback.to_string())
    }

    pub async fn resolve_ai_tool_services(&self) -> Vec<DiscoveredService> {
        if !self.config.enabled {
            return Vec::new();
        }

        self.state
            .read()
            .await
            .discovered_services
            .iter()
            .filter(|service| {
                service.expose_to_ai
                    && service.capability_probe.is_some()
                    && matches!(service.service_kind, ServiceKind::Knowledge | ServiceKind::Tool)
            })
            .cloned()
            .collect()
    }

    pub async fn resolve_ai_capability_service(
        &self,
        kind: ServiceKind,
    ) -> Option<DiscoveredService> {
        if !self.config.enabled {
            return None;
        }

        self.state
            .read()
            .await
            .discovered_services
            .iter()
            .find(|service| {
                service.expose_to_ai
                    && service.service_kind == kind
                    && service.capability_probe.is_some()
            })
            .cloned()
    }

    pub async fn sync_once(&self) -> Result<RegistrySnapshot, String> {
        if !self.config.enabled {
            return Ok(self.snapshot().await);
        }

        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "kubernetes registry client is not initialized".to_string())?;
        let token = fs::read_to_string(SERVICE_ACCOUNT_TOKEN_PATH)
            .map_err(|error| format!("failed to read service account token: {error}"))?;
        let token = token.trim();
        if token.is_empty() {
            return Err("service account token is empty".to_string());
        }

        let url = format!(
            "{}/apis/platform.koduck.io/v1alpha1/namespaces/{}/capabilityservices",
            self.config.api_base_url.trim_end_matches('/'),
            self.config.namespace
        );

        let response = client
            .get(url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|error| format!("registry request failed: {error}"))?
            .error_for_status()
            .map_err(|error| format!("registry returned error: {error}"))?;

        let payload = response
            .json::<CapabilityServiceList>()
            .await
            .map_err(|error| format!("failed to decode registry response: {error}"))?;

        let mut services = payload
            .items
            .into_iter()
            .map(|item| DiscoveredService {
                name: item.metadata.name,
                service_kind: item.spec.service_kind,
                expose_to_ai: item.spec.expose_to_ai,
                description: item.spec.description,
                endpoint: item.spec.endpoint,
                capability_probe: item.spec.capability_probe,
                feature_hints: item.spec.feature_hints.unwrap_or_default(),
                version_hints: item.spec.version_hints.unwrap_or_default(),
            })
            .collect::<Vec<_>>();
        services.sort_by(|left, right| left.name.cmp(&right.name));

        let mut state = self.state.write().await;
        state.discovered_services = services;
        state.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
        state.last_error = None;
        let snapshot = state.clone();
        drop(state);

        info!(
            discovered_services = snapshot.discovered_services.len(),
            namespace = %snapshot.namespace,
            "synchronized capability service registry"
        );

        Ok(snapshot)
    }

    pub fn spawn_refresh_task(self: Arc<Self>, mut shutdown_rx: broadcast::Receiver<()>) {
        if !self.config.enabled {
            return;
        }

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(
                self.config.poll_interval_secs,
            ));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            loop {
                tokio::select! {
                    _ = shutdown_rx.recv() => break,
                    _ = interval.tick() => {
                        if let Err(error) = self.sync_once().await {
                            warn!(error = %error, "capability service registry sync failed");
                            self.record_error(error).await;
                        }
                    }
                }
            }
        });
    }

    async fn record_error(&self, error: String) {
        let mut state = self.state.write().await;
        state.last_error = Some(error);
        state.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
    }
}

fn build_client() -> Result<reqwest::Client, String> {
    let builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(10));

    let builder = match fs::read(SERVICE_ACCOUNT_CA_PATH) {
        Ok(bytes) => {
            let certificate = Certificate::from_pem(&bytes)
                .map_err(|error| format!("failed to parse kubernetes CA certificate: {error}"))?;
            builder.add_root_certificate(certificate)
        }
        Err(_) => builder,
    };

    builder
        .build()
        .map_err(|error| format!("failed to build registry http client: {error}"))
}

#[derive(Debug, Deserialize)]
struct CapabilityServiceList {
    items: Vec<CapabilityServiceResource>,
}

#[derive(Debug, Deserialize)]
struct CapabilityServiceResource {
    metadata: ResourceMetadata,
    spec: CapabilityServiceSpec,
}

#[derive(Debug, Deserialize)]
struct ResourceMetadata {
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityServiceSpec {
    service_kind: ServiceKind,
    #[serde(default)]
    expose_to_ai: bool,
    description: Option<String>,
    endpoint: ServiceEndpoint,
    capability_probe: Option<CapabilityProbe>,
    feature_hints: Option<Vec<String>>,
    version_hints: Option<Vec<String>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn resolve_target_prefers_discovered_grpc_service() {
        let registry = ServiceRegistry::new(RegistryConfig {
            enabled: true,
            api_base_url: "https://kubernetes.default.svc".to_string(),
            namespace: "koduck-dev".to_string(),
            poll_interval_secs: 30,
        });

        {
            let mut state = registry.state.write().await;
            state.discovered_services = vec![DiscoveredService {
                name: "koduck-memory".to_string(),
                service_kind: ServiceKind::Memory,
                expose_to_ai: true,
                description: None,
                endpoint: ServiceEndpoint {
                    protocol: ServiceProtocol::Grpc,
                    target: "http://dev-apisix-gateway:9080".to_string(),
                    service_ref: None,
                },
                capability_probe: None,
                feature_hints: vec![],
                version_hints: vec![],
            }];
        }

        let resolved = registry
            .resolve_grpc_target(ServiceKind::Memory, "http://localhost:50052")
            .await;
        assert_eq!(resolved, "http://dev-apisix-gateway:9080");
    }

    #[tokio::test]
    async fn resolve_target_falls_back_when_registry_is_disabled() {
        let registry = ServiceRegistry::new(RegistryConfig {
            enabled: false,
            api_base_url: "https://kubernetes.default.svc".to_string(),
            namespace: "koduck-dev".to_string(),
            poll_interval_secs: 30,
        });

        let resolved = registry
            .resolve_grpc_target(ServiceKind::Memory, "http://localhost:50052")
            .await;
        assert_eq!(resolved, "http://localhost:50052");
    }

    #[tokio::test]
    async fn resolve_ai_tool_services_filters_for_exposed_knowledge_and_tool_entries() {
        let registry = ServiceRegistry::new(RegistryConfig {
            enabled: true,
            api_base_url: "https://kubernetes.default.svc".to_string(),
            namespace: "koduck-dev".to_string(),
            poll_interval_secs: 30,
        });

        {
            let mut state = registry.state.write().await;
            state.discovered_services = vec![
                DiscoveredService {
                    name: "koduck-memory".to_string(),
                    service_kind: ServiceKind::Memory,
                    expose_to_ai: true,
                    description: None,
                    endpoint: ServiceEndpoint {
                        protocol: ServiceProtocol::Grpc,
                        target: "http://dev-apisix-gateway:9080".to_string(),
                        service_ref: None,
                    },
                    capability_probe: Some(CapabilityProbe {
                        protocol: ServiceProtocol::Grpc,
                        target: "http://dev-apisix-gateway:9080".to_string(),
                        grpc_service: Some("koduck.memory.v1.MemoryService".to_string()),
                        grpc_method: Some("GetCapabilities".to_string()),
                        http_path: None,
                    }),
                    feature_hints: vec![],
                    version_hints: vec![],
                },
                DiscoveredService {
                    name: "koduck-knowledge".to_string(),
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
                    feature_hints: vec![],
                    version_hints: vec![],
                },
            ];
        }

        let services = registry.resolve_ai_tool_services().await;
        assert_eq!(services.len(), 1);
        assert_eq!(services[0].name, "koduck-knowledge");
    }

    #[tokio::test]
    async fn resolve_ai_capability_service_returns_memory_entry() {
        let registry = ServiceRegistry::new(RegistryConfig {
            enabled: true,
            api_base_url: "https://kubernetes.default.svc".to_string(),
            namespace: "koduck-dev".to_string(),
            poll_interval_secs: 30,
        });

        {
            let mut state = registry.state.write().await;
            state.discovered_services = vec![DiscoveredService {
                name: "koduck-memory".to_string(),
                service_kind: ServiceKind::Memory,
                expose_to_ai: true,
                description: None,
                endpoint: ServiceEndpoint {
                    protocol: ServiceProtocol::Grpc,
                    target: "http://dev-apisix-gateway:9080".to_string(),
                    service_ref: None,
                },
                capability_probe: Some(CapabilityProbe {
                    protocol: ServiceProtocol::Grpc,
                    target: "http://dev-apisix-gateway:9080".to_string(),
                    grpc_service: Some("koduck.memory.v1.MemoryService".to_string()),
                    grpc_method: Some("GetCapabilities".to_string()),
                    http_path: None,
                }),
                feature_hints: vec![],
                version_hints: vec![],
            }];
        }

        let service = registry
            .resolve_ai_capability_service(ServiceKind::Memory)
            .await
            .expect("memory service should be discovered");
        assert_eq!(service.name, "koduck-memory");
    }
}
