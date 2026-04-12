use std::net::SocketAddr;

use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tonic::transport::Server;
use tracing::{error, info};

use crate::api::{MemoryServiceServer, FILE_DESCRIPTOR_SET};
use crate::capability::MemoryGrpcService;
use crate::config::AppConfig;
use crate::observe;
use crate::store::RuntimeState;
use crate::Result;

pub async fn run(config: AppConfig) -> Result<()> {
    let grpc_addr: SocketAddr = config.server.grpc_addr.parse()?;
    let metrics_addr: SocketAddr = config.server.metrics_addr.parse()?;
    let runtime = RuntimeState::initialize(&config).await?;

    let grpc_service = MemoryGrpcService::new(config.clone(), runtime.clone());
    let reflection = tonic_reflection::server::Builder::configure()
        .register_encoded_file_descriptor_set(FILE_DESCRIPTOR_SET)
        .build()?;
    let (mut health_reporter, health_service) = tonic_health::server::health_reporter();
    health_reporter
        .set_serving::<MemoryServiceServer<MemoryGrpcService>>()
        .await;

    let metrics_listener = TcpListener::bind(metrics_addr).await?;
    let metrics_router = observe::build_metrics_router(config.clone(), runtime.clone());

    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let mut metrics_shutdown_rx = shutdown_tx.subscribe();
    let mut grpc_shutdown_rx = shutdown_tx.subscribe();

    info!("koduck-memory metrics endpoint listening on {}", metrics_addr);
    info!("koduck-memory gRPC server listening on {}", grpc_addr);
    info!(
        pool_size = runtime.pool().size(),
        pool_idle = runtime.pool().num_idle(),
        "koduck-memory postgres dependency is ready"
    );

    tokio::select! {
        result = axum::serve(metrics_listener, metrics_router).with_graceful_shutdown(async move {
            let _ = metrics_shutdown_rx.recv().await;
        }) => {
            if let Err(error) = result {
                error!(%error, "metrics server exited with error");
            }
        }
        result = Server::builder()
            .add_service(reflection)
            .add_service(health_service)
            .add_service(MemoryServiceServer::new(grpc_service))
            .serve_with_shutdown(grpc_addr, async move {
                let _ = grpc_shutdown_rx.recv().await;
            }) => {
            if let Err(error) = result {
                error!(%error, "gRPC server exited with error");
            }
        }
        result = tokio::signal::ctrl_c() => {
            match result {
                Ok(()) => info!("received Ctrl+C, shutting down koduck-memory"),
                Err(error) => error!(%error, "failed to listen for Ctrl+C"),
            }
        }
    }

    let _ = shutdown_tx.send(());
    info!("koduck-memory shutdown complete");
    Ok(())
}
