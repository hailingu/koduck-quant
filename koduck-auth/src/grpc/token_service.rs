//! gRPC TokenService implementation

use crate::{
    error::AppError,
    grpc::proto::{
        token_service_server::TokenService,
        *,
    },
    jwt::JwtService,
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};
use tonic::{Request, Response, Status};
use tracing::info;

/// gRPC TokenService implementation
#[derive(Clone)]
pub struct GrpcTokenService {
    token_service: TokenServiceImpl,
    auth_service: AuthServiceImpl,
    jwt_service: JwtService,
}

impl GrpcTokenService {
    /// Create new gRPC token service
    pub fn new(
        token_service: TokenServiceImpl,
        auth_service: AuthServiceImpl,
        jwt_service: JwtService,
    ) -> Self {
        Self {
            token_service,
            auth_service,
            jwt_service,
        }
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

        // Call auth_service to refresh token
        match self.auth_service.refresh_token(refresh_req).await {
            Ok(token_response) => {
                let response = RefreshTokenResponse {
                    tokens: Some(proto::TokenPair {
                        access_token: token_response.tokens.access_token,
                        refresh_token: token_response.tokens.refresh_token,
                        token_type: token_response.tokens.token_type,
                        expires_in: token_response.tokens.expires_in,
                    }),
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn generate_token_pair(
        &self,
        request: Request<GenerateTokenPairRequest>,
    ) -> Result<Response<GenerateTokenPairResponse>, Status> {
        let req = request.into_inner();
        info!("Generating token pair for user: {}", req.user_id);

        // Generate access token using jwt_service
        let access_token = self
            .jwt_service
            .generate_access_token(
                req.user_id,
                &req.username,
                &req.email,
                &req.roles,
            )
            .map_err(Self::to_status)?;

        // Generate refresh token using jwt_service
        let refresh_token = self
            .jwt_service
            .generate_refresh_token(req.user_id)
            .map_err(Self::to_status)?;

        let response = GenerateTokenPairResponse {
            tokens: Some(proto::TokenPair {
                access_token,
                refresh_token,
                token_type: "Bearer".to_string(),
                expires_in: self.jwt_service.access_expiration(),
            }),
        };
        Ok(Response::new(response))
    }
}
