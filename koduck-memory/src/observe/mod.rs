use axum::{http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::store::RuntimeState;
use crate::Result;

mod rpc_metrics;
pub use rpc_metrics::{RpcGuard, RpcMetrics};

/// Global counters for retry/failure metrics.
static TASK_RETRY_TOTAL: AtomicU64 = AtomicU64::new(0);
static TASK_FAILURE_TOTAL: AtomicU64 = AtomicU64::new(0);

/// Increment the retry counter (called from the reliability module).
pub fn inc_retry_counter() {
    TASK_RETRY_TOTAL.fetch_add(1, Ordering::Relaxed);
}

/// Increment the failure counter (called from the reliability module).
pub fn inc_failure_counter() {
    TASK_FAILURE_TOTAL.fetch_add(1, Ordering::Relaxed);
}

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

pub fn build_metrics_router(
    config: AppConfig,
    runtime: RuntimeState,
    rpc_metrics: Arc<RpcMetrics>,
) -> Router {
    let metrics_config = config.clone();
    let ready_config = config.clone();
    let health_config = config.clone();
    let live_config = config;
    let metrics_runtime = runtime.clone();
    let ready_runtime = runtime.clone();
    let health_runtime = runtime.clone();

    Router::new()
        .route(
            "/livez",
            get(move || {
                let live_config = live_config.clone();
                async move { live_handler(live_config).await }
            }),
        )
        .route(
            "/readyz",
            get(move || {
                let ready_config = ready_config.clone();
                let ready_runtime = ready_runtime.clone();
                async move { ready_handler(ready_config, ready_runtime).await }
            }),
        )
        .route(
            "/healthz",
            get(move || {
                let health_config = health_config.clone();
                let health_runtime = health_runtime.clone();
                async move { health_handler(health_config, health_runtime).await }
            }),
        )
        .route(
            "/metrics",
            get(move || {
                let metrics_config = metrics_config.clone();
                let metrics_runtime = metrics_runtime.clone();
                let rpc_metrics = rpc_metrics.clone();
                async move { metrics_handler(metrics_config, metrics_runtime, rpc_metrics).await }
            }),
        )
}

async fn live_handler(config: AppConfig) -> impl IntoResponse {
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

async fn ready_handler(config: AppConfig, runtime: RuntimeState) -> impl IntoResponse {
    let snapshot = runtime.snapshot().await;
    let status_code = if snapshot.ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status_code,
        Json(json!({
            "status": if snapshot.ready { "ready" } else { "not_ready" },
            "service": config.app.name,
            "environment": config.app.env,
            "postgres_up": snapshot.postgres_up,
            "last_error": snapshot.last_error,
        })),
    )
}

async fn health_handler(config: AppConfig, runtime: RuntimeState) -> impl IntoResponse {
    ready_handler(config, runtime).await
}

async fn metrics_handler(
    config: AppConfig,
    runtime: RuntimeState,
    rpc_metrics: Arc<RpcMetrics>,
) -> impl IntoResponse {
    let snapshot = runtime.snapshot().await;
    let retry_total = TASK_RETRY_TOTAL.load(Ordering::Relaxed);
    let failure_total = TASK_FAILURE_TOTAL.load(Ordering::Relaxed);
    let rpc_output = rpc_metrics.render();
    let body = format!(
        "# HELP koduck_memory_build_info Static build information.\n\
         # TYPE koduck_memory_build_info gauge\n\
         koduck_memory_build_info{{service=\"{}\",version=\"{}\",environment=\"{}\"}} 1\n\
         # HELP koduck_memory_up Process availability flag.\n\
         # TYPE koduck_memory_up gauge\n\
         koduck_memory_up 1\n\
         # HELP koduck_memory_readiness Service readiness including dependency state.\n\
         # TYPE koduck_memory_readiness gauge\n\
         koduck_memory_readiness {} \n\
         # HELP koduck_memory_postgres_up PostgreSQL dependency availability.\n\
         # TYPE koduck_memory_postgres_up gauge\n\
         koduck_memory_postgres_up {} \n\
         # HELP koduck_memory_postgres_pool_size Active size of the postgres pool.\n\
         # TYPE koduck_memory_postgres_pool_size gauge\n\
         koduck_memory_postgres_pool_size {} \n\
         # HELP koduck_memory_postgres_pool_idle Idle connections in the postgres pool.\n\
         # TYPE koduck_memory_postgres_pool_idle gauge\n\
         koduck_memory_postgres_pool_idle {} \n\
         # HELP koduck_memory_task_retry_total Total number of task retry attempts.\n\
         # TYPE koduck_memory_task_retry_total counter\n\
         koduck_memory_task_retry_total {} \n\
         # HELP koduck_memory_task_failure_total Total number of tasks that failed after all retries.\n\
         # TYPE koduck_memory_task_failure_total counter\n\
         koduck_memory_task_failure_total {} \n\
         {}\n",
        config.app.name,
        config.app.version,
        config.app.env,
        if snapshot.ready { 1 } else { 0 },
        if snapshot.postgres_up { 1 } else { 0 },
        snapshot.pool_size,
        snapshot.pool_idle,
        retry_total,
        failure_total,
        rpc_output,
    );
    (StatusCode::OK, body)
}
