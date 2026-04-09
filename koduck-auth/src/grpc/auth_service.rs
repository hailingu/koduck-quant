//! gRPC AuthService implementation

use crate::{
    error::AppError,
    grpc::proto::{
        self,
        auth_service_server::AuthService,
        *,
    },
    jwt::JwksService,
    model::{Permission, UserStatus, UserInfo},
    repository::UserRepository,
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
};
use prost_types::Timestamp;
use tonic::{Request, Response, Status};
use tracing::{info, warn};

/// gRPC AuthService implementation
#[derive(Clone)]
pub struct GrpcAuthService {
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
    user_repo: UserRepository,
    jwks_service: JwksService,
}

impl GrpcAuthService {
    /// Create new gRPC auth service
    pub fn new(
        auth_service: AuthServiceImpl,
        token_service: TokenServiceImpl,
        user_repo: UserRepository,
        jwks_service: JwksService,
    ) -> Self {
        Self {
            auth_service,
            token_service,
            user_repo,
            jwks_service,
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

    fn to_proto_user_status(status: UserStatus) -> i32 {
        match status {
            UserStatus::Active => proto::UserStatus::Active as i32,
            UserStatus::Inactive => proto::UserStatus::Inactive as i32,
            UserStatus::Locked => proto::UserStatus::Locked as i32,
            UserStatus::Deleted => proto::UserStatus::Deleted as i32,
        }
    }

    fn to_proto_user_info(user: UserInfo) -> proto::UserInfo {
        proto::UserInfo {
            id: user.id,
            username: user.username,
            email: user.email,
            nickname: user.nickname.unwrap_or_default(),
            avatar_url: user.avatar_url.unwrap_or_default(),
            status: Self::to_proto_user_status(user.status),
            email_verified: user.email_verified,
            created_at: None,
            updated_at: None,
        }
    }

    fn to_proto_permission(perm: Permission) -> proto::Permission {
        proto::Permission {
            id: perm.id,
            name: perm.name,
            resource: perm.resource,
            action: perm.action,
        }
    }

    /// Convert i64 timestamp seconds to prost Timestamp
    fn to_timestamp(seconds: i64) -> Option<Timestamp> {
        Some(Timestamp {
            seconds,
            nanos: 0,
        })
    }
}

#[tonic::async_trait]
impl AuthService for GrpcAuthService {
    async fn validate_credentials(
        &self,
        request: Request<ValidateCredentialsRequest>,
    ) -> std::result::Result<Response<ValidateCredentialsResponse>, Status> {
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
                    user: Some(Self::to_proto_user_info(token_response.user)),
                    roles: vec![],
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
    ) -> std::result::Result<Response<ValidateTokenResponse>, Status> {
        let req = request.into_inner();

        // Use token service to introspect the token
        match self.token_service.introspect_token(&req.token).await {
            Ok(result) if result.active => {
                // Extract user_id from sub claim
                let user_id = result
                    .sub
                    .as_ref()
                    .and_then(|s| s.parse::<i64>().ok())
                    .unwrap_or(0);

                let response = ValidateTokenResponse {
                    user_id,
                    username: result.username.unwrap_or_default(),
                    email: result.email.unwrap_or_default(),
                    roles: result.roles,
                    expires_at: result.exp.and_then(|exp| Self::to_timestamp(exp)),
                    issued_at: result.iat.and_then(|iat| Self::to_timestamp(iat)),
                    token_id: result.jti.unwrap_or_default(),
                    token_type: proto::TokenType::Access as i32,
                };
                Ok(Response::new(response))
            }
            Ok(_) => Err(Status::unauthenticated("Invalid or expired token")),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_user(
        &self,
        request: Request<GetUserRequest>,
    ) -> std::result::Result<Response<GetUserResponse>, Status> {
        let req = request.into_inner();

        // Find user based on identifier type
        let user_result = match req.identifier {
            Some(get_user_request::Identifier::UserId(id)) => {
                self.user_repo.find_by_id(id).await
            }
            Some(get_user_request::Identifier::Username(username)) => {
                self.user_repo.find_by_username(&username).await
            }
            Some(get_user_request::Identifier::Email(email)) => {
                self.user_repo.find_by_email(&email).await
            }
            None => {
                return Err(Status::invalid_argument("Identifier required"));
            }
        };

        match user_result {
            Ok(Some(user)) => {
                // Get user roles
                let roles = self.user_repo.get_user_roles(user.id).await
                    .map_err(Self::to_status)?;

                let response = GetUserResponse {
                    user: Some(Self::to_proto_user_info(UserInfo::from(user))),
                    roles,
                };
                Ok(Response::new(response))
            }
            Ok(None) => Err(Status::not_found("User not found")),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_user_roles(
        &self,
        request: Request<GetUserRolesRequest>,
    ) -> std::result::Result<Response<GetUserRolesResponse>, Status> {
        let req = request.into_inner();

        // Get user roles
        let roles = self.user_repo.get_user_roles(req.user_id).await
            .map_err(Self::to_status)?;

        // Get user permissions
        let permissions = self.user_repo.get_user_permissions(req.user_id).await
            .map_err(Self::to_status)?;

        let response = GetUserRolesResponse {
            user_id: req.user_id,
            roles,
            permissions: permissions.into_iter().map(Self::to_proto_permission).collect(),
        };
        Ok(Response::new(response))
    }

    async fn revoke_token(
        &self,
        request: Request<RevokeTokenRequest>,
    ) -> std::result::Result<Response<()>, Status> {
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
    ) -> std::result::Result<Response<()>, Status> {
        let req = request.into_inner();
        let refresh_token = if req.refresh_token.is_empty() {
            None
        } else {
            Some(req.refresh_token)
        };

        match self
            .auth_service
            .logout(refresh_token, req.user_id)
            .await
        {
            Ok(_) => Ok(Response::new(())),
            Err(e) => Err(Self::to_status(e)),
        }
    }

    async fn get_security_config(
        &self,
        _request: Request<()>,
    ) -> std::result::Result<Response<SecurityConfigResponse>, Status> {
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
                        max_attempts: 5,
                        lockout_duration_minutes: 30,
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
    ) -> std::result::Result<Response<JwksResponse>, Status> {
        // Get JWKS from JwksService
        let jwks_json = self.jwks_service.get_jwks()
            .map_err(|e| Status::internal(format!("Failed to get JWKS: {}", e)))?;

        // Parse the JWKS JSON and convert to proto messages
        let keys = if let Some(keys_array) = jwks_json.get("keys").and_then(|k| k.as_array()) {
            keys_array
                .iter()
                .filter_map(|key| {
                    Some(proto::Jwk {
                        kty: key.get("kty")?.as_str()?.to_string(),
                        kid: key.get("kid")?.as_str()?.to_string(),
                        r#use: key.get("use")?.as_str()?.to_string(),
                        n: key.get("n")?.as_str()?.to_string(),
                        e: key.get("e")?.as_str()?.to_string(),
                        alg: key.get("alg")?.as_str()?.to_string(),
                    })
                })
                .collect()
        } else {
            vec![]
        };

        let response = JwksResponse { keys };
        Ok(Response::new(response))
    }

    async fn health_check(
        &self,
        _request: Request<()>,
    ) -> std::result::Result<Response<HealthCheckResponse>, Status> {
        let response = HealthCheckResponse {
            status: proto::ServingStatus::Serving as i32,
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: Some(Timestamp {
                seconds: chrono::Utc::now().timestamp(),
                nanos: 0,
            }),
            details: Default::default(),
        };
        Ok(Response::new(response))
    }
}
