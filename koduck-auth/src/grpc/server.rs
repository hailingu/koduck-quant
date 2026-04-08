//! gRPC server setup

use crate::{
    grpc::{
        auth_service::GrpcAuthService,
        proto::{auth_service_server::AuthServiceServer, token_service_server::TokenServiceServer, FILE_DESCRIPTOR_SET},
        token_service::GrpcTokenService,
    },
    jwt::JwksService,
    jwt::JwtService,
    repository::UserRepository,
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};
use std::net::SocketAddr;
use std::future::Future;
use tonic::transport::Server;
use tonic_health::server::health_reporter;
use tracing::info;

/// gRPC server configuration
pub struct GrpcServer {
    addr: SocketAddr,
    auth_service: GrpcAuthService,
    token_service: GrpcTokenService,
}

impl GrpcServer {
    /// Create new gRPC server
    pub fn new(
        addr: SocketAddr,
        auth_service_impl: AuthServiceImpl,
        token_service_impl: TokenServiceImpl,
        user_repo: UserRepository,
        jwks_service: JwksService,
        jwt_service: JwtService,
    ) -> Self {
        let auth_service = GrpcAuthService::new(
            auth_service_impl.clone(),
            token_service_impl.clone(),
            user_repo,
            jwks_service,
        );
        let token_service = GrpcTokenService::new(
            token_service_impl,
            auth_service_impl,
            jwt_service,
        );

        Self {
            addr,
            auth_service,
            token_service,
        }
    }

    /// Run the gRPC server
    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Starting gRPC server on {}", self.addr);

        let (mut health_reporter, health_service) = health_reporter();
        health_reporter
            .set_serving::<AuthServiceServer<GrpcAuthService>>()
            .await;
        health_reporter
            .set_serving::<TokenServiceServer<GrpcTokenService>>()
            .await;

        // Create gRPC reflection service
        let reflection_service = tonic_reflection::server::Builder::configure()
            .register_encoded_file_descriptor_set(FILE_DESCRIPTOR_SET)
            .build()?;

        Server::builder()
            .add_service(health_service)
            .add_service(reflection_service)
            .add_service(AuthServiceServer::new(self.auth_service))
            .add_service(TokenServiceServer::new(self.token_service))
            .serve(self.addr)
            .await?;

        Ok(())
    }

    /// Run the gRPC server with graceful shutdown signal
    pub async fn run_with_shutdown<F>(self, shutdown: F) -> Result<(), Box<dyn std::error::Error>>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        info!("Starting gRPC server on {} (with graceful shutdown)", self.addr);

        let (mut health_reporter, health_service) = health_reporter();
        health_reporter
            .set_serving::<AuthServiceServer<GrpcAuthService>>()
            .await;
        health_reporter
            .set_serving::<TokenServiceServer<GrpcTokenService>>()
            .await;

        let reflection_service = tonic_reflection::server::Builder::configure()
            .register_encoded_file_descriptor_set(FILE_DESCRIPTOR_SET)
            .build()?;

        Server::builder()
            .add_service(health_service)
            .add_service(reflection_service)
            .add_service(AuthServiceServer::new(self.auth_service))
            .add_service(TokenServiceServer::new(self.token_service))
            .serve_with_shutdown(self.addr, shutdown)
            .await?;

        Ok(())
    }
}

/// Create and run gRPC server
pub async fn create_and_run_grpc_server(
    addr: SocketAddr,
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
    user_repo: UserRepository,
    jwks_service: JwksService,
    jwt_service: JwtService,
) -> Result<(), Box<dyn std::error::Error>> {
    let server = GrpcServer::new(addr, auth_service, token_service, user_repo, jwks_service, jwt_service);
    server.run().await
}

/// Create and run gRPC server with graceful shutdown signal.
pub async fn create_and_run_grpc_server_with_shutdown<F>(
    addr: SocketAddr,
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
    user_repo: UserRepository,
    jwks_service: JwksService,
    jwt_service: JwtService,
    shutdown: F,
) -> Result<(), Box<dyn std::error::Error>>
where
    F: Future<Output = ()> + Send + 'static,
{
    let server = GrpcServer::new(addr, auth_service, token_service, user_repo, jwks_service, jwt_service);
    server.run_with_shutdown(shutdown).await
}
