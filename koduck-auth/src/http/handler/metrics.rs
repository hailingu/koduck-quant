//! Metrics handler

use axum::response::Response;
use axum::body::Body;

/// Prometheus metrics handler
pub async fn handler() -> Response<Body> {
    // TODO: Return Prometheus metrics
    Response::builder()
        .body(Body::from("# Metrics not yet implemented"))
        .unwrap()
}
