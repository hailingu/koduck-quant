//! gRPC TokenService implementation

use crate::{
    error::AppError,
    grpc::proto::{
        token_service_server::TokenService,
        *,
    },
    service::TokenService as TokenServiceImpl,
};
use tonic::{Request, Response, Status};
use tracing::{info, warn};

/// gRPC TokenService implementation
#[derive(Clone)]
pub struct GrpcTokenService {
    token_service: TokenServiceImpl,
}

impl GrpcTokenService {
    /// Create new gRPC token service
    pub fn new(token_service: TokenServiceImpl) -> Self {
        Self { token_service }
    }

    /// Convert AppError to tonic::Status
    fn to_status(err: AppError) -> Status {
        match err {
            AppError::Unauthorized(msg) => Status::unauthenticated(msg),
            AppError::Forbidden(msg) => Status::permission_denied(msg),
            AppError::NotFound(msg) => Status::not_found(msg),
            AppError::Validation(msg) => Status::invalid_argument(msg),
            AppError::Conflict(msg) => Status::already_exists(msg),
            AppError::Locked(msg) => Status::failed_precondition(msg),
            AppError::TooManyRequests(msg) => Status::resource_exhausted(msg),
            AppError::ServiceUnavailable(msg) => Status::unavailable(msg),
            _ => Status::internal(err.to_string()),
        }
    }
}

#[tonic::async_trait]
impl TokenService for GrpcTokenService {
    /// Introspect access token - OIDC RFC 7662 compatible
    /// Returns active=false in response rather than error for invalid tokens
    async fn introspect_access_token(
        &self,
        request: Request<IntrospectTokenRequest>,
    ) -> Result<Response<IntrospectTokenResponse>, Status> {
        let req = request.into_inner();
        info!("Introspecting access token");

        match self.token_service.introspect_token(&req.token).await {
            Ok(true) => {
                // Token is valid
                // TODO: Extract claims and populate response fields
                let response = IntrospectTokenResponse {
                    active: true,
                    scope: Some("read write".to_string()),
                    client_id: None,
                    username: Some("user".to_string()),
                    token_type: Some("Bearer".to_string()),
                    exp: None,
                    iat: None,
                    nbf: None,
                    sub: Some("user_id".to_string()),
                    aud: vec![],
                    iss: Some("koduck-auth".to_string()),
                    jti: Some("token_id".to_string()),
                };
                Ok(Response::new(response))
            }
            Ok(false) => {
                // Token is invalid or expired - return active=false per RFC 7662
                let response = IntrospectTokenResponse {
                    active: false,
                    scope: None,
                    client_id: None,
                    username: None,
                    token_type: None,
                    exp: None,
                    iat: None,
                    nbf: None,
                    sub: None,
                    aud: vec![],
                    iss: None,
                    jti: None,
                };
                Ok(Response::new(response))
            }
            Err(e) => {
                warn!("Token introspection failed: {}", e);
                Err(Self::to_status(e))
            }
        }
    }

    async fn refresh_token(
        &self,
        request: Request<RefreshTokenRequest>,
    ) -> Result<Response<RefreshTokenResponse>, Status> {
        let req = request.into_inner();
        info!("Refreshing token");

        let refresh_req = crate::model::RefreshTokenRequest {
            refresh_token: req.refresh_token,
        };

        // Note: This should use auth_service.refresh_token, not token_service
        // For now, return unimplemented
        let _ = refresh_req;
        Err(Status::unimplemented(
            "RefreshToken not yet fully implemented",
        ))
    }

    async fn generate_token_pair(
        &self,
        request: Request<GenerateTokenPairRequest>,
    ) -> Result<Response<GenerateTokenPairResponse>, Status> {
        let req = request.into_inner();
        info!("Generating token pair for user: {}", req.user_id);

        // TODO: Implement token pair generation using JWT service
        let _ = (req.user_id, req.username, req.email, req.roles);

        Err(Status::unimplemented(
            "GenerateTokenPair not yet fully implemented",
        ))
    }
}
