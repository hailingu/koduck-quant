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
    /// Introspect access token - OAuth 2.0 RFC 7662 compatible
    /// Returns active=false in response for invalid tokens
    async fn introspect_access_token(
        &self,
        request: Request<IntrospectTokenRequest>,
    ) -> Result<Response<IntrospectTokenResponse>, Status> {
        let req = request.into_inner();
        info!("Introspecting access token");

        match self.token_service.introspect_token(&req.token).await {
            Ok(result) => {
                let response = IntrospectTokenResponse {
                    active: result.active,
                    scope: if result.roles.is_empty() {
                        String::new()
                    } else {
                        result.roles.join(" ")
                    },
                    client_id: 0, // Not implemented
                    username: result.username.unwrap_or_default(),
                    token_type: result.token_type.unwrap_or_else(|| "Bearer".to_string()),
                    exp: result.exp,
                    iat: result.iat,
                    nbf: None, // Not in our Claims
                    sub: result.sub.unwrap_or_default(),
                    aud: vec![], // Not in our Claims format
                    iss: String::new(), // Not in Claims
                    jti: result.jti.unwrap_or_default(),
                };
                Ok(Response::new(response))
            }
            Err(e) => {
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
