use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use koduck_auth::{
    config::Config,
    crypto::load_public_key,
    grpc::create_and_run_grpc_server_with_shutdown,
    http::{create_metrics_router, create_router},
    init_state,
    jwt::{JwksService, JwtValidator},
    repository::{AuditLogRepository, PasswordResetRepository, RedisCache, RefreshTokenRepository, UserRepository},
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured JSON logging for container/k8s environments.
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,koduck_auth=info,tower_http=warn"));
    tracing_subscriber::fmt()
        .json()
        .with_ansi(false)
        .with_current_span(false)
        .with_span_list(false)
        .with_env_filter(env_filter)
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
    let password_reset_repo = PasswordResetRepository::new(state.db_pool().clone());
    let audit_log_repo = AuditLogRepository::new(state.db_pool().clone());
    let redis = RedisCache::new(state.redis_pool().clone());

    // Load public key for JWT validation and JWKS
    let public_key = load_public_key(&config.jwt.public_key_path).await?;

    // Create JWT validator for token introspection
    let jwt_validator = JwtValidator::new(
        &public_key,
        config.jwt.audience.clone(),
        config.jwt.issuer.clone(),
    )?;

    // Create JWKS service
    let jwks_service = JwksService::new(&public_key, config.jwt.key_id.clone())?;

    // Create services
    let auth_service_impl = AuthServiceImpl::new(
        user_repo.clone(),
        token_repo.clone(),
        password_reset_repo,
        audit_log_repo,
        redis.clone(),
        state.jwt_service().clone(),
        state.db_pool().clone(),
        config.clone(),
    )?;
    let token_service_impl = TokenServiceImpl::new(token_repo, redis, jwt_validator);

    // Clone jwt_service for token service
    let jwt_service_for_token = state.jwt_service().clone();

    // Create HTTP service
    let http_addr: SocketAddr = config.server.http_addr.parse()?;
    let http_listener = TcpListener::bind(http_addr).await?;
    let http_app = create_router(state);
    let metrics_addr: SocketAddr = config.server.metrics_addr.parse()?;
    let metrics_listener = TcpListener::bind(metrics_addr).await?;
    let metrics_app = create_metrics_router();

    // Parse gRPC address
    let grpc_addr: SocketAddr = config.server.grpc_addr.parse()?;

    info!("HTTP server listening on {}", http_addr);
    info!("Metrics server listening on {}", metrics_addr);
    info!("gRPC server listening on {}", grpc_addr);

    let (shutdown_tx, _) = broadcast::channel::<()>(1);
    let mut http_shutdown_rx = shutdown_tx.subscribe();
    let mut metrics_shutdown_rx = shutdown_tx.subscribe();
    let mut grpc_shutdown_rx = shutdown_tx.subscribe();

    // Run HTTP + metrics + gRPC services concurrently
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
        result = create_and_run_grpc_server_with_shutdown(
            grpc_addr,
            auth_service_impl,
            token_service_impl,
            user_repo,
            jwks_service,
            jwt_service_for_token,
            async move {
                let _ = grpc_shutdown_rx.recv().await;
            },
        ) => {
            if let Err(e) = result {
                error!("gRPC server error: {}", e);
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
    info!("Shutting down koduck-auth service...");
    Ok(())
}
