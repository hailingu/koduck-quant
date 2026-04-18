//! Application startup and lifecycle management

use std::sync::Arc;

use axum::{
    extract::State,
    routing::{delete, get, post},
    Router,
};
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;
use tokio::sync::broadcast;
use tracing::warn;

use crate::api;
use crate::clients::capability::{CapabilityCache, MemoryCapabilitySource, ToolCapabilitySource};
use crate::config::{Config, LlmMode};
use crate::registry::{RegistrySnapshot, ServiceKind, ServiceRegistry};
use crate::reliability::error::{AppError, UpstreamService};
use crate::llm::{build_provider_router, LlmProvider};
use crate::reliability::degrade::DegradePolicy;
use crate::reliability::memory_observe::MemoryObservePolicy;
use crate::reliability::retry_budget::RetryBudgetPolicy;
use crate::stream::sse::StreamRegistry;

pub mod lifecycle;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub stream_registry: Arc<StreamRegistry>,
    pub lifecycle: Arc<lifecycle::LifecycleManager>,
    pub degrade_policy: Arc<DegradePolicy>,
    pub retry_budget_policy: Arc<RetryBudgetPolicy>,
    pub memory_observe_policy: Arc<MemoryObservePolicy>,
    pub llm_provider: Arc<dyn LlmProvider>,
    pub capability_cache: Arc<CapabilityCache>,
    pub service_registry: Arc<ServiceRegistry>,
}

/// Health check response
#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<crate::clients::capability::NegotiationStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry: Option<RegistrySnapshot>,
}

pub fn build_state(config: Config) -> Arc<AppState> {
    let lifecycle = Arc::new(lifecycle::LifecycleManager::new(
        lifecycle::LifecycleConfig {
            shutdown_drain_timeout: std::time::Duration::from_millis(
                config.stream.shutdown_drain_timeout_ms,
            ),
            shutdown_cleanup_timeout: std::time::Duration::from_millis(
                config.stream.shutdown_cleanup_timeout_ms,
            ),
        },
    ));

    Arc::new(AppState {
        degrade_policy: Arc::new(DegradePolicy::new(config.reliability.degrade.clone())),
        llm_provider: build_provider_router(&config)
            .expect("failed to build llm provider router from config"),
        retry_budget_policy: Arc::new(RetryBudgetPolicy::new(config.reliability.retry.clone())),
        memory_observe_policy: Arc::new(MemoryObservePolicy::new()),
        capability_cache: Arc::new(CapabilityCache::new(config.capabilities.clone())),
        service_registry: Arc::new(ServiceRegistry::new(config.registry.clone())),
        config,
        stream_registry: Arc::new(StreamRegistry::default()),
        lifecycle,
    })
}

pub async fn initialize_runtime(
    state: &Arc<AppState>,
    shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), AppError> {
    if state.service_registry.enabled() {
        if let Err(error) = state.service_registry.sync_once().await {
            warn!(
                error = %error,
                "initial capability service registry sync failed"
            );
        }
    }

    let memory_source = if state.service_registry.enabled() {
        match state
            .service_registry
            .resolve_ai_capability_service(ServiceKind::Memory)
            .await
        {
            Some(service) => MemoryCapabilitySource::Registry(service),
            None => {
                return Err(AppError::new(
                    crate::reliability::error::ErrorCode::DependencyFailed,
                    "memory service is not registered in capability service registry",
                ));
            }
        }
    } else {
        MemoryCapabilitySource::Grpc(state.config.memory.grpc_target.clone())
    };
    let tool_target = state
        .service_registry
        .resolve_grpc_target(ServiceKind::Tool, &state.config.tools.grpc_target)
        .await;
    let registry_tool_services = state.service_registry.resolve_ai_tool_services().await;
    let tool_source = if !registry_tool_services.is_empty() {
        ToolCapabilitySource::Registry(registry_tool_services)
    } else if state.config.tools.enabled {
        ToolCapabilitySource::Grpc(tool_target.clone())
    } else {
        ToolCapabilitySource::Disabled
    };

    if let Err(error) = state
        .capability_cache
        .initial_negotiation_mode_aware(
            &memory_source,
            &tool_source,
            &state.config.llm.adapter_grpc_target,
            state.config.llm.mode,
            &state.config.llm,
            Arc::clone(&state.llm_provider),
        )
        .await
    {
        if should_tolerate_startup_capability_error(state, &error) {
            warn!(
                error = %error,
                memory_source = %memory_source.describe(),
                tool_source = %tool_source.describe(),
                "memory/tool capability negotiation failed during startup; continuing in direct llm mode and relying on background refresh"
            );
        } else {
            return Err(error);
        }
    }

    state
        .service_registry
        .clone()
        .spawn_refresh_task(shutdown_rx.resubscribe());

    state.capability_cache.spawn_refresh_task_mode_aware(
        if state.service_registry.enabled() {
            Some(state.service_registry.clone())
        } else {
            None
        },
        memory_source,
        tool_source,
        state.config.llm.adapter_grpc_target.clone(),
        state.config.llm.mode,
        state.config.llm.clone(),
        Arc::clone(&state.llm_provider),
        shutdown_rx,
    );

    Ok(())
}

fn should_tolerate_startup_capability_error(state: &AppState, error: &AppError) -> bool {
    if state.config.llm.mode != LlmMode::Direct {
        return false;
    }

    matches!(
        error.upstream,
        Some(UpstreamService::Memory) | Some(UpstreamService::Tool)
    )
}

/// Create the main HTTP router
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/v1/ai/chat", post(api::chat))
        .route("/api/v1/ai/debug/{value}", get(api::debug_path_echo))
        .route("/api/v1/ai/sessions/{session_id}", get(api::session_exists))
        .route("/api/v1/ai/sessions/{session_id}", delete(api::delete_session))
        .route("/api/v1/ai/chat/stream", post(api::chat_stream))
        .route("/healthz", get(health_handler))
        .fallback(api::http_fallback)
        .with_state(state)
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(TraceLayer::new_for_http())
}

/// Create the metrics router
pub fn create_metrics_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/metrics", get(degrade_metrics_handler))
        .route("/metrics/degrade", get(degrade_metrics_handler))
        .with_state(state)
}

async fn health_handler(
    State(state): State<Arc<AppState>>,
) -> axum::Json<HealthResponse> {
    let capabilities = state.capability_cache.get_negotiation_status().await;
    let registry = state.service_registry.snapshot().await;
    axum::Json(HealthResponse {
        status: "ok",
        service: "koduck-ai",
        version: env!("CARGO_PKG_VERSION"),
        capabilities: Some(capabilities),
        registry: Some(registry),
    })
}

async fn degrade_metrics_handler(
    State(state): State<Arc<AppState>>,
) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "degrade": state.degrade_policy.snapshot(),
        "retry_budget": state.retry_budget_policy.snapshot(),
        "memory": state.memory_observe_policy.snapshot(),
        "capability": state.capability_cache.get_metrics_snapshot(),
        "registry": state.service_registry.snapshot().await,
    }))
}
