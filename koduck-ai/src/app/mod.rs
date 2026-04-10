//! Application startup and lifecycle management

use std::sync::Arc;

use axum::{routing::{get, post}, Router};
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;

use crate::api;
use crate::config::Config;
use crate::stream::sse::StreamRegistry;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub stream_registry: Arc<StreamRegistry>,
}

/// Health check response
#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
}

/// Create the main HTTP router
pub fn create_router(config: Config) -> Router {
    let state = Arc::new(AppState {
        config,
        stream_registry: Arc::new(StreamRegistry::default()),
    });
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
pub fn create_metrics_router() -> Router {
    Router::new()
}

async fn health_handler() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        service: "koduck-ai",
        version: env!("CARGO_PKG_VERSION"),
    })
}
