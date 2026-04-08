//! HTTP routes configuration

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
    ServiceBuilderExt,
};

use crate::{
    http::handler::{auth, health, jwks, metrics as metrics_handler},
    state::AppState,
};

/// Create HTTP router
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        // Auth endpoints
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/refresh", post(auth::refresh_token))
        .route("/api/v1/auth/logout", post(auth::logout))
        .route("/api/v1/auth/security-config", get(auth::security_config))
        .route("/api/v1/auth/forgot-password", post(auth::forgot_password))
        .route("/api/v1/auth/reset-password", post(auth::reset_password))
        // JWKS endpoint
        .route("/.well-known/jwks.json", get(jwks::get_jwks))
        // Health endpoints
        .route("/health", get(health::health_check))
        .route("/actuator/health", get(health::actuator_health))
        .route("/actuator/health/liveness", get(health::liveness))
        .route("/actuator/health/readiness", get(health::readiness))
        // Metrics endpoint
        .route("/metrics", get(metrics_handler::handler))
        // Middleware (applied in reverse order - last added is first executed)
        .layer(
            ServiceBuilder::new()
                // Generate UUID request_id for each request
                .set_x_request_id(MakeRequestUuid)
                // Propagate request_id to X-Request-Id response header
                .layer(PropagateRequestIdLayer::x_request_id())
                .layer(TraceLayer::new_for_http())
                .layer(CompressionLayer::new())
                .layer(CorsLayer::permissive()),
        )
        .with_state(state)
}
