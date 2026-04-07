//! Health check handlers

use axum::{
    extract::State,
    response::Json,
    http::StatusCode,
};
use serde::Serialize;
use std::sync::Arc;

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
pub async fn readiness(State(_state): State<Arc<AppState>>) -> StatusCode {
    // TODO: Check database and Redis connectivity
    StatusCode::OK
}
