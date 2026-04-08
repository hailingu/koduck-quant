//! Logging middleware

use axum::extract::Request;
use std::net::SocketAddr;
use std::time::Instant;
use tracing::info;

/// Log request middleware
pub async fn log_request(req: Request, next: axum::middleware::Next) -> axum::response::Response {
    let start = Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("-")
        .to_string();
    let ip = req
        .extensions()
        .get::<SocketAddr>()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "-".to_string());
    
    let response = next.run(req).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    info!(
        request_id = %request_id,
        ip = %ip,
        method = %method,
        path = %uri.path(),
        uri = %uri,
        status = %status,
        duration_ms = %duration.as_millis(),
        "Request completed"
    );
    
    response
}
