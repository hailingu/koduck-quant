use axum::{http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde_json::json;
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::Result;

pub fn init_tracing() -> Result<()> {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,koduck_memory=info,tower_http=warn"));

    tracing_subscriber::fmt()
        .json()
        .with_ansi(false)
        .with_current_span(false)
        .with_span_list(false)
        .with_env_filter(env_filter)
        .try_init()
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

    Ok(())
}

pub fn build_metrics_router(config: AppConfig) -> Router {
    let metrics_config = config.clone();
    let health_config = config;

    Router::new()
        .route(
            "/healthz",
            get(move || {
                let health_config = health_config.clone();
                async move { health_handler(health_config).await }
            }),
        )
        .route(
            "/metrics",
            get(move || {
                let metrics_config = metrics_config.clone();
                async move { metrics_handler(metrics_config).await }
            }),
        )
}

async fn health_handler(config: AppConfig) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "service": config.app.name,
            "environment": config.app.env,
            "version": config.app.version,
        })),
    )
}

async fn metrics_handler(config: AppConfig) -> impl IntoResponse {
    let body = format!(
        "# HELP koduck_memory_build_info Static build information.\n\
         # TYPE koduck_memory_build_info gauge\n\
         koduck_memory_build_info{{service=\"{}\",version=\"{}\",environment=\"{}\"}} 1\n\
         # HELP koduck_memory_up Process availability flag.\n\
         # TYPE koduck_memory_up gauge\n\
         koduck_memory_up 1\n",
        config.app.name, config.app.version, config.app.env
    );
    (StatusCode::OK, body)
}
