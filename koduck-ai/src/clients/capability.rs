//! Capabilities negotiation protocol for downstream services.
//!
//! Implements startup version negotiation, TTL-based capability caching,
//! and background refresh for memory/tool/llm gRPC clients.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use reqwest::Url;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use tonic::transport::Endpoint;
use tracing::{debug, error, info, warn};

use crate::clients::proto;
use crate::config::{CapabilitiesConfig, LlmConfig, LlmMode};
use crate::llm::LlmProvider;
use crate::registry::{DiscoveredService, ServiceKind, ServiceProtocol, ServiceRegistry};
use crate::reliability::{
    error::{AppError, ErrorCode, UpstreamService},
    error_mapper::{map_grpc_status, map_transport_error},
};

// ---------------------------------------------------------------------------
// Cached Capability
// ---------------------------------------------------------------------------

/// A capability response cached with its expiration time.
#[derive(Debug, Clone)]
pub struct CachedCapability {
    pub capability: proto::Capability,
    pub fetched_at: Instant,
}

impl CachedCapability {
    pub fn new(capability: proto::Capability) -> Self {
        Self {
            capability,
            fetched_at: Instant::now(),
        }
    }

    /// Returns true if the cached entry has expired given the TTL.
    pub fn is_expired(&self, ttl: Duration) -> bool {
        self.fetched_at.elapsed() > ttl
    }
}

// ---------------------------------------------------------------------------
// Negotiation Result
// ---------------------------------------------------------------------------

/// Aggregated result of capability negotiation with all downstream services.
#[derive(Debug)]
pub struct NegotiationResult {
    pub memory: CachedCapability,
    pub tool: CachedCapability,
    pub llm: CachedCapability,
}

// ---------------------------------------------------------------------------
// Version Compatibility Error
// ---------------------------------------------------------------------------

/// Structured version mismatch information for fail-fast alerts.
#[derive(Debug, serde::Serialize)]
pub struct VersionMismatchAlert {
    pub service: String,
    pub expected_version: String,
    pub actual_versions: Vec<String>,
    pub severity: String,
}

// ---------------------------------------------------------------------------
// Capability Metrics
// ---------------------------------------------------------------------------

/// Atomic counters for capability negotiation observability.
pub struct CapabilityMetrics {
    negotiation_total: AtomicU64,
    negotiation_success: AtomicU64,
    negotiation_failure: AtomicU64,
    refresh_total: AtomicU64,
    refresh_success: AtomicU64,
    refresh_failure: AtomicU64,
    version_mismatch_total: AtomicU64,
}

#[derive(Debug, Serialize)]
pub struct CapabilityMetricsSnapshot {
    pub negotiation_total: u64,
    pub negotiation_success: u64,
    pub negotiation_failure: u64,
    pub refresh_total: u64,
    pub refresh_success: u64,
    pub refresh_failure: u64,
    pub version_mismatch_total: u64,
}

impl Default for CapabilityMetrics {
    fn default() -> Self {
        Self::new()
    }
}

impl CapabilityMetrics {
    pub fn new() -> Self {
        Self {
            negotiation_total: AtomicU64::new(0),
            negotiation_success: AtomicU64::new(0),
            negotiation_failure: AtomicU64::new(0),
            refresh_total: AtomicU64::new(0),
            refresh_success: AtomicU64::new(0),
            refresh_failure: AtomicU64::new(0),
            version_mismatch_total: AtomicU64::new(0),
        }
    }

    pub fn record_negotiation_success(&self) {
        self.negotiation_total.fetch_add(1, Ordering::Relaxed);
        self.negotiation_success.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_negotiation_failure(&self) {
        self.negotiation_total.fetch_add(1, Ordering::Relaxed);
        self.negotiation_failure.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_refresh_success(&self) {
        self.refresh_total.fetch_add(1, Ordering::Relaxed);
        self.refresh_success.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_refresh_failure(&self) {
        self.refresh_total.fetch_add(1, Ordering::Relaxed);
        self.refresh_failure.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_version_mismatch(&self, count: u64) {
        self.version_mismatch_total.fetch_add(count, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> CapabilityMetricsSnapshot {
        CapabilityMetricsSnapshot {
            negotiation_total: self.negotiation_total.load(Ordering::Relaxed),
            negotiation_success: self.negotiation_success.load(Ordering::Relaxed),
            negotiation_failure: self.negotiation_failure.load(Ordering::Relaxed),
            refresh_total: self.refresh_total.load(Ordering::Relaxed),
            refresh_success: self.refresh_success.load(Ordering::Relaxed),
            refresh_failure: self.refresh_failure.load(Ordering::Relaxed),
            version_mismatch_total: self.version_mismatch_total.load(Ordering::Relaxed),
        }
    }
}

// ---------------------------------------------------------------------------
// Negotiation Status
// ---------------------------------------------------------------------------

/// Per-service negotiation status for health check exposure.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceNegotiationStatus {
    Ok,
    Failed,
    Pending,
    Disabled,
}

/// Aggregated negotiation status across all downstream services.
#[derive(Debug, Clone, Serialize)]
pub struct NegotiationStatus {
    pub memory: ServiceNegotiationStatus,
    pub tool: ServiceNegotiationStatus,
    pub llm: ServiceNegotiationStatus,
    pub negotiated_at: Option<String>,
}

impl Default for NegotiationStatus {
    fn default() -> Self {
        Self {
            memory: ServiceNegotiationStatus::Pending,
            tool: ServiceNegotiationStatus::Pending,
            llm: ServiceNegotiationStatus::Pending,
            negotiated_at: None,
        }
    }
}

#[derive(Debug, Clone)]
pub enum MemoryCapabilitySource {
    Grpc(String),
    Registry(DiscoveredService),
}

impl MemoryCapabilitySource {
    pub fn describe(&self) -> String {
        match self {
            Self::Grpc(addr) => format!("grpc:{addr}"),
            Self::Registry(service) => format!("registry:{}", service.name),
        }
    }
}

#[derive(Debug, Clone)]
pub enum ToolCapabilitySource {
    Disabled,
    Grpc(String),
    Registry(Vec<DiscoveredService>),
}

impl ToolCapabilitySource {
    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    pub fn describe(&self) -> String {
        match self {
            Self::Disabled => "disabled".to_string(),
            Self::Grpc(addr) => format!("grpc:{addr}"),
            Self::Registry(services) => {
                let names = services
                    .iter()
                    .map(|service| service.name.as_str())
                    .collect::<Vec<_>>()
                    .join(",");
                format!("registry:[{names}]")
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Capability Cache
// ---------------------------------------------------------------------------

/// TTL-based capability cache with async background refresh.
///
/// - **Startup**: parallel `GetCapabilities` calls with timeout -> version check -> fail-fast
/// - **Runtime**: background tokio task refreshes cache at TTL intervals
/// - **Thread safety**: `RwLock` allows concurrent reads, exclusive writes
pub struct CapabilityCache {
    memory: RwLock<Option<CachedCapability>>,
    tool: RwLock<Option<CachedCapability>>,
    llm: RwLock<Option<CachedCapability>>,
    negotiation_status: RwLock<NegotiationStatus>,
    config: CapabilitiesConfig,
    metrics: CapabilityMetrics,
}

impl CapabilityCache {
    pub fn new(config: CapabilitiesConfig) -> Self {
        Self {
            memory: RwLock::new(None),
            tool: RwLock::new(None),
            llm: RwLock::new(None),
            negotiation_status: RwLock::new(NegotiationStatus::default()),
            config,
            metrics: CapabilityMetrics::new(),
        }
    }

    /// Perform initial capability negotiation with all downstream services.
    ///
    /// Calls GetCapabilities on memory/tool/llm in parallel, validates versions,
    /// and populates the cache. Returns `NegotiationResult` on success.
    ///
    /// # Errors
    ///
    /// Returns `AppError` if:
    /// - Any service call fails (timeout, connection refused, etc.)
    /// - Version incompatibility is detected (in strict mode)
    pub async fn initial_negotiation(
        &self,
        memory_addr: &str,
        tool_addr: &str,
        llm_addr: &str,
    ) -> Result<NegotiationResult, AppError> {
        let timeout = Duration::from_millis(self.config.startup_timeout_ms);

        let memory_handle =
            tokio::time::timeout(timeout, fetch_memory_capability(memory_addr));

        let tool_handle = tokio::time::timeout(timeout, fetch_tool_capability(tool_addr));

        let llm_handle = tokio::time::timeout(timeout, fetch_llm_capability(llm_addr));

        // Parallel fetch
        let (memory_result, tool_result, llm_result) =
            tokio::join!(memory_handle, tool_handle, llm_handle);

        let memory_cap = memory_result
            .map_err(|_| {
                map_transport_error(
                    UpstreamService::Memory,
                    "startup-capability-check",
                    "memory service capability check timed out",
                    "deadline exceeded",
                )
            })?
            .map_err(|e| map_grpc_status(UpstreamService::Memory, "startup-capability-check", &e))?;

        let tool_cap = tool_handle_result(tool_result)?;
        let llm_cap = llm_handle_result(llm_result)?;

        // Log negotiated contract_versions
        info!(
            memory.service = %memory_cap.service,
            memory.contract_versions = ?memory_cap.contract_versions,
            "Memory service capabilities negotiated"
        );
        info!(
            tool.service = %tool_cap.service,
            tool.contract_versions = ?tool_cap.contract_versions,
            "Tool service capabilities negotiated"
        );
        info!(
            llm.service = %llm_cap.service,
            llm.contract_versions = ?llm_cap.contract_versions,
            "LLM service capabilities negotiated"
        );

        // Version compatibility check
        check_version_compatibility(&memory_cap, &tool_cap, &llm_cap, &self.config, &self.metrics)?;

        // Populate cache
        let memory_cached = CachedCapability::new(memory_cap);
        let tool_cached = CachedCapability::new(tool_cap);
        let llm_cached = CachedCapability::new(llm_cap);

        {
            *self.memory.write().await = Some(memory_cached.clone());
        }
        {
            *self.tool.write().await = Some(tool_cached.clone());
        }
        {
            *self.llm.write().await = Some(llm_cached.clone());
        }

        *self.negotiation_status.write().await = NegotiationStatus {
            memory: ServiceNegotiationStatus::Ok,
            tool: ServiceNegotiationStatus::Ok,
            llm: ServiceNegotiationStatus::Ok,
            negotiated_at: Some(chrono::Utc::now().to_rfc3339()),
        };

        self.metrics.record_negotiation_success();

        info!(
            ttl_secs = self.config.ttl_secs,
            "Capability cache populated"
        );

        Ok(NegotiationResult {
            memory: memory_cached,
            tool: tool_cached,
            llm: llm_cached,
        })
    }

    pub async fn initial_negotiation_mode_aware(
        &self,
        memory_source: &MemoryCapabilitySource,
        tool_source: &ToolCapabilitySource,
        llm_addr: &str,
        llm_mode: LlmMode,
        llm_config: &LlmConfig,
        llm_provider: Arc<dyn LlmProvider>,
    ) -> Result<NegotiationResult, AppError> {
        let timeout = Duration::from_millis(self.config.startup_timeout_ms);

        let memory_handle = tokio::time::timeout(
            timeout,
            fetch_memory_capability_from_source(memory_source),
        );
        let llm_handle = match llm_mode {
            LlmMode::Adapter => tokio::time::timeout(timeout, fetch_llm_capability(llm_addr))
                .await
                .map_err(|_| {
                    map_transport_error(
                        UpstreamService::Llm,
                        "startup-capability-check",
                        "llm service capability check timed out",
                        "deadline exceeded",
                    )
                })?
                .map_err(|e| map_grpc_status(UpstreamService::Llm, "startup-capability-check", &e)),
            LlmMode::Direct => tokio::time::timeout(
                timeout,
                fetch_direct_llm_capability(
                    llm_config,
                    Arc::clone(&llm_provider),
                    &self.config.required_version,
                ),
            )
            .await
            .map_err(|_| {
                map_transport_error(
                    UpstreamService::Llm,
                    "startup-capability-check",
                    "direct llm provider capability check timed out",
                    "deadline exceeded",
                )
            })?,
        };

        let memory_result = memory_handle.await;

        let memory_cap = memory_result
            .map_err(|_| {
                map_transport_error(
                    UpstreamService::Memory,
                    "startup-capability-check",
                    "memory service capability check timed out",
                    "deadline exceeded",
                )
            })?
            ?;

        let llm_cap = llm_handle?;
        let tool_cap = if tool_source.is_enabled() {
            Some(
                tokio::time::timeout(
                    timeout,
                    fetch_tool_capability_from_source(tool_source, &self.config, &self.metrics),
                )
                .await
                .map_err(|_| {
                    map_transport_error(
                        UpstreamService::Tool,
                        "startup-capability-check",
                        "tool discovery capability check timed out",
                        "deadline exceeded",
                    )
                })??,
            )
        } else {
            None
        };

        info!(
            memory.service = %memory_cap.service,
            memory.contract_versions = ?memory_cap.contract_versions,
            "Memory service capabilities negotiated"
        );
        if let Some(tool_cap) = tool_cap.as_ref() {
            info!(
                tool.service = %tool_cap.service,
                tool.contract_versions = ?tool_cap.contract_versions,
                "Tool service capabilities negotiated"
            );
        }
        info!(
            llm.service = %llm_cap.service,
            llm.contract_versions = ?llm_cap.contract_versions,
            llm_mode = %llm_mode,
            "LLM capabilities negotiated"
        );

        if let Some(tool_cap) = tool_cap.as_ref() {
            check_version_compatibility(
                &memory_cap,
                tool_cap,
                &llm_cap,
                &self.config,
                &self.metrics,
            )?;
        }

        let memory_cached = CachedCapability::new(memory_cap);
        let llm_cached = CachedCapability::new(llm_cap);
        let tool_cached = tool_cap.map(CachedCapability::new);
        let tool_result_cached = tool_cached.clone().unwrap_or_else(|| {
            CachedCapability::new(proto::Capability {
                service: "tool".to_string(),
                contract_versions: vec![self.config.required_version.clone()],
                features: HashMap::from([("enabled".to_string(), "false".to_string())]),
                limits: HashMap::new(),
            })
        });

        *self.memory.write().await = Some(memory_cached.clone());
        *self.tool.write().await = tool_cached.clone();
        *self.llm.write().await = Some(llm_cached.clone());

        *self.negotiation_status.write().await = NegotiationStatus {
            memory: ServiceNegotiationStatus::Ok,
            tool: if tool_source.is_enabled() {
                ServiceNegotiationStatus::Ok
            } else {
                ServiceNegotiationStatus::Disabled
            },
            llm: ServiceNegotiationStatus::Ok,
            negotiated_at: Some(chrono::Utc::now().to_rfc3339()),
        };

        self.metrics.record_negotiation_success();

        info!(
            ttl_secs = self.config.ttl_secs,
            llm_mode = %llm_mode,
            "Capability cache populated"
        );

        Ok(NegotiationResult {
            memory: memory_cached,
            tool: tool_result_cached,
            llm: llm_cached,
        })
    }

    /// Spawn a background task that periodically refreshes the capability cache.
    ///
    /// The task sleeps until TTL expires, then refreshes all three services.
    /// Refresh failures are logged as warnings but do not affect cached data.
    /// The task exits when `shutdown_rx` receives a shutdown signal.
    pub fn spawn_refresh_task(
        self: &Arc<Self>,
        memory_addr: String,
        tool_addr: String,
        llm_addr: String,
        mut shutdown_rx: broadcast::Receiver<()>,
    ) -> tokio::task::JoinHandle<()> {
        let cache = Arc::clone(self);
        let ttl = Duration::from_secs(self.config.ttl_secs);

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = tokio::time::sleep(ttl) => {
                        cache.refresh_all(&memory_addr, &tool_addr, &llm_addr).await;
                    }
                    _ = shutdown_rx.recv() => {
                        info!("Capability refresh task shutting down");
                        break;
                    }
                }
            }
        })
    }

    pub fn spawn_refresh_task_mode_aware(
        self: &Arc<Self>,
        service_registry: Option<Arc<ServiceRegistry>>,
        memory_source: MemoryCapabilitySource,
        tool_source: ToolCapabilitySource,
        llm_addr: String,
        llm_mode: LlmMode,
        llm_config: LlmConfig,
        llm_provider: Arc<dyn LlmProvider>,
        mut shutdown_rx: broadcast::Receiver<()>,
    ) -> tokio::task::JoinHandle<()> {
        let cache = Arc::clone(self);
        let ttl = Duration::from_secs(self.config.ttl_secs);

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = tokio::time::sleep(ttl) => {
                        let resolved_memory_addr = match service_registry.as_ref() {
                            Some(registry) => {
                                match registry
                                    .resolve_ai_capability_service(ServiceKind::Memory)
                                    .await
                                {
                                    Some(service) => MemoryCapabilitySource::Registry(service),
                                    None => memory_source.clone(),
                                }
                            }
                            None => memory_source.clone(),
                        };
                        let resolved_tool_source = match service_registry.as_ref() {
                            Some(registry) => {
                                let services = registry.resolve_ai_tool_services().await;
                                if services.is_empty() {
                                    tool_source.clone()
                                } else {
                                    ToolCapabilitySource::Registry(services)
                                }
                            }
                            None => tool_source.clone(),
                        };
                        cache.refresh_all_mode_aware(
                            &resolved_memory_addr,
                            &resolved_tool_source,
                            &llm_addr,
                            llm_mode,
                            &llm_config,
                            &cache.config.required_version,
                            Arc::clone(&llm_provider),
                        ).await;
                    }
                    _ = shutdown_rx.recv() => {
                        info!("Capability refresh task shutting down");
                        break;
                    }
                }
            }
        })
    }

    /// Refresh capabilities for all services. Individual failures do not affect others.
    async fn refresh_all(&self, memory_addr: &str, tool_addr: &str, llm_addr: &str) {
        // Memory
        match fetch_memory_capability(memory_addr).await {
            Ok(cap) => {
                debug!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "Memory capabilities refreshed"
                );
                *self.memory.write().await = Some(CachedCapability::new(cap));
                self.metrics.record_refresh_success();
            }
            Err(e) => {
                warn!(
                    error = %e,
                    "Failed to refresh memory capabilities (using cached data)"
                );
                self.metrics.record_refresh_failure();
            }
        }

        // Tool
        match fetch_tool_capability(tool_addr).await {
            Ok(cap) => {
                debug!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "Tool capabilities refreshed"
                );
                *self.tool.write().await = Some(CachedCapability::new(cap));
                self.metrics.record_refresh_success();
            }
            Err(e) => {
                warn!(
                    error = %e,
                    "Failed to refresh tool capabilities (using cached data)"
                );
                self.metrics.record_refresh_failure();
            }
        }

        // LLM
        match fetch_llm_capability(llm_addr).await {
            Ok(cap) => {
                debug!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "LLM capabilities refreshed"
                );
                *self.llm.write().await = Some(CachedCapability::new(cap));
                self.metrics.record_refresh_success();
            }
            Err(e) => {
                warn!(
                    error = %e,
                    "Failed to refresh llm capabilities (using cached data)"
                );
                self.metrics.record_refresh_failure();
            }
        }

        // Update negotiation timestamp on successful refresh
        *self.negotiation_status.write().await = NegotiationStatus {
            memory: if self.memory.read().await.is_some() { ServiceNegotiationStatus::Ok } else { ServiceNegotiationStatus::Failed },
            tool: if self.tool.read().await.is_some() { ServiceNegotiationStatus::Ok } else { ServiceNegotiationStatus::Failed },
            llm: if self.llm.read().await.is_some() { ServiceNegotiationStatus::Ok } else { ServiceNegotiationStatus::Failed },
            negotiated_at: Some(chrono::Utc::now().to_rfc3339()),
        };
    }

    async fn refresh_all_mode_aware(
        &self,
        memory_source: &MemoryCapabilitySource,
        tool_source: &ToolCapabilitySource,
        llm_addr: &str,
        llm_mode: LlmMode,
        llm_config: &LlmConfig,
        required_version: &str,
        llm_provider: Arc<dyn LlmProvider>,
    ) {
        match fetch_memory_capability_from_source(memory_source).await {
            Ok(cap) => {
                debug!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "Memory capabilities refreshed"
                );
                *self.memory.write().await = Some(CachedCapability::new(cap));
                self.metrics.record_refresh_success();
            }
            Err(e) => {
                warn!(
                    error = %e,
                    "Failed to refresh memory capabilities (using cached data)"
                );
                self.metrics.record_refresh_failure();
            }
        }

        if tool_source.is_enabled() {
            match fetch_tool_capability_from_source(tool_source, &self.config, &self.metrics).await {
                Ok(cap) => {
                    debug!(
                        service = %cap.service,
                        contract_versions = ?cap.contract_versions,
                        "Tool capabilities refreshed"
                    );
                    *self.tool.write().await = Some(CachedCapability::new(cap));
                    self.metrics.record_refresh_success();
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        "Failed to refresh tool capabilities (using cached data)"
                    );
                    self.metrics.record_refresh_failure();
                }
            }
        } else {
            *self.tool.write().await = None;
        }

        let llm_result = match llm_mode {
            LlmMode::Adapter => fetch_llm_capability(llm_addr)
                .await
                .map_err(|e| map_grpc_status(UpstreamService::Llm, "capability-refresh", &e)),
            LlmMode::Direct => {
                fetch_direct_llm_capability(llm_config, llm_provider, required_version).await
            }

        };

        match llm_result {
            Ok(cap) => {
                debug!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    llm_mode = %llm_mode,
                    "LLM capabilities refreshed"
                );
                *self.llm.write().await = Some(CachedCapability::new(cap));
                self.metrics.record_refresh_success();
            }
            Err(e) => {
                warn!(
                    error = %e,
                    llm_mode = %llm_mode,
                    "Failed to refresh llm capabilities (using cached data)"
                );
                self.metrics.record_refresh_failure();
            }
        }

        *self.negotiation_status.write().await = NegotiationStatus {
            memory: if self.memory.read().await.is_some() { ServiceNegotiationStatus::Ok } else { ServiceNegotiationStatus::Failed },
            tool: if tool_source.is_enabled() {
                if self.tool.read().await.is_some() {
                    ServiceNegotiationStatus::Ok
                } else {
                    ServiceNegotiationStatus::Failed
                }
            } else {
                ServiceNegotiationStatus::Disabled
            },
            llm: if self.llm.read().await.is_some() { ServiceNegotiationStatus::Ok } else { ServiceNegotiationStatus::Failed },
            negotiated_at: Some(chrono::Utc::now().to_rfc3339()),
        };
    }

    /// Get a snapshot of the currently cached memory capability.
    pub async fn get_memory(&self) -> Option<CachedCapability> {
        self.memory.read().await.clone()
    }

    /// Get a snapshot of the currently cached tool capability.
    pub async fn get_tool(&self) -> Option<CachedCapability> {
        self.tool.read().await.clone()
    }

    /// Get a snapshot of the currently cached llm capability.
    pub async fn get_llm(&self) -> Option<CachedCapability> {
        self.llm.read().await.clone()
    }

    /// Get the current negotiation status for health checks.
    pub async fn get_negotiation_status(&self) -> NegotiationStatus {
        self.negotiation_status.read().await.clone()
    }

    /// Get a snapshot of capability metrics.
    pub fn get_metrics_snapshot(&self) -> CapabilityMetricsSnapshot {
        self.metrics.snapshot()
    }
}

// ---------------------------------------------------------------------------
// Handle helpers for timeout + upstream error mapping
// ---------------------------------------------------------------------------

fn tool_handle_result(
    result: Result<Result<proto::Capability, tonic::Status>, tokio::time::error::Elapsed>,
) -> Result<proto::Capability, AppError> {
    result
        .map_err(|_| {
            map_transport_error(
                UpstreamService::Tool,
                "startup-capability-check",
                "tool service capability check timed out",
                "deadline exceeded",
            )
        })?
        .map_err(|e| map_grpc_status(UpstreamService::Tool, "startup-capability-check", &e))
}

fn llm_handle_result(
    result: Result<Result<proto::Capability, tonic::Status>, tokio::time::error::Elapsed>,
) -> Result<proto::Capability, AppError> {
    result
        .map_err(|_| {
            map_transport_error(
                UpstreamService::Llm,
                "startup-capability-check",
                "llm service capability check timed out",
                "deadline exceeded",
            )
        })?
        .map_err(|e| map_grpc_status(UpstreamService::Llm, "startup-capability-check", &e))
}

// ---------------------------------------------------------------------------
// Per-service fetch helpers
// ---------------------------------------------------------------------------

async fn fetch_memory_capability(addr: &str) -> Result<proto::Capability, tonic::Status> {
    let endpoint = Endpoint::from_shared(addr.to_string())
        .map_err(|e| tonic::Status::internal(format!("invalid endpoint '{}': {}", addr, e)))?;
    let channel = endpoint.connect().await.map_err(|e| {
        tonic::Status::unavailable(format!(
            "failed to connect to memory service at '{}': {}",
            addr, e
        ))
    })?;
    let mut client = proto::MemoryServiceClient::new(channel);
    let response = client
        .get_capabilities(tonic::Request::new(capability_probe_meta(
            "memory",
            "memory.v1",
            5_000,
        )))
        .await?;
    Ok(response.into_inner())
}

async fn fetch_memory_capability_from_source(
    memory_source: &MemoryCapabilitySource,
) -> Result<proto::Capability, AppError> {
    match memory_source {
        MemoryCapabilitySource::Grpc(addr) => fetch_memory_capability(addr)
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Memory, "startup-capability-check", &e)),
        MemoryCapabilitySource::Registry(service) => {
            let probe = service.capability_probe.as_ref().ok_or_else(|| {
                AppError::new(
                    ErrorCode::InvalidArgument,
                    format!("service '{}' does not define a capability probe", service.name),
                )
                .with_upstream(UpstreamService::Memory)
            })?;

            match probe.protocol {
                ServiceProtocol::Grpc => fetch_memory_capability(&probe.target).await.map_err(
                    |e| map_grpc_status(UpstreamService::Memory, "registry-capability-check", &e),
                ),
                ServiceProtocol::Http => Err(
                    AppError::new(
                        ErrorCode::InvalidArgument,
                        format!(
                            "memory service '{}' advertises unsupported http capability probe",
                            service.name
                        ),
                    )
                    .with_upstream(UpstreamService::Memory),
                ),
            }
        }
    }
}

async fn fetch_tool_capability(addr: &str) -> Result<proto::Capability, tonic::Status> {
    let endpoint = Endpoint::from_shared(addr.to_string())
        .map_err(|e| tonic::Status::internal(format!("invalid endpoint '{}': {}", addr, e)))?;
    let channel = endpoint.connect().await.map_err(|e| {
        tonic::Status::unavailable(format!(
            "failed to connect to tool service at '{}': {}",
            addr, e
        ))
    })?;
    let mut client = proto::ToolServiceClient::new(channel);
    let response = client
        .get_capabilities(tonic::Request::new(capability_probe_meta(
            "tool",
            "tool.v1",
            5_000,
        )))
        .await?;
    Ok(response.into_inner())
}

async fn fetch_tool_capability_from_source(
    tool_source: &ToolCapabilitySource,
    config: &CapabilitiesConfig,
    metrics: &CapabilityMetrics,
) -> Result<proto::Capability, AppError> {
    match tool_source {
        ToolCapabilitySource::Disabled => Err(AppError::new(
            ErrorCode::InvalidArgument,
            "tool capability source is disabled",
        )),
        ToolCapabilitySource::Grpc(addr) => fetch_tool_capability(addr)
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Tool, "startup-capability-check", &e)),
        ToolCapabilitySource::Registry(services) => {
            fetch_registry_tool_capability(services, config, metrics).await
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpCapabilityResponse {
    service: String,
    #[serde(default)]
    service_kind: Option<String>,
    #[serde(default)]
    contract_versions: Vec<String>,
    #[serde(default)]
    features: Vec<String>,
    #[serde(default)]
    limits: HashMap<String, serde_json::Value>,
}

async fn fetch_registry_tool_capability(
    services: &[DiscoveredService],
    config: &CapabilitiesConfig,
    metrics: &CapabilityMetrics,
) -> Result<proto::Capability, AppError> {
    let mut capabilities = Vec::with_capacity(services.len());
    for service in services {
        capabilities.push(fetch_discovered_tool_capability(service).await?);
    }

    check_registry_tool_version_compatibility(&capabilities, config, metrics)?;
    Ok(aggregate_registry_tool_capability(&capabilities))
}

async fn fetch_discovered_tool_capability(
    service: &DiscoveredService,
) -> Result<proto::Capability, AppError> {
    let probe = service.capability_probe.as_ref().ok_or_else(|| {
        AppError::new(
            ErrorCode::InvalidArgument,
            format!("service '{}' does not define a capability probe", service.name),
        )
        .with_upstream(UpstreamService::Tool)
    })?;

    match probe.protocol {
        ServiceProtocol::Grpc => fetch_tool_capability(&probe.target)
            .await
            .map_err(|e| map_grpc_status(UpstreamService::Tool, "registry-capability-check", &e)),
        ServiceProtocol::Http => fetch_http_capability(service, probe).await,
    }
}

async fn fetch_http_capability(
    service: &DiscoveredService,
    probe: &crate::registry::CapabilityProbe,
) -> Result<proto::Capability, AppError> {
    let url = build_capability_probe_url(&probe.target, probe.http_path.as_deref()).map_err(|e| {
        AppError::new(
            ErrorCode::InvalidArgument,
            format!(
                "service '{}' has an invalid capability probe url: {}",
                service.name, e
            ),
        )
        .with_upstream(UpstreamService::Tool)
    })?;

    let response = reqwest::Client::new()
        .get(url.clone())
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|error| {
            map_transport_error(
                UpstreamService::Tool,
                "registry-capability-check",
                "tool capability http probe failed",
                error,
            )
        })?
        .error_for_status()
        .map_err(|error| {
            map_transport_error(
                UpstreamService::Tool,
                "registry-capability-check",
                "tool capability http probe returned error",
                error,
            )
        })?;

    let payload = response.json::<HttpCapabilityResponse>().await.map_err(|error| {
        map_transport_error(
            UpstreamService::Tool,
            "registry-capability-check",
            "tool capability http probe returned invalid json",
            error,
        )
    })?;

    Ok(http_capability_to_proto(service, payload))
}

fn build_capability_probe_url(target: &str, http_path: Option<&str>) -> Result<Url, String> {
    let mut url = Url::parse(target).map_err(|error| error.to_string())?;
    if let Some(path) = http_path {
        let normalized = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{path}")
        };
        url.set_path(&normalized);
    }
    Ok(url)
}

fn http_capability_to_proto(
    service: &DiscoveredService,
    payload: HttpCapabilityResponse,
) -> proto::Capability {
    let mut features = HashMap::new();
    for feature in payload.features {
        features.insert(feature, "true".to_string());
    }

    features.insert(
        "service_kind".to_string(),
        payload
            .service_kind
            .unwrap_or_else(|| service.service_kind.to_string()),
    );
    features.insert(
        "registry_name".to_string(),
        service.name.clone(),
    );
    features.insert("probe_protocol".to_string(), "http".to_string());

    let limits = payload
        .limits
        .into_iter()
        .map(|(key, value)| (key, stringify_json_value(value)))
        .collect();

    proto::Capability {
        service: payload.service,
        contract_versions: payload.contract_versions,
        features,
        limits,
    }
}

fn stringify_json_value(value: serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(value) => value.to_string(),
        serde_json::Value::Number(value) => value.to_string(),
        serde_json::Value::String(value) => value,
        other => other.to_string(),
    }
}

fn check_registry_tool_version_compatibility(
    capabilities: &[proto::Capability],
    config: &CapabilitiesConfig,
    metrics: &CapabilityMetrics,
) -> Result<(), AppError> {
    let mismatches = capabilities
        .iter()
        .filter(|capability| {
            !capability
                .contract_versions
                .iter()
                .any(|version| version_matches(version, &config.required_version))
        })
        .map(|capability| VersionMismatchAlert {
            service: capability.service.clone(),
            expected_version: config.required_version.clone(),
            actual_versions: capability.contract_versions.clone(),
            severity: "critical".to_string(),
        })
        .collect::<Vec<_>>();

    if mismatches.is_empty() {
        return Ok(());
    }

    metrics.record_version_mismatch(mismatches.len() as u64);

    if config.strict_mode {
        for alert in &mismatches {
            error!(
                service = %alert.service,
                expected = %alert.expected_version,
                actual = ?alert.actual_versions,
                "Registry-discovered tool reports incompatible contract version"
            );
        }
        return Err(
            AppError::new(
                ErrorCode::DependencyFailed,
                format!(
                    "Registry-discovered tool incompatibility: {} service(s) do not support required version '{}'",
                    mismatches.len(),
                    config.required_version
                ),
            )
            .with_upstream(UpstreamService::Tool),
        );
    }

    for alert in &mismatches {
        warn!(
            service = %alert.service,
            expected = %alert.expected_version,
            actual = ?alert.actual_versions,
            "Registry-discovered tool version mismatch detected (non-strict mode, continuing)"
        );
    }

    Ok(())
}

fn aggregate_registry_tool_capability(capabilities: &[proto::Capability]) -> proto::Capability {
    let mut contract_versions = capabilities
        .iter()
        .flat_map(|capability| capability.contract_versions.iter().cloned())
        .collect::<Vec<_>>();
    contract_versions.sort();
    contract_versions.dedup();

    let mut features = HashMap::new();
    let service_names = capabilities
        .iter()
        .map(|capability| capability.service.clone())
        .collect::<Vec<_>>();
    features.insert("mode".to_string(), "registry".to_string());
    features.insert(
        "service_count".to_string(),
        capabilities.len().to_string(),
    );
    features.insert("service_names".to_string(), service_names.join(","));

    let mut limits = HashMap::new();
    limits.insert(
        "service_count".to_string(),
        capabilities.len().to_string(),
    );

    for capability in capabilities {
        let service_key = sanitize_capability_segment(&capability.service);
        features.insert(
            format!("service.{service_key}.contract_versions"),
            capability.contract_versions.join(","),
        );
        for (feature_key, feature_value) in &capability.features {
            features.insert(
                format!("service.{service_key}.{}", sanitize_capability_segment(feature_key)),
                feature_value.clone(),
            );
        }
        for (limit_key, limit_value) in &capability.limits {
            limits.insert(
                format!("service.{service_key}.{}", sanitize_capability_segment(limit_key)),
                limit_value.clone(),
            );
        }
    }

    proto::Capability {
        service: "tool-registry".to_string(),
        contract_versions,
        features,
        limits,
    }
}

fn sanitize_capability_segment(value: &str) -> String {
    value.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect()
}

async fn fetch_llm_capability(addr: &str) -> Result<proto::Capability, tonic::Status> {
    let endpoint = Endpoint::from_shared(addr.to_string())
        .map_err(|e| tonic::Status::internal(format!("invalid endpoint '{}': {}", addr, e)))?;
    let channel = endpoint.connect().await.map_err(|e| {
        tonic::Status::unavailable(format!(
            "failed to connect to llm service at '{}': {}",
            addr, e
        ))
    })?;
    let mut client = proto::LlmServiceClient::new(channel);
    let response = client
        .get_capabilities(tonic::Request::new(capability_probe_meta(
            "llm",
            "llm.v1",
            5_000,
        )))
        .await?;
    Ok(response.into_inner())
}

async fn fetch_direct_llm_capability(
    llm_config: &LlmConfig,
    _llm_provider: Arc<dyn LlmProvider>,
    required_version: &str,
) -> Result<proto::Capability, AppError> {
    let providers = enabled_llm_providers(llm_config);
    if providers.is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidArgument,
            "no direct llm providers are enabled",
        ));
    }

    let mut features = HashMap::new();
    features.insert("mode".to_string(), "direct".to_string());
    features.insert("default_provider".to_string(), llm_config.default_provider.clone());
    features.insert("available_providers".to_string(), providers.join(","));
    features.insert("supports_chat".to_string(), "true".to_string());
    features.insert("supports_stream".to_string(), "true".to_string());
    features.insert("supports_count_tokens".to_string(), "true".to_string());
    features.insert("probe".to_string(), "list_models".to_string());

    let mut limits = HashMap::new();
    limits.insert("provider_count".to_string(), providers.len().to_string());
    limits.insert("timeout_ms".to_string(), llm_config.timeout_ms.to_string());

    for provider in &providers {
        if let Some(provider_config) = llm_config.provider_config(provider) {
            features.insert(
                format!("provider.{}.configured_default_model", provider),
                provider_config.default_model.clone(),
            );
            features.insert(
                format!("provider.{}.base_url", provider),
                provider_config.base_url.clone(),
            );
        }
        if let Some(provider_config) = llm_config.provider_config(provider) {
            features.insert(
                format!("provider.{}.default_model", provider),
                provider_config.default_model.clone(),
            );
            limits.insert(format!("provider.{}.models", provider), "1".to_string());
        }
    }

    Ok(proto::Capability {
        service: "llm".to_string(),
        contract_versions: vec![required_version.to_string()],
        features,
        limits,
    })
}

fn enabled_llm_providers(llm_config: &LlmConfig) -> Vec<String> {
    ["openai", "deepseek", "minimax", "kimi"]
        .into_iter()
        .filter(|provider| {
            llm_config
                .provider_config(provider)
                .map(|cfg| cfg.enabled)
                .unwrap_or(false)
        })
        .map(str::to_string)
        .collect()
}

fn capability_probe_meta(service: &str, api_version: &str, deadline_ms: u64) -> proto::RequestMeta {
    proto::RequestMeta {
        request_id: format!("capability-probe-{service}"),
        session_id: "capability-probe".to_string(),
        user_id: "system".to_string(),
        tenant_id: "system".to_string(),
        trace_id: format!("trace-capability-probe-{service}"),
        idempotency_key: String::new(),
        deadline_ms: deadline_ms.min(i64::MAX as u64) as i64,
        api_version: api_version.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Version Compatibility Check
// ---------------------------------------------------------------------------

/// Check if an actual version string matches the required version.
///
/// Uses suffix matching: `"v1"` matches `"v1"`, `"memory.v1"`, `"tool.v1"`, `"llm.v1"`.
/// This handles the case where downstream services use `"{service}.v1"` format
/// (e.g., koduck-memory returns `"memory.v1"`) while the required version is `"v1"`.
fn version_matches(actual: &str, required: &str) -> bool {
    actual == required || actual.ends_with(&format!(".{required}"))
}

/// Check version compatibility across all services.
///
/// In strict mode, any service that does not advertise the required version
/// causes an error with a structured alert. In non-strict mode, mismatches
/// are logged as warnings.
fn check_version_compatibility(
    memory: &proto::Capability,
    tool: &proto::Capability,
    llm: &proto::Capability,
    config: &CapabilitiesConfig,
    metrics: &CapabilityMetrics,
) -> Result<(), AppError> {
    let required = &config.required_version;

    let mismatches = collect_mismatches(memory, tool, llm, required);

    if mismatches.is_empty() {
        info!(
            required_version = %required,
            "All services report compatible contract versions"
        );
        return Ok(());
    }

    metrics.record_version_mismatch(mismatches.len() as u64);

    if config.strict_mode {
        // Output structured alert and fail
        for alert in &mismatches {
            let alert_json = serde_json::to_string_pretty(alert).unwrap_or_else(|_| {
                format!(
                    "{{ service: {}, expected: {}, actual: {:?} }}",
                    alert.service, alert.expected_version, alert.actual_versions
                )
            });
            error!(
                alert = %alert_json,
                "Version incompatibility detected - service refusing to start"
            );
        }

        Err(AppError::new(
            ErrorCode::DependencyFailed,
            format!(
                "Version incompatibility: {} service(s) do not support required version '{}'",
                mismatches.len(),
                required
            ),
        ))
    } else {
        // Non-strict mode: warn but allow startup
        for alert in &mismatches {
            warn!(
                service = %alert.service,
                expected = %alert.expected_version,
                actual = ?alert.actual_versions,
                "Version mismatch detected (non-strict mode, continuing)"
            );
        }
        Ok(())
    }
}

/// Collect version mismatches from all three services.
fn collect_mismatches(
    memory: &proto::Capability,
    tool: &proto::Capability,
    llm: &proto::Capability,
    required: &str,
) -> Vec<VersionMismatchAlert> {
    let mut mismatches = Vec::new();

    if !memory
        .contract_versions
        .iter()
        .any(|v| version_matches(v, required))
    {
        mismatches.push(VersionMismatchAlert {
            service: memory.service.clone(),
            expected_version: required.to_string(),
            actual_versions: memory.contract_versions.clone(),
            severity: "critical".to_string(),
        });
    }

    if !tool
        .contract_versions
        .iter()
        .any(|v| version_matches(v, required))
    {
        mismatches.push(VersionMismatchAlert {
            service: tool.service.clone(),
            expected_version: required.to_string(),
            actual_versions: tool.contract_versions.clone(),
            severity: "critical".to_string(),
        });
    }

    if !llm
        .contract_versions
        .iter()
        .any(|v| version_matches(v, required))
    {
        mismatches.push(VersionMismatchAlert {
            service: llm.service.clone(),
            expected_version: required.to_string(),
            actual_versions: llm.contract_versions.clone(),
            severity: "critical".to_string(),
        });
    }

    mismatches
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
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
        // koduck-memory returns "memory.v1", koduck-tool returns "tool.v1", llm returns "v1"
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
        let tool = make_capability("tool", vec!["v2"]); // mismatch
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig::default(); // strict_mode = true
        let metrics = CapabilityMetrics::new();

        let result = check_version_compatibility(&memory, &tool, &llm, &config, &metrics);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, ErrorCode::DependencyFailed);
    }

    #[test]
    fn test_check_version_compatibility_non_strict_mode() {
        let memory = make_capability("memory", vec!["v1"]);
        let tool = make_capability("tool", vec!["v2"]); // mismatch
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig {
            strict_mode: false,
            ..CapabilitiesConfig::default()
        };
        let metrics = CapabilityMetrics::new();

        // Non-strict mode should not error
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
        assert_eq!(
            capability.limits.get("max_results"),
            Some(&"20".to_string())
        );
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
        assert_eq!(
            aggregated.features.get("mode"),
            Some(&"registry".to_string())
        );
        assert_eq!(
            aggregated.features.get("service_count"),
            Some(&"2".to_string())
        );
        assert_eq!(
            aggregated
                .features
                .get("service.koduck_knowledge.entity_search"),
            Some(&"true".to_string())
        );
        assert_eq!(
            aggregated
                .features
                .get("service.koduck_tool.lookup_quote"),
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
                base_url: "https://api.deepseek.com/v1".to_string(),
                default_model: "deepseek-chat".to_string(),
                ..LlmProviderConfig::default()
            },
            minimax: LlmProviderConfig {
                enabled: false,
                ..LlmProviderConfig::default()
            },
            ..LlmConfig::default()
        };

        let capability = fetch_direct_llm_capability(
            &llm_config,
            Arc::new(MockDirectProvider),
            "v1",
        )
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
}
