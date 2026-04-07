//! gRPC AuthService implementation

use crate::{
    error::{AppError, Result},
    grpc::proto::{
        auth_service_server::AuthService,
        token_service_server::TokenService,
        *,
    },
    model::{TokenResponse, UserInfo},
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};
use std::sync::Arc;
use tonic::{Request, Response, Status};
use tracing::{error, info, warn};

/// gRPC AuthService implementation
#[derive(Clone)]
pub struct GrpcAuthService {
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
}

impl GrpcAuthService {
    /// Create new gRPC auth service
    pub fn new(auth_service: AuthServiceImpl, token_service: TokenServiceImpl) -> Self {
        Self {
            auth_service,
            token_service,
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
impl AuthService for GrpcAuthService {
    async fn validate_credentials(
        &self,
        request: Request<ValidateCredentialsRequest>,
    ) -> Result<Response<ValidateCredentialsResponse>, Status> {
        let req = request.into_inner();
        info!("Validating credentials for user: {}", req.username);

        let login_req = crate::model::LoginRequest {
            username: req.username,
            password: req.password,
            turnstile_token: None,
        };

        match self
            .auth_service
            .login(login_req, req.ip_address, req.user_agent)
            .await
        {
            Ok(token_response) => {
                let response = ValidateCredentialsResponse {
                    user: Some(token_response.user.into()),
                    roles: token_response.user.roles,
                    tokens: Some(proto::TokenPair {
                        access_token: token_response.tokens.access_token,
                        refresh_token: token_response.tokens.refresh_token,
                        token_type: token_response.tokens.token_type,
                        expires_in: token_response.tokens.expires_in,
                    }),
                };
                Ok(Response::new(response))
            }
            Err(e) => {
                warn!("Credential validation failed: {}", e);
                Err(Self::to_status(e))
            }
        }
    }

    async fn validate_token(
        &self,
        request: Request<ValidateTokenRequest>,
    ) -> Result<Response<ValidateTokenResponse>, Status> {
        let req = request.into_inner();

        // Use token service to introspect the token
        match self.token_service.introspect_token(&req.token).await {
            Ok(true) => {
                // Token is valid, extract claims (simplified for now)
                let response = ValidateTokenResponse {
                    user_id: 0, // TODO: Extract from token claims
                    username: String::new(),
                    email: String::new(),
                    roles: vec![],
                    expires_at: None,
                    token_id: String::new(),
                    issued_at: None,
                    token_type: proto::TokenType::Access as i32,
                };
                Ok(Response::new(response))
            }
            Ok(false) => Err(Status::unauthenticated("Invalid or expired token")),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_user(
        &self,
        request: Request<GetUserRequest>,
    ) -> Result<Response<GetUserResponse>, Status> {
        let req = request.into_inner();

        // TODO: Implement user lookup based on identifier
        let _ = req.identifier;

        Err(Status::unimplemented("GetUser not yet implemented"))
    }

    async fn get_user_roles(
        &self,
        request: Request<GetUserRolesRequest>,
    ) -> Result<Response<GetUserRolesResponse>, Status> {
        let req = request.into_inner();

        // TODO: Implement user roles lookup
        let _ = req.user_id;

        Err(Status::unimplemented("GetUserRoles not yet implemented"))
    }

    async fn revoke_token(
        &self,
        request: Request<RevokeTokenRequest>,
    ) -> Result<Response<()>, Status> {
        let req = request.into_inner();

        match self
            .token_service
            .revoke_token(&req.token, req.user_id)
            .await
        {
            Ok(_) => Ok(Response::new(())),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn logout(
        &self,
        request: Request<LogoutRequest>,
    ) -> Result<Response<()>, Status> {
        let req = request.into_inner();

        match self
            .auth_service
            .logout(req.refresh_token, req.user_id)
            .await
        {
            Ok(_) => Ok(Response::new(())),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_security_config(
        &self,
        _request: Request<()>,
    ) -> Result<Response<SecurityConfigResponse>, Status> {
        match self.auth_service.get_security_config().await {
            Ok(config) => {
                let response = SecurityConfigResponse {
                    turnstile_enabled: config.turnstile_enabled,
                    turnstile_site_key: config.turnstile_site_key.unwrap_or_default(),
                    registration_enabled: config.registration_enabled,
                    oauth_google_enabled: config.oauth_google_enabled,
                    oauth_github_enabled: config.oauth_github_enabled,
                    password_policy: Some(proto::PasswordPolicy {
                        min_length: config.password_policy.min_length as i32,
                        max_length: config.password_policy.max_length as i32,
                        require_uppercase: config.password_policy.require_uppercase,
                        require_lowercase: config.password_policy.require_lowercase,
                        require_digit: config.password_policy.require_digit,
                        require_special: config.password_policy.require_special,
                    }),
                    lockout_policy: Some(proto::LockoutPolicy {
                        max_attempts: config.lockout_policy.max_attempts,
                        lockout_duration_minutes: config.lockout_policy.lockout_duration_minutes,
                    }),
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_jwks(
        &self,
        _request: Request<()>,
    ) -> Result<Response<JwksResponse>, Status> {
        // TODO: Implement JWKS retrieval from JWT service
        let response = JwksResponse { keys: vec![] };
        Ok(Response::new(response))
    }

    async fn health_check(
        &self,
        _request: Request<()>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        let response = HealthCheckResponse {
            status: proto::health_check_response::ServingStatus::Serving as i32,
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: Some(proto::Timestamp {
                seconds: chrono::Utc::now().timestamp(),
                nanos: 0,
            }),
            details: Default::default(),
        };
        Ok(Response::new(response))
    }
}
