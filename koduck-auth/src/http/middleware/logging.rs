//! Logging middleware

use axum::extract::Request;
use std::time::Instant;
use tracing::info;

/// Log request middleware
pub async fn log_request(req: Request, next: axum::middleware::Next) -> axum::response::Response {
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
