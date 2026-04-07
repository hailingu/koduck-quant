use std::net::SocketAddr;

use tokio::net::TcpListener;
use tonic::transport::Server as TonicServer;
use tracing::{error, info};

use koduck_auth::{
    config::Config,
    grpc,
    http::create_router,
    init_state,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting koduck-auth service...");

    // 加载配置
    let config = Config::from_env()?;
    
    // 创建应用状态
    let state = init_state(config).await?;

    // 创建 HTTP 服务
    let http_addr: SocketAddr = state.config().server.http_addr.parse()?;
    let http_listener = TcpListener::bind(http_addr).await?;
    let http_app = create_router(state.clone());

    // 创建 gRPC 服务
    let grpc_addr: SocketAddr = state.config().server.grpc_addr.parse()?;
    let grpc_service = grpc::create_server(state.clone());

    info!("HTTP server listening on {}", http_addr);
    info!("gRPC server listening on {}", grpc_addr);

    // 同时运行 HTTP 和 gRPC 服务
    tokio::select! {
        result = axum::serve(http_listener, http_app) => {
            if let Err(e) = result {
                error!("HTTP server error: {}", e);
            }
        }
        result = TonicServer::builder()
            .add_service(grpc_service)
            .serve(grpc_addr) => {
            if let Err(e) = result {
                error!("gRPC server error: {}", e);
            }
        }
    }

    info!("Shutting down koduck-auth service...");
    Ok(())
}
