use axum::{http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde_json::json;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tracing_subscriber::EnvFilter;

use crate::config::AppConfig;
use crate::store::RuntimeState;
use crate::Result;

mod rpc_metrics;
pub use rpc_metrics::{RpcGuard, RpcMetrics};

/// Global counters for retry/failure metrics.
static TASK_RETRY_TOTAL: AtomicU64 = AtomicU64::new(0);
static TASK_FAILURE_TOTAL: AtomicU64 = AtomicU64::new(0);

const RPC_BUCKETS_MS: [u64; 8] = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

pub enum RpcMethod {
    GetSession,
    GetSessionTranscript,
    QueryMemory,
    AppendMemory,
}

pub enum RpcOutcome {
    Success,
    Error,
    NotFound,
}

struct RpcMetricSet {
    requests_total: AtomicU64,
    error_total: AtomicU64,
    not_found_total: AtomicU64,
    duration_ms_total: AtomicU64,
    le_50_ms: AtomicU64,
    le_100_ms: AtomicU64,
    le_250_ms: AtomicU64,
    le_500_ms: AtomicU64,
    le_1000_ms: AtomicU64,
    le_2500_ms: AtomicU64,
    le_5000_ms: AtomicU64,
    le_10000_ms: AtomicU64,
}

impl RpcMetricSet {
    const fn new() -> Self {
        Self {
            requests_total: AtomicU64::new(0),
            error_total: AtomicU64::new(0),
            not_found_total: AtomicU64::new(0),
            duration_ms_total: AtomicU64::new(0),
            le_50_ms: AtomicU64::new(0),
            le_100_ms: AtomicU64::new(0),
            le_250_ms: AtomicU64::new(0),
            le_500_ms: AtomicU64::new(0),
            le_1000_ms: AtomicU64::new(0),
            le_2500_ms: AtomicU64::new(0),
            le_5000_ms: AtomicU64::new(0),
            le_10000_ms: AtomicU64::new(0),
        }
    }

    fn record(&self, outcome: RpcOutcome, duration: Duration) {
        self.requests_total.fetch_add(1, Ordering::Relaxed);
        match outcome {
            RpcOutcome::Success => {}
            RpcOutcome::Error => {
                self.error_total.fetch_add(1, Ordering::Relaxed);
            }
            RpcOutcome::NotFound => {
                self.not_found_total.fetch_add(1, Ordering::Relaxed);
            }
        }

        let duration_ms = duration.as_millis() as u64;
        self.duration_ms_total
            .fetch_add(duration_ms, Ordering::Relaxed);

        if duration_ms <= 50 {
            self.le_50_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 100 {
            self.le_100_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 250 {
            self.le_250_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 500 {
            self.le_500_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 1000 {
            self.le_1000_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 2500 {
            self.le_2500_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 5000 {
            self.le_5000_ms.fetch_add(1, Ordering::Relaxed);
        }
        if duration_ms <= 10000 {
            self.le_10000_ms.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn snapshot(&self) -> RpcMetricSnapshot {
        let requests_total = self.requests_total.load(Ordering::Relaxed);
        let error_total = self.error_total.load(Ordering::Relaxed);
        let not_found_total = self.not_found_total.load(Ordering::Relaxed);

        RpcMetricSnapshot {
            requests_total,
            success_total: requests_total.saturating_sub(error_total + not_found_total),
            error_total,
            not_found_total,
            duration_ms_total: self.duration_ms_total.load(Ordering::Relaxed),
            buckets: [
                self.le_50_ms.load(Ordering::Relaxed),
                self.le_100_ms.load(Ordering::Relaxed),
                self.le_250_ms.load(Ordering::Relaxed),
                self.le_500_ms.load(Ordering::Relaxed),
                self.le_1000_ms.load(Ordering::Relaxed),
                self.le_2500_ms.load(Ordering::Relaxed),
                self.le_5000_ms.load(Ordering::Relaxed),
                self.le_10000_ms.load(Ordering::Relaxed),
            ],
        }
    }
}

struct RpcMetricSnapshot {
    requests_total: u64,
    success_total: u64,
    error_total: u64,
    not_found_total: u64,
    duration_ms_total: u64,
    buckets: [u64; 8],
}

static GET_SESSION_RPC: RpcMetricSet = RpcMetricSet::new();
static GET_SESSION_TRANSCRIPT_RPC: RpcMetricSet = RpcMetricSet::new();
static QUERY_MEMORY_RPC: RpcMetricSet = RpcMetricSet::new();
static APPEND_MEMORY_RPC: RpcMetricSet = RpcMetricSet::new();

/// Increment the retry counter (called from the reliability module).
pub fn inc_retry_counter() {
    TASK_RETRY_TOTAL.fetch_add(1, Ordering::Relaxed);
}

/// Increment the failure counter (called from the reliability module).
pub fn inc_failure_counter() {
    TASK_FAILURE_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn record_rpc_call(method: RpcMethod, outcome: RpcOutcome, duration: Duration) {
    let metrics = match method {
        RpcMethod::GetSession => &GET_SESSION_RPC,
        RpcMethod::GetSessionTranscript => &GET_SESSION_TRANSCRIPT_RPC,
        RpcMethod::QueryMemory => &QUERY_MEMORY_RPC,
        RpcMethod::AppendMemory => &APPEND_MEMORY_RPC,
    };
    metrics.record(outcome, duration);
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
    _rpc_metrics: Arc<RpcMetrics>,
) -> impl IntoResponse {
    let snapshot = runtime.snapshot().await;
    let retry_total = TASK_RETRY_TOTAL.load(Ordering::Relaxed);
    let failure_total = TASK_FAILURE_TOTAL.load(Ordering::Relaxed);
    let get_session = GET_SESSION_RPC.snapshot();
    let get_session_transcript = GET_SESSION_TRANSCRIPT_RPC.snapshot();
    let query_memory = QUERY_MEMORY_RPC.snapshot();
    let append_memory = APPEND_MEMORY_RPC.snapshot();
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
         # HELP koduck_memory_rpc_requests_total Total RPC requests by method and outcome.\n\
         # TYPE koduck_memory_rpc_requests_total counter\n\
         koduck_memory_rpc_requests_total{{method=\"GetSession\",outcome=\"success\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"GetSession\",outcome=\"error\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"GetSession\",outcome=\"not_found\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"GetSessionTranscript\",outcome=\"success\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"GetSessionTranscript\",outcome=\"error\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"GetSessionTranscript\",outcome=\"not_found\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"QueryMemory\",outcome=\"success\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"QueryMemory\",outcome=\"error\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"QueryMemory\",outcome=\"not_found\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"AppendMemory\",outcome=\"success\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"AppendMemory\",outcome=\"error\"}} {}\n\
         koduck_memory_rpc_requests_total{{method=\"AppendMemory\",outcome=\"not_found\"}} {}\n\
         # HELP koduck_memory_rpc_errors_total Total RPC errors by method.\n\
         # TYPE koduck_memory_rpc_errors_total counter\n\
         koduck_memory_rpc_errors_total{{method=\"GetSession\"}} {}\n\
         koduck_memory_rpc_errors_total{{method=\"GetSessionTranscript\"}} {}\n\
         koduck_memory_rpc_errors_total{{method=\"QueryMemory\"}} {}\n\
         koduck_memory_rpc_errors_total{{method=\"AppendMemory\"}} {}\n\
         # HELP koduck_memory_rpc_duration_ms RPC latency histogram in milliseconds.\n\
         # TYPE koduck_memory_rpc_duration_ms histogram\n\
         {}{}{}{}\
         # HELP koduck_memory_rpc_latency_slo_ms Target latency SLO in milliseconds.\n\
         # TYPE koduck_memory_rpc_latency_slo_ms gauge\n\
         koduck_memory_rpc_latency_slo_ms{{method=\"GetSession\"}} 200\n\
         koduck_memory_rpc_latency_slo_ms{{method=\"GetSessionTranscript\"}} 800\n\
         koduck_memory_rpc_latency_slo_ms{{method=\"QueryMemory\"}} 1000\n\
         koduck_memory_rpc_latency_slo_ms{{method=\"AppendMemory\"}} 1500\n\
         # HELP koduck_memory_rpc_error_budget_ratio Target per-method error budget ratio.\n\
         # TYPE koduck_memory_rpc_error_budget_ratio gauge\n\
         koduck_memory_rpc_error_budget_ratio{{method=\"GetSession\"}} 0.005\n\
         koduck_memory_rpc_error_budget_ratio{{method=\"GetSessionTranscript\"}} 0.01\n\
         koduck_memory_rpc_error_budget_ratio{{method=\"QueryMemory\"}} 0.01\n\
         koduck_memory_rpc_error_budget_ratio{{method=\"AppendMemory\"}} 0.01\n",
        config.app.name,
        config.app.version,
        config.app.env,
        if snapshot.ready { 1 } else { 0 },
        if snapshot.postgres_up { 1 } else { 0 },
        snapshot.pool_size,
        snapshot.pool_idle,
        retry_total,
        failure_total,
        get_session.success_total,
        get_session.error_total,
        get_session.not_found_total,
        get_session_transcript.success_total,
        get_session_transcript.error_total,
        get_session_transcript.not_found_total,
        query_memory.success_total,
        query_memory.error_total,
        query_memory.not_found_total,
        append_memory.success_total,
        append_memory.error_total,
        append_memory.not_found_total,
        get_session.error_total,
        get_session_transcript.error_total,
        query_memory.error_total,
        append_memory.error_total,
        render_rpc_histogram("GetSession", &get_session),
        render_rpc_histogram("GetSessionTranscript", &get_session_transcript),
        render_rpc_histogram("QueryMemory", &query_memory),
        render_rpc_histogram("AppendMemory", &append_memory),
    );
    (StatusCode::OK, body)
}

fn render_rpc_histogram(method: &str, snapshot: &RpcMetricSnapshot) -> String {
    let mut body = String::new();
    for (bucket, count) in RPC_BUCKETS_MS.iter().zip(snapshot.buckets.iter()) {
        body.push_str(&format!(
            "koduck_memory_rpc_duration_ms_bucket{{method=\"{}\",le=\"{}\"}} {}\n",
            method, bucket, count
        ));
    }
    body.push_str(&format!(
        "koduck_memory_rpc_duration_ms_bucket{{method=\"{}\",le=\"+Inf\"}} {}\n",
        method, snapshot.requests_total
    ));
    body.push_str(&format!(
        "koduck_memory_rpc_duration_ms_sum{{method=\"{}\"}} {}\n",
        method, snapshot.duration_ms_total
    ));
    body.push_str(&format!(
        "koduck_memory_rpc_duration_ms_count{{method=\"{}\"}} {}\n",
        method, snapshot.requests_total
    ));
    body
}
