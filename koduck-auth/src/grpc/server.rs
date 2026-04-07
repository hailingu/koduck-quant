//! gRPC server setup

use crate::{
    grpc::{
        auth_service::GrpcAuthService,
        proto::{auth_service_server::AuthServiceServer, token_service_server::TokenServiceServer},
        token_service::GrpcTokenService,
    },
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};
use std::net::SocketAddr;
use tonic::transport::Server;
use tracing::{error, info};

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
    ) -> Self {
        let auth_service = GrpcAuthService::new(auth_service_impl, token_service_impl.clone());
        let token_service = GrpcTokenService::new(token_service_impl);

        Self {
            addr,
            auth_service,
            token_service,
        }
    }

    /// Run the gRPC server
    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Starting gRPC server on {}", self.addr);

        Server::builder()
            .add_service(AuthServiceServer::new(self.auth_service))
            .add_service(TokenServiceServer::new(self.token_service))
            .serve(self.addr)
            .await?;

        Ok(())
    }
}

/// Create and run gRPC server
pub async fn create_and_run_grpc_server(
    addr: SocketAddr,
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
) -> Result<(), Box<dyn std::error::Error>> {
    let server = GrpcServer::new(addr, auth_service, token_service);
    server.run().await
}

/// Create gRPC services for composition into main server
pub fn create_grpc_services(
    auth_service_impl: AuthServiceImpl,
    token_service_impl: TokenServiceImpl,
) -> (AuthServiceServer<GrpcAuthService>, TokenServiceServer<GrpcTokenService>) {
    let auth_service = GrpcAuthService::new(auth_service_impl, token_service_impl.clone());
    let token_service = GrpcTokenService::new(token_service_impl);

    (
        AuthServiceServer::new(auth_service),
        TokenServiceServer::new(token_service),
    )
}
