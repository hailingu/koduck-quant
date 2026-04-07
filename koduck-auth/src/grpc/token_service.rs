//! gRPC TokenService implementation

use crate::{
    grpc::proto::{
        token_service_server::TokenService,
        *,
    },
    service::TokenService as TokenServiceImpl,
};
use tonic::{Request, Response, Status};
use tracing::info;

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
    fn to_status(err: crate::error::AppError) -> Status {
        use crate::error::AppError;
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
    ) -> std::result::Result<Response<IntrospectTokenResponse>, Status> {
        let req = request.into_inner();
        info!("Introspecting access token");

        match self.token_service.introspect_token(&req.token).await {
            Ok(true) => {
                // Token is valid
                // TODO: Extract claims and populate response fields
                let response = IntrospectTokenResponse {
                    active: true,
                    scope: "read write".to_string(),
                    client_id: 0,
                    username: "user".to_string(),
                    token_type: "Bearer".to_string(),
                    exp: None,
                    iat: None,
                    nbf: None,
                    sub: "user_id".to_string(),
                    aud: vec![],
                    iss: "koduck-auth".to_string(),
                    jti: "token_id".to_string(),
                };
                Ok(Response::new(response))
            }
            Ok(false) => {
                // Token is invalid or expired - return active=false per RFC 7662
                let response = IntrospectTokenResponse {
                    active: false,
                    scope: String::new(),
                    client_id: 0,
                    username: String::new(),
                    token_type: String::new(),
                    exp: None,
                    iat: None,
                    nbf: None,
                    sub: String::new(),
                    aud: vec![],
                    iss: String::new(),
                    jti: String::new(),
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn refresh_token(
        &self,
        _request: Request<RefreshTokenRequest>,
    ) -> std::result::Result<Response<RefreshTokenResponse>, Status> {
        Err(Status::unimplemented("RefreshToken not yet fully implemented"))
    }

    async fn generate_token_pair(
        &self,
        _request: Request<GenerateTokenPairRequest>,
    ) -> std::result::Result<Response<GenerateTokenPairResponse>, Status> {
        Err(Status::unimplemented("GenerateTokenPair not yet fully implemented"))
    }
}
