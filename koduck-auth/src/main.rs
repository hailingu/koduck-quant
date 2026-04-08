use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::TcpListener;
use tracing::{error, info};

use koduck_auth::{
    config::Config,
    grpc::create_grpc_services,
    http::create_router,
    init_state,
    repository::{RedisCache, RefreshTokenRepository, UserRepository},
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting koduck-auth service...");

    // Load configuration
    let config = Config::from_env()?;
    let config = Arc::new(config);

    // Create application state
    let state = init_state((*config).clone()).await?;

    // Create repositories
    let user_repo = UserRepository::new(state.db_pool().clone());
    let token_repo = RefreshTokenRepository::new(state.db_pool().clone());
    let redis = RedisCache::new(state.redis_pool().clone());

    // Create services
    let auth_service_impl = AuthServiceImpl::new(
        user_repo.clone(),
        token_repo.clone(),
        redis.clone(),
        state.db_pool().clone(),
        config.clone(),
    );
    let token_service_impl = TokenServiceImpl::new(token_repo, redis);

    // Create HTTP service
    let http_addr: SocketAddr = config.server.http_addr.parse()?;
    let http_listener = TcpListener::bind(http_addr).await?;
    let http_app = create_router(state);

    // Create gRPC services
    let grpc_addr: SocketAddr = config.server.grpc_addr.parse()?;
    let (auth_grpc_service, token_grpc_service) = create_grpc_services(auth_service_impl, token_service_impl);

    info!("HTTP server listening on {}", http_addr);
    info!("gRPC server listening on {}", grpc_addr);

    // Run both HTTP and gRPC services concurrently
    tokio::select! {
        result = axum::serve(http_listener, http_app) => {
            if let Err(e) = result {
                error!("HTTP server error: {}", e);
            }
        }
        result = tonic::transport::Server::builder()
            .add_service(auth_grpc_service)
            .add_service(token_grpc_service)
            .serve(grpc_addr) => {
            if let Err(e) = result {
                error!("gRPC server error: {}", e);
            }
        }
    }

    info!("Shutting down koduck-auth service...");
    Ok(())
}
