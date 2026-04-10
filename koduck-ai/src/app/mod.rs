//! Application startup and lifecycle management

use axum::{routing::get, Router};

/// Health check response
#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
}

/// Create the main HTTP router
pub fn create_router() -> Router {
    Router::new()
        .route("/healthz", get(health_handler))
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
