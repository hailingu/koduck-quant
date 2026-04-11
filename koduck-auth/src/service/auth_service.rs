//! Authentication service

use crate::{
    config::Config,
    crypto::PasswordHasher,
    error::{AppError, Result},
    jwt::JwtService,
    model::{
        Claims, TokenType,
        ForgotPasswordRequest, LoginRequest, RegisterRequest,
        RefreshTokenRequest, ResetPasswordRequest, SecurityConfigResponse,
        TokenPair, TokenResponse, User, UserInfo,
    },
    repository::{PasswordResetRepository, RedisCache, RefreshTokenRepository, UserRepository},
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

const DEFAULT_TENANT_ID: &str = "default";

/// Authentication service
#[derive(Clone)]
pub struct AuthService {
    user_repo: UserRepository,
    token_repo: RefreshTokenRepository,
    password_reset_repo: PasswordResetRepository,
    redis: RedisCache,
    jwt_service: JwtService,
    password_hasher: PasswordHasher,
    db_pool: PgPool,
    config: Arc<Config>,
}

#[derive(Debug, Deserialize)]
struct InternalUserDetails {
    id: i64,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    username: String,
    email: String,
    #[serde(rename = "passwordHash")]
    password_hash: String,
    nickname: Option<String>,
    status: String,
}

#[derive(Debug, Serialize)]
struct LastLoginUpdatePayload {
    #[serde(rename = "loginTime")]
    login_time: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "ipAddress")]
    ip_address: String,
}

#[derive(Debug, Serialize)]
struct InternalCreateUserRequest {
    username: String,
    email: String,
    #[serde(rename = "passwordHash")]
    password_hash: String,
    nickname: Option<String>,
    status: String,
}

impl AuthService {
    /// Create new authentication service
    pub fn new(
        user_repo: UserRepository,
        token_repo: RefreshTokenRepository,
        password_reset_repo: PasswordResetRepository,
        redis: RedisCache,
        jwt_service: JwtService,
        db_pool: PgPool,
        config: Arc<Config>,
    ) -> Result<Self> {
        // Create password hasher with configured Argon2 parameters
        let password_hasher = PasswordHasher::with_config(&config.security)?;

        Ok(Self {
            user_repo,
            token_repo,
            password_reset_repo,
            redis,
            jwt_service,
            password_hasher,
            db_pool,
            config,
        })
    }

    /// Login user
    pub async fn login(&self, req: LoginRequest, ip: String, _user_agent: String) -> Result<TokenResponse> {
        // Check if IP is locked
        if self.redis.is_ip_locked(&ip).await? {
            return Err(AppError::Locked(
                "Account temporarily locked due to too many failed attempts".to_string(),
            ));
        }

        // Fetch user from koduck-user internal API instead of local auth DB.
        let user = self
            .fetch_user_from_user_service(DEFAULT_TENANT_ID, &req.username)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid username or password".to_string()))?;

        // Verify password
        if !self
            .password_hasher
            .verify_password(&req.password, &user.password_hash)
            .await?
        {
            // Increment failed attempts
            let attempts = self.redis.incr_login_attempt(&ip).await?;
            
            // Lock IP if too many attempts
            if attempts >= self.config.security.max_login_attempts {
                self.redis
                    .lock_ip(&ip, self.config.security.lockout_duration_minutes as u64 * 60)
                    .await?;
            }

            return Err(AppError::Unauthorized(
                "Invalid username or password".to_string(),
            ));
        }

        // Check account status
        match Self::parse_user_status(&user.status) {
            crate::model::UserStatus::Locked => {
                return Err(AppError::Locked("Account is locked".to_string()));
            }
            crate::model::UserStatus::Inactive => {
                return Err(AppError::Forbidden("Account is inactive".to_string()));
            }
            _ => {}
        }

        // Reset login attempts
        self.redis.reset_login_attempts(&ip).await?;

        // Get user roles
        let roles = self
            .fetch_user_roles_from_user_service(&user.tenant_id, user.id)
            .await?;

        // Update last login in koduck-user
        self.update_last_login_in_user_service(&user.tenant_id, user.id, &ip)
            .await?;

        let tokens = self
            .generate_token_pair(user.id, &user.tenant_id, &user.username, &user.email, &roles)
            .await?;

        let auth_user = User {
            id: user.id,
            username: user.username.clone(),
            email: user.email.clone(),
            password_hash: user.password_hash.clone(),
            nickname: user.nickname.clone(),
            avatar_url: None,
            status: Self::parse_user_status(&user.status),
            email_verified: false,
            last_login_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        Ok(TokenResponse::new(tokens, UserInfo::from(auth_user)))
    }

    /// Register new user
    /// Canonical flow: APISIX -> koduck-auth -> koduck-user
    pub async fn register(&self, req: RegisterRequest) -> Result<TokenResponse> {
        // Hash password with configured Argon2 parameters
        let password_hash = self.password_hasher.hash_password(&req.password).await?;

        let created = self
            .create_user_in_user_service(
                DEFAULT_TENANT_ID,
                req.username,
                req.email,
                password_hash,
                req.nickname,
            )
            .await?;
        info!("User registered successfully via user-service: {}", created.id);

        let roles = self
            .fetch_user_roles_from_user_service(&created.tenant_id, created.id)
            .await?;

        let tokens = self
            .generate_token_pair(
                created.id,
                &created.tenant_id,
                &created.username,
                &created.email,
                &roles,
            )
            .await?;

        let user = User {
            id: created.id,
            username: created.username.clone(),
            email: created.email.clone(),
            password_hash: created.password_hash.clone(),
            nickname: created.nickname.clone(),
            avatar_url: None,
            status: Self::parse_user_status(&created.status),
            email_verified: false,
            last_login_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        Ok(TokenResponse::new(
            tokens,
            UserInfo::from(user),
        ))
    }

    /// Refresh access token
    pub async fn refresh_token(&self, req: RefreshTokenRequest) -> Result<TokenResponse> {
        let refresh_token_hash = Self::hash_token(&req.refresh_token);
        let claims = Self::try_extract_claims_without_verification(&req.refresh_token)
            .ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;

        if !matches!(claims.token_type, TokenType::Refresh) {
            return Err(AppError::Unauthorized("Invalid refresh token".to_string()));
        }

        // Find refresh token
        let token_record = self
            .token_repo
            .find_by_token_in_tenant(&claims.tenant_id, &refresh_token_hash)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;

        // Check if revoked
        if token_record.revoked_at.is_some() {
            return Err(AppError::Unauthorized("Refresh token has been revoked".to_string()));
        }

        // Check if expired
        if token_record.expires_at < chrono::Utc::now() {
            return Err(AppError::Unauthorized("Refresh token has expired".to_string()));
        }

        // Get user
        let user = self
            .fetch_user_by_id_from_user_service(&token_record.tenant_id, token_record.user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // Revoke old token
        self.token_repo
            .revoke_in_tenant(&token_record.tenant_id, &refresh_token_hash)
            .await?;

        // Get roles
        let roles = self
            .fetch_user_roles_from_user_service(&token_record.tenant_id, user.id)
            .await?;

        let tokens = self
            .generate_token_pair(user.id, &user.tenant_id, &user.username, &user.email, &roles)
            .await?;

        let response_user = User {
            id: user.id,
            username: user.username.clone(),
            email: user.email.clone(),
            password_hash: user.password_hash.clone(),
            nickname: user.nickname.clone(),
            avatar_url: None,
            status: Self::parse_user_status(&user.status),
            email_verified: false,
            last_login_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        Ok(TokenResponse::new(tokens, UserInfo::from(response_user)))
    }

    /// Logout user
    pub async fn logout(&self, refresh_token: Option<String>, _user_id: i64) -> Result<()> {
        // Revoke refresh token if provided
        if let Some(token) = refresh_token {
            let token_hash = Self::hash_token(&token);
            if let Some(claims) = Self::try_extract_claims_without_verification(&token) {
                match claims.token_type {
                    TokenType::Access => {
                        self.redis
                            .add_to_token_blacklist(&claims.jti, claims.exp)
                            .await?;
                        info!("Access token blacklisted on logout: jti={}", claims.jti);
                    }
                    TokenType::Refresh => {
                        self.token_repo
                            .revoke_in_tenant(&claims.tenant_id, &token_hash)
                            .await?;
                    }
                }
            } else {
                self.token_repo.revoke(&token_hash).await?;
            }
        };

        Ok(())
    }

    /// Get security configuration
    pub async fn get_security_config(&self) -> Result<SecurityConfigResponse> {
        Ok(SecurityConfigResponse {
            turnstile_enabled: self.config.security.turnstile_enabled,
            turnstile_site_key: if self.config.security.turnstile_enabled {
                Some(self.config.security.turnstile_secret_key.expose_secret().clone())
            } else {
                None
            },
            registration_enabled: true,
            oauth_google_enabled: false,
            oauth_github_enabled: false,
            password_policy: crate::model::response::PasswordPolicyResponse {
                min_length: self.config.security.password_min_length,
                max_length: self.config.security.password_max_length,
                require_uppercase: true,
                require_lowercase: true,
                require_digit: true,
                require_special: false,
            },
        })
    }

    /// Generate token pair for user
    /// Uses JWT service to generate real tokens
    async fn generate_token_pair(
        &self,
        user_id: i64,
        tenant_id: &str,
        username: &str,
        email: &str,
        roles: &[String],
    ) -> Result<TokenPair> {
        // Generate JWT access token
        let access_token = self.jwt_service.generate_access_token(
            user_id,
            tenant_id,
            username,
            email,
            roles,
        )?;

        // Generate JWT refresh token
        let refresh_token = self.jwt_service.generate_refresh_token(user_id, tenant_id)?;

        // Save refresh token hash to database
        let mut hasher = Sha256::new();
        hasher.update(&refresh_token);
        let refresh_token_hash = format!("{:x}", hasher.finalize());
        let expires_at = chrono::Utc::now()
            + chrono::Duration::seconds(self.config.jwt.refresh_token_expiration_secs);

        self.token_repo
            .save_for_tenant(tenant_id, user_id, &refresh_token_hash, expires_at)
            .await?;

        info!("Generated token pair for user: {} in tenant {}", user_id, tenant_id);

        Ok(TokenPair::new(
            access_token,
            refresh_token,
            self.config.jwt.access_token_expiration_secs,
        ))
    }

    /// Request password reset
    /// Generates a reset token and sends email (async)
    /// Returns success even if email not found (security: don't expose user existence)
    pub async fn forgot_password(&self, req: ForgotPasswordRequest, _ip: String) -> Result<()> {
        // Check rate limit
        if self.is_password_reset_rate_limited(&req.email, &_ip).await? {
            return Err(AppError::TooManyRequests(
                "Too many password reset attempts. Please try again later.".to_string(),
            ));
        }

        // Find user by email
        let user = match self.user_repo.find_by_email(&req.email).await? {
            Some(user) => user,
            None => {
                // Don't expose whether email exists
                // Still return success to prevent user enumeration
                info!("Password reset requested for non-existent email: {}", req.email);
                return Ok(());
            }
        };

        // Generate secure random token
        let token = Self::generate_secure_token();

        // Calculate token hash for storage
        let mut hasher = Sha256::new();
        hasher.update(&token);
        let token_hash = format!("{:x}", hasher.finalize());

        // Save token to database
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
        self.password_reset_repo
            .save(user.id, &token_hash, expires_at)
            .await?;

        // Send password reset notification (async, don't block request)
        let email = req.email.clone();
        let user_id = user.id;
        let user_service_url = self.config.client.user_service_url.clone();
        let timeout_secs = self.config.client.user_service_timeout_secs;
        tokio::spawn(async move {
            let endpoint = format!(
                "{}/internal/notifications/password-reset",
                user_service_url.trim_end_matches('/'),
            );
            let payload = serde_json::json!({
                "user_id": user_id,
                "email": email,
                "reset_token": token,
            });

            let client = reqwest::Client::new();
            match tokio::time::timeout(
                Duration::from_secs(timeout_secs),
                client.post(endpoint).json(&payload).send(),
            )
            .await
            {
                Ok(Ok(resp)) if resp.status().is_success() => {
                    info!("Password reset notification dispatched for user_id={}", user_id);
                }
                Ok(Ok(resp)) => {
                    error!(
                        "Password reset notification failed for user_id={} with status={}",
                        user_id,
                        resp.status()
                    );
                }
                Ok(Err(e)) => {
                    error!(
                        "Password reset notification request error for user_id={}: {}",
                        user_id, e
                    );
                }
                Err(_) => {
                    error!(
                        "Password reset notification timed out for user_id={}",
                        user_id
                    );
                }
            }
        });

        info!("Password reset token generated for user: {}", user.id);
        Ok(())
    }

    /// Reset password using token
    /// Validates token, updates password, and revokes all user sessions
    pub async fn reset_password(&self, req: ResetPasswordRequest) -> Result<()> {
        // Calculate token hash
        let mut hasher = Sha256::new();
        hasher.update(&req.token);
        let token_hash = format!("{:x}", hasher.finalize());

        // Find token in database
        let token_record = self
            .password_reset_repo
            .find_by_token(&token_hash)
            .await?
            .ok_or_else(|| AppError::Unauthorized("Invalid or expired reset token".to_string()))?;

        // Check if token is already used
        if token_record.used_at.is_some() {
            return Err(AppError::Unauthorized(
                "Reset token has already been used".to_string(),
            ));
        }

        // Check if token is expired
        if token_record.expires_at < chrono::Utc::now() {
            return Err(AppError::Unauthorized(
                "Reset token has expired".to_string(),
            ));
        }

        // Get user
        let user = self
            .user_repo
            .find_by_id(token_record.user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // Start transaction
        let mut tx = self.db_pool.begin().await.map_err(|e| {
            error!("Failed to start transaction: {}", e);
            AppError::Database(e)
        })?;

        // Hash new password
        let password_hash = self.password_hasher.hash_password(&req.new_password).await?;

        // Update password within transaction
        if let Err(e) = self
            .user_repo
            .update_password_with_tx(&mut tx, user.id, &password_hash)
            .await
        {
            error!("Failed to update password: {:?}", e);
            return Err(e);
        }

        // Mark token as used within transaction
        if let Err(e) = self
            .password_reset_repo
            .mark_as_used_with_tx(&mut tx, &token_hash)
            .await
        {
            error!("Failed to mark token as used: {:?}", e);
            return Err(e);
        }

        // Commit transaction
        if let Err(e) = tx.commit().await {
            error!("Failed to commit transaction: {}", e);
            return Err(AppError::Database(e));
        }

        // Revoke all user refresh tokens (outside transaction as it's not critical)
        let revoked_count = self
            .token_repo
            .revoke_all_user_tokens(user.id)
            .await?;
        info!(
            "Password reset completed for user: {}, revoked {} tokens",
            user.id, revoked_count
        );

        Ok(())
    }

    /// Check if password reset is rate limited
    async fn is_password_reset_rate_limited(
        &self,
        email: &str,
        ip: &str,
    ) -> Result<bool> {
        // Check email-based limit (3 per hour)
        let email_key = format!("password_reset:email:{}", email);
        let email_count: i32 = self
            .redis
            .get_login_attempts(&email_key) // Reusing this method for counting
            .await?;

        if email_count >= 3 {
            return Ok(true);
        }

        // Check IP-based limit (10 per hour)
        let ip_key = format!("password_reset:ip:{}", ip);
        let ip_count: i32 = self.redis.get_login_attempts(&ip_key).await?;

        if ip_count >= 10 {
            return Ok(true);
        }

        // Increment counters
        self.redis.incr_login_attempt(&email_key).await?;
        self.redis.incr_login_attempt(&ip_key).await?;

        Ok(false)
    }

    /// Generate cryptographically secure random token
    fn generate_secure_token() -> String {
        use rand::Rng;
        rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(32)
            .map(char::from)
            .collect()
    }

    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    async fn fetch_user_from_user_service(
        &self,
        tenant_id: &str,
        username_or_email: &str,
    ) -> Result<Option<InternalUserDetails>> {
        let endpoint = if username_or_email.contains('@') {
            format!(
                "{}/internal/users/by-email/{}",
                self.config.client.user_service_url.trim_end_matches('/'),
                username_or_email
            )
        } else {
            format!(
                "{}/internal/users/by-username/{}",
                self.config.client.user_service_url.trim_end_matches('/'),
                username_or_email
            )
        };

        let client = reqwest::Client::new();
        let request = client
            .get(endpoint)
            .header("X-Consumer-Username", "koduck-auth")
            .header("X-Tenant-Id", tenant_id);

        let response = tokio::time::timeout(
            Duration::from_secs(self.config.client.user_service_timeout_secs),
            request.send(),
        )
        .await
        .map_err(|_| AppError::ServiceUnavailable("User service request timed out".to_string()))?
        .map_err(|e| AppError::ServiceUnavailable(format!("User service request failed: {}", e)))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "User service returned status {}",
                response.status()
            )));
        }

        let user = response
            .json::<InternalUserDetails>()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to decode user response: {}", e)))?;
        Ok(Some(user))
    }

    async fn fetch_user_by_id_from_user_service(
        &self,
        tenant_id: &str,
        user_id: i64,
    ) -> Result<Option<InternalUserDetails>> {
        let endpoint = format!(
            "{}/internal/users/{}",
            self.config.client.user_service_url.trim_end_matches('/'),
            user_id
        );

        let client = reqwest::Client::new();
        let request = client
            .get(endpoint)
            .header("X-Consumer-Username", "koduck-auth")
            .header("X-Tenant-Id", tenant_id);

        let response = tokio::time::timeout(
            Duration::from_secs(self.config.client.user_service_timeout_secs),
            request.send(),
        )
        .await
        .map_err(|_| AppError::ServiceUnavailable("User service request timed out".to_string()))?
        .map_err(|e| AppError::ServiceUnavailable(format!("User service request failed: {}", e)))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "User service returned status {}",
                response.status()
            )));
        }

        let user = response
            .json::<InternalUserDetails>()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to decode user response: {}", e)))?;
        Ok(Some(user))
    }

    async fn fetch_user_roles_from_user_service(
        &self,
        tenant_id: &str,
        user_id: i64,
    ) -> Result<Vec<String>> {
        let endpoint = format!(
            "{}/internal/users/{}/roles",
            self.config.client.user_service_url.trim_end_matches('/'),
            user_id
        );

        let client = reqwest::Client::new();
        let request = client
            .get(endpoint)
            .header("X-Consumer-Username", "koduck-auth")
            .header("X-Tenant-Id", tenant_id);

        let response = tokio::time::timeout(
            Duration::from_secs(self.config.client.user_service_timeout_secs),
            request.send(),
        )
        .await
        .map_err(|_| AppError::ServiceUnavailable("User roles request timed out".to_string()))?
        .map_err(|e| AppError::ServiceUnavailable(format!("User roles request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "User roles request failed with status {}",
                response.status()
            )));
        }

        response
            .json::<Vec<String>>()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to decode roles response: {}", e)))
    }

    async fn create_user_in_user_service(
        &self,
        tenant_id: &str,
        username: String,
        email: String,
        password_hash: String,
        nickname: Option<String>,
    ) -> Result<InternalUserDetails> {
        let endpoint = format!(
            "{}/internal/users",
            self.config.client.user_service_url.trim_end_matches('/'),
        );

        let payload = InternalCreateUserRequest {
            username,
            email,
            password_hash,
            nickname,
            status: "ACTIVE".to_string(),
        };

        let client = reqwest::Client::new();
        let request = client
            .post(endpoint)
            .header("X-Consumer-Username", "koduck-auth")
            .header("X-Tenant-Id", tenant_id)
            .json(&payload);

        let response = tokio::time::timeout(
            Duration::from_secs(self.config.client.user_service_timeout_secs),
            request.send(),
        )
        .await
        .map_err(|_| AppError::ServiceUnavailable("User create request timed out".to_string()))?
        .map_err(|e| AppError::ServiceUnavailable(format!("User create request failed: {}", e)))?;

        let status = response.status();
        if status.is_success() {
            return response
                .json::<InternalUserDetails>()
                .await
                .map_err(|e| AppError::Internal(format!("Failed to decode create-user response: {}", e)));
        }

        let body = response
            .text()
            .await
            .unwrap_or_else(|_| String::new());
        let message = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(ToString::to_string))
            .unwrap_or_else(|| format!("User create failed with status {}", status));

        match status {
            reqwest::StatusCode::CONFLICT => Err(AppError::Conflict(message)),
            reqwest::StatusCode::BAD_REQUEST => Err(AppError::Validation(message)),
            _ => Err(AppError::ServiceUnavailable(message)),
        }
    }

    async fn update_last_login_in_user_service(
        &self,
        tenant_id: &str,
        user_id: i64,
        ip: &str,
    ) -> Result<()> {
        let endpoint = format!(
            "{}/internal/users/{}/last-login",
            self.config.client.user_service_url.trim_end_matches('/'),
            user_id
        );
        let payload = LastLoginUpdatePayload {
            login_time: chrono::Utc::now(),
            ip_address: ip.to_string(),
        };

        let client = reqwest::Client::new();
        let request = client
            .put(endpoint)
            .header("X-Consumer-Username", "koduck-auth")
            .header("X-Tenant-Id", tenant_id)
            .json(&payload);

        let response = tokio::time::timeout(
            Duration::from_secs(self.config.client.user_service_timeout_secs),
            request.send(),
        )
        .await
        .map_err(|_| AppError::ServiceUnavailable("Update last-login request timed out".to_string()))?
        .map_err(|e| AppError::ServiceUnavailable(format!("Update last-login request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::ServiceUnavailable(format!(
                "Update last-login failed with status {}",
                response.status()
            )));
        }

        Ok(())
    }

    fn parse_user_status(status: &str) -> crate::model::UserStatus {
        match status {
            "LOCKED" => crate::model::UserStatus::Locked,
            "INACTIVE" => crate::model::UserStatus::Inactive,
            "DELETED" => crate::model::UserStatus::Deleted,
            _ => crate::model::UserStatus::Active,
        }
    }

    fn try_extract_claims_without_verification(token: &str) -> Option<Claims> {
        let payload = token.split('.').nth(1)?;
        let decoded = URL_SAFE_NO_PAD.decode(payload).ok()?;
        serde_json::from_slice::<Claims>(&decoded).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_secure_token() {
        let token1 = AuthService::generate_secure_token();
        let token2 = AuthService::generate_secure_token();

        // Token should be 32 characters
        assert_eq!(token1.len(), 32);
        assert_eq!(token2.len(), 32);

        // Tokens should be unique
        assert_ne!(token1, token2);

        // Tokens should be alphanumeric
        assert!(token1.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_try_extract_claims_without_verification_invalid_token() {
        let claims = AuthService::try_extract_claims_without_verification("invalid.token");
        assert!(claims.is_none());
    }
}
