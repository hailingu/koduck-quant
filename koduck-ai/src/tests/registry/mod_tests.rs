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
            tool_discovery: None,
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
                tool_discovery: Some(ToolDiscovery {
                    protocol: ServiceProtocol::Http,
                    target: "http://dev-koduck-memory:9090".to_string(),
                    grpc_service: None,
                    grpc_method: None,
                    http_path: Some("/internal/tools".to_string()),
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
                tool_discovery: Some(ToolDiscovery {
                    protocol: ServiceProtocol::Http,
                    target: "http://dev-koduck-knowledge:8084".to_string(),
                    grpc_service: None,
                    grpc_method: None,
                    http_path: Some("/internal/tools".to_string()),
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
            tool_discovery: None,
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

#[tokio::test]
async fn resolve_ai_tool_definition_services_includes_memory_and_knowledge_catalogs() {
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
                capability_probe: None,
                tool_discovery: Some(ToolDiscovery {
                    protocol: ServiceProtocol::Http,
                    target: "http://dev-koduck-memory:9090".to_string(),
                    grpc_service: None,
                    grpc_method: None,
                    http_path: Some("/internal/tools".to_string()),
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
                capability_probe: None,
                tool_discovery: Some(ToolDiscovery {
                    protocol: ServiceProtocol::Http,
                    target: "http://dev-koduck-knowledge:8084".to_string(),
                    grpc_service: None,
                    grpc_method: None,
                    http_path: Some("/internal/tools".to_string()),
                }),
                feature_hints: vec![],
                version_hints: vec![],
            },
        ];
    }

    let services = registry.resolve_ai_tool_definition_services().await;
    assert_eq!(services.len(), 2);
    assert_eq!(services[0].name, "koduck-knowledge");
    assert_eq!(services[1].name, "koduck-memory");
}
