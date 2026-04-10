use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use koduck_ai::app;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured JSON logging for container/k8s environments.
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,koduck_ai=info,tower_http=warn"));
    tracing_subscriber::fmt()
        .json()
        .with_ansi(false)
        .with_current_span(false)
        .with_span_list(false)
        .with_env_filter(env_filter)
        .init();

    let env = std::env::var("APP_ENV").unwrap_or_else(|_| "dev".to_string());

    info!(
        version = VERSION,
        env = %env,
        "Starting koduck-ai service"
    );

    // Load configuration (fails fast on validation errors)
    let config = koduck_ai::config::Config::from_env()?;

    info!(config = %config, "Configuration loaded");

    // Create HTTP server
    let http_addr: SocketAddr = config.server.http_addr.parse()?;
    let http_listener = TcpListener::bind(http_addr).await?;
    let http_app = app::create_router(config.clone());

    // Create metrics server
    let metrics_addr: SocketAddr = config.server.metrics_addr.parse()?;
    let metrics_listener = TcpListener::bind(metrics_addr).await?;
    let metrics_app = app::create_metrics_router();

    info!(
        http_addr = %http_addr,
        metrics_addr = %metrics_addr,
        grpc_addr = %config.server.grpc_addr,
        "Servers listening"
    );

    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let mut http_shutdown_rx = shutdown_tx.subscribe();
    let mut metrics_shutdown_rx = shutdown_tx.subscribe();

    // Run HTTP + metrics services concurrently
    tokio::select! {
        result = axum::serve(
            http_listener,
            http_app.into_make_service_with_connect_info::<SocketAddr>(),
        ).with_graceful_shutdown(async move {
            let _ = http_shutdown_rx.recv().await;
        }) => {
            if let Err(e) = result {
                error!("HTTP server error: {}", e);
            }
        }
        result = axum::serve(metrics_listener, metrics_app).with_graceful_shutdown(async move {
            let _ = metrics_shutdown_rx.recv().await;
        }) => {
            if let Err(e) = result {
                error!("Metrics server error: {}", e);
            }
        }
        result = tokio::signal::ctrl_c() => {
            match result {
                Ok(()) => info!("Received Ctrl+C, shutting down all services..."),
                Err(e) => error!("Failed to listen for Ctrl+C: {}", e),
            }
        }
    }

    let _ = shutdown_tx.send(());
    info!("Shutting down koduck-ai service...");
    Ok(())
}
