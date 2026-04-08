//! Health check handlers

use axum::{
    extract::State,
    response::Json,
    http::StatusCode,
};
use serde::Serialize;
use std::sync::Arc;
use tokio::time::{timeout, Duration};
use tracing::{debug, warn};

use crate::state::AppState;

/// Simple health check
pub async fn health_check() -> &'static str {
    "ok"
}

/// Actuator health response
#[derive(Serialize)]
pub struct ActuatorHealthResponse {
    pub status: String,
}

/// Spring Boot actuator compatible health check
pub async fn actuator_health() -> Json<ActuatorHealthResponse> {
    Json(ActuatorHealthResponse {
        status: "UP".to_string(),
    })
}

/// Kubernetes liveness probe
pub async fn liveness() -> StatusCode {
    StatusCode::OK
}

/// Kubernetes readiness probe
/// Checks Redis connectivity to ensure service can handle requests
pub async fn readiness(State(state): State<Arc<AppState>>) -> StatusCode {
    // Check Redis connectivity with timeout
    match timeout(Duration::from_secs(2), state.redis_cache().ping()).await {
        Ok(Ok(())) => {
            debug!("Redis health check passed");
            StatusCode::OK
        }
        Ok(Err(e)) => {
            warn!("Redis health check failed: {}", e);
            StatusCode::SERVICE_UNAVAILABLE
        }
        Err(_) => {
            warn!("Redis health check timed out");
            StatusCode::SERVICE_UNAVAILABLE
        }
    }
}
