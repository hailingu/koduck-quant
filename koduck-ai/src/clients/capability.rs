//! Capabilities negotiation protocol for downstream services.
//!
//! Implements startup version negotiation, TTL-based capability caching,
//! and background refresh for memory/tool/llm gRPC clients.

use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{broadcast, RwLock};
use tonic::transport::Endpoint;
use tracing::{error, info, warn};

use crate::clients::proto;
use crate::config::CapabilitiesConfig;
use crate::reliability::error::{AppError, ErrorCode, UpstreamService};

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
    config: CapabilitiesConfig,
}

impl CapabilityCache {
    pub fn new(config: CapabilitiesConfig) -> Self {
        Self {
            memory: RwLock::new(None),
            tool: RwLock::new(None),
            llm: RwLock::new(None),
            config,
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
                AppError::new(
                    ErrorCode::UpstreamUnavailable,
                    "memory service capability check timed out",
                )
                .with_upstream(UpstreamService::Memory)
            })?
            .map_err(|e| {
                AppError::new(
                    ErrorCode::UpstreamUnavailable,
                    format!("memory service GetCapabilities failed: {}", e),
                )
                .with_upstream(UpstreamService::Memory)
            })?;

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
        check_version_compatibility(&memory_cap, &tool_cap, &llm_cap, &self.config)?;

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

    /// Refresh capabilities for all services. Individual failures do not affect others.
    async fn refresh_all(&self, memory_addr: &str, tool_addr: &str, llm_addr: &str) {
        // Memory
        match fetch_memory_capability(memory_addr).await {
            Ok(cap) => {
                info!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "Memory capabilities refreshed"
                );
                *self.memory.write().await = Some(CachedCapability::new(cap));
            }
            Err(e) => warn!(
                error = %e,
                "Failed to refresh memory capabilities (using cached data)"
            ),
        }

        // Tool
        match fetch_tool_capability(tool_addr).await {
            Ok(cap) => {
                info!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "Tool capabilities refreshed"
                );
                *self.tool.write().await = Some(CachedCapability::new(cap));
            }
            Err(e) => warn!(
                error = %e,
                "Failed to refresh tool capabilities (using cached data)"
            ),
        }

        // LLM
        match fetch_llm_capability(llm_addr).await {
            Ok(cap) => {
                info!(
                    service = %cap.service,
                    contract_versions = ?cap.contract_versions,
                    "LLM capabilities refreshed"
                );
                *self.llm.write().await = Some(CachedCapability::new(cap));
            }
            Err(e) => warn!(
                error = %e,
                "Failed to refresh llm capabilities (using cached data)"
            ),
        }
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
}

// ---------------------------------------------------------------------------
// Handle helpers for timeout + upstream error mapping
// ---------------------------------------------------------------------------

fn tool_handle_result(
    result: Result<Result<proto::Capability, tonic::Status>, tokio::time::error::Elapsed>,
) -> Result<proto::Capability, AppError> {
    result
        .map_err(|_| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                "tool service capability check timed out",
            )
            .with_upstream(UpstreamService::Tool)
        })?
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("tool service GetCapabilities failed: {}", e),
            )
            .with_upstream(UpstreamService::Tool)
        })
}

fn llm_handle_result(
    result: Result<Result<proto::Capability, tonic::Status>, tokio::time::error::Elapsed>,
) -> Result<proto::Capability, AppError> {
    result
        .map_err(|_| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                "llm service capability check timed out",
            )
            .with_upstream(UpstreamService::Llm)
        })?
        .map_err(|e| {
            AppError::new(
                ErrorCode::UpstreamUnavailable,
                format!("llm service GetCapabilities failed: {}", e),
            )
            .with_upstream(UpstreamService::Llm)
        })
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
        .get_capabilities(tonic::Request::new(proto::RequestMeta::default()))
        .await?;
    Ok(response.into_inner())
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
        .get_capabilities(tonic::Request::new(proto::RequestMeta::default()))
        .await?;
    Ok(response.into_inner())
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
        .get_capabilities(tonic::Request::new(proto::RequestMeta::default()))
        .await?;
    Ok(response.into_inner())
}

// ---------------------------------------------------------------------------
// Version Compatibility Check
// ---------------------------------------------------------------------------

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

    if !memory.contract_versions.iter().any(|v| v == required) {
        mismatches.push(VersionMismatchAlert {
            service: memory.service.clone(),
            expected_version: required.to_string(),
            actual_versions: memory.contract_versions.clone(),
            severity: "critical".to_string(),
        });
    }

    if !tool.contract_versions.iter().any(|v| v == required) {
        mismatches.push(VersionMismatchAlert {
            service: tool.service.clone(),
            expected_version: required.to_string(),
            actual_versions: tool.contract_versions.clone(),
            severity: "critical".to_string(),
        });
    }

    if !llm.contract_versions.iter().any(|v| v == required) {
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
    use super::*;
    use std::collections::HashMap;

    fn make_capability(service: &str, versions: Vec<&str>) -> proto::Capability {
        proto::Capability {
            service: service.to_string(),
            contract_versions: versions.into_iter().map(String::from).collect(),
            features: HashMap::new(),
            limits: HashMap::new(),
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
    fn test_check_version_compatibility_all_match() {
        let memory = make_capability("memory", vec!["v1"]);
        let tool = make_capability("tool", vec!["v1"]);
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig::default();

        assert!(check_version_compatibility(&memory, &tool, &llm, &config).is_ok());
    }

    #[test]
    fn test_check_version_compatibility_multiple_versions() {
        let memory = make_capability("memory", vec!["v1", "v2"]);
        let tool = make_capability("tool", vec!["v2", "v1"]);
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig::default();

        assert!(check_version_compatibility(&memory, &tool, &llm, &config).is_ok());
    }

    #[test]
    fn test_check_version_compatibility_strict_mode_mismatch() {
        let memory = make_capability("memory", vec!["v1"]);
        let tool = make_capability("tool", vec!["v2"]); // mismatch
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig::default(); // strict_mode = true

        let result = check_version_compatibility(&memory, &tool, &llm, &config);
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

        // Non-strict mode should not error
        assert!(check_version_compatibility(&memory, &tool, &llm, &config).is_ok());
    }

    #[test]
    fn test_collect_mismatches_multiple() {
        let memory = make_capability("memory", vec!["v2"]);
        let tool = make_capability("tool", vec!["v2"]);
        let llm = make_capability("llm", vec!["v1"]);
        let config = CapabilitiesConfig::default();

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
}
