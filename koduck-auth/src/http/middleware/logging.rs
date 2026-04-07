//! Logging middleware

use axum::http::Request;
use std::time::Instant;
use tracing::info;

/// Log request middleware
pub async fn log_request<B>(req: Request<B>, next: axum::middleware::Next<B>) -> axum::response::Response {
    let start = Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    
    let response = next.run(req).await;
    
    let duration = start.elapsed();
    let status = response.status();
    
    info!(
        method = %method,
        uri = %uri,
        status = %status,
        duration_ms = %duration.as_millis(),
        "Request completed"
    );
    
    response
}
