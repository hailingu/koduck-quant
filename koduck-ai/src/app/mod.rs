//! Application startup and lifecycle management

use std::sync::Arc;

use axum::{
    extract::State,
    routing::{get, post},
    Router,
};
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;

use crate::api;
use crate::config::Config;
use crate::reliability::degrade::DegradePolicy;
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
}

/// Health check response
#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
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
        retry_budget_policy: Arc::new(RetryBudgetPolicy::new(config.reliability.retry.clone())),
        config,
        stream_registry: Arc::new(StreamRegistry::default()),
        lifecycle,
    })
}

/// Create the main HTTP router
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/v1/ai/chat", post(api::chat))
        .route("/api/v1/ai/stream", post(api::chat_stream))
        .route("/api/v1/ai/chat/stream", post(api::chat_stream))
        .route("/healthz", get(health_handler))
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

async fn health_handler() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "koduck-ai",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn degrade_metrics_handler(
    State(state): State<Arc<AppState>>,
) -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "degrade": state.degrade_policy.snapshot(),
        "retry_budget": state.retry_budget_policy.snapshot(),
    }))
}
