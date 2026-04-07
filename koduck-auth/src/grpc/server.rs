//! gRPC server setup

use std::sync::Arc;
use tonic::{Request, Response, Status};

use crate::state::AppState;

use super::{
    auth_service::AuthServiceImpl,
    proto::{
        auth_service_server::{AuthService, AuthServiceServer},
        GetUserRequest, GetUserResponse, GetUserRolesRequest, GetUserRolesResponse,
        HealthCheckResponse, JwksResponse, RevokeTokenRequest, SecurityConfigResponse,
        ValidateCredentialsRequest, ValidateCredentialsResponse, ValidateTokenRequest,
        ValidateTokenResponse, LogoutRequest,
    },
};

/// Create gRPC server
pub fn create_server(state: Arc<AppState>) -> AuthServiceServer<AuthServiceImpl> {
    let _ = state;
    AuthServiceServer::new(AuthServiceImpl::new())
}

#[tonic::async_trait]
impl AuthService for AuthServiceImpl {
    async fn validate_credentials(
        &self,
        _request: Request<ValidateCredentialsRequest>,
    ) -> Result<Response<ValidateCredentialsResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn validate_token(
        &self,
        _request: Request<ValidateTokenRequest>,
    ) -> Result<Response<ValidateTokenResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn get_user(
        &self,
        _request: Request<GetUserRequest>,
    ) -> Result<Response<GetUserResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn get_user_roles(
        &self,
        _request: Request<GetUserRolesRequest>,
    ) -> Result<Response<GetUserRolesResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn revoke_token(
        &self,
        _request: Request<RevokeTokenRequest>,
    ) -> Result<Response<()>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn logout(
        &self,
        _request: Request<LogoutRequest>,
    ) -> Result<Response<()>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn get_security_config(
        &self,
        _request: Request<()>,
    ) -> Result<Response<SecurityConfigResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn get_jwks(
        &self,
        _request: Request<()>,
    ) -> Result<Response<JwksResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }

    async fn health_check(
        &self,
        _request: Request<()>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        Err(Status::unimplemented("Not implemented"))
    }
}
