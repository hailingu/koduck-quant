//! Authentication service

use crate::{
    config::Config,
    crypto::PasswordHasher,
    error::{AppError, Result},
    jwt::JwtService,
    model::{
        CreateUserDto, ForgotPasswordRequest, LoginRequest, RegisterRequest,
        RefreshTokenRequest, ResetPasswordRequest, SecurityConfigResponse,
        TokenPair, TokenResponse, User, UserInfo,
    },
    repository::{PasswordResetRepository, RedisCache, RefreshTokenRepository, UserRepository},
};
use secrecy::ExposeSecret;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info};

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

        // Find user
        let user = self
            .user_repo
            .find_by_username_or_email(&req.username)
            .await?
            .ok_or_else(|| {
                AppError::Unauthorized("Invalid username or password".to_string())
            })?;

        // Verify password
        if !self.password_hasher.verify_password(&req.password, &user.password_hash).await? {
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
        match user.status {
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

        // Update last login
        self.user_repo.update_last_login(user.id).await?;

        // Get user roles
        let roles = self.user_repo.get_user_roles(user.id).await?;

        // Generate tokens
        let tokens = self.generate_token_pair(&user, &roles).await?;

        Ok(TokenResponse::new(
            tokens,
            UserInfo::from(user),
        ))
    }

    /// Register new user
    /// Uses transaction to ensure atomicity of user creation and role assignment
    pub async fn register(&self, req: RegisterRequest) -> Result<TokenResponse> {
        // Hash password with configured Argon2 parameters
        let password_hash = self.password_hasher.hash_password(&req.password).await?;

        // Start transaction for atomic user creation and role assignment
        let mut tx = self.db_pool.begin().await.map_err(|e| {
            error!("Failed to start transaction: {}", e);
            AppError::Database(e)
        })?;

        // Create user within transaction
        let dto = CreateUserDto {
            username: req.username,
            email: req.email,
            password_hash,
            nickname: req.nickname,
        };

        let user = match self.user_repo.create_with_tx(&mut tx, &dto).await {
            Ok(user) => user,
            Err(e) => {
                error!("Failed to create user in transaction: {:?}", e);
                // Transaction will be rolled back when dropped
                return Err(e);
            }
        };

        // Assign default role within same transaction
        if let Err(e) = self.user_repo.assign_role_with_tx(&mut tx, user.id, "USER").await {
            error!("Failed to assign role in transaction: {:?}", e);
            // Transaction will be rolled back when dropped
            return Err(e);
        }

        // Commit transaction
        if let Err(e) = tx.commit().await {
            error!("Failed to commit transaction: {}", e);
            return Err(AppError::Database(e));
        }

        info!("User registered successfully: {}", user.id);

        // Generate tokens (outside transaction as it's not DB-related)
        let roles = vec!["USER".to_string()];
        let tokens = self.generate_token_pair(&user, &roles).await?;

        Ok(TokenResponse::new(
            tokens,
            UserInfo::from(user),
        ))
    }

    /// Refresh access token
    pub async fn refresh_token(&self, req: RefreshTokenRequest) -> Result<TokenResponse> {
        // Find refresh token
        let token_record = self
            .token_repo
            .find_by_token(&req.refresh_token)
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
            .user_repo
            .find_by_id(token_record.user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // Revoke old token
        self.token_repo.revoke(&req.refresh_token).await?;

        // Get roles
        let roles = self.user_repo.get_user_roles(user.id).await?;

        // Generate new tokens
        let tokens = self.generate_token_pair(&user, &roles).await?;

        Ok(TokenResponse::new(
            tokens,
            UserInfo::from(user),
        ))
    }

    /// Logout user
    pub async fn logout(&self, refresh_token: Option<String>, _user_id: i64) -> Result<()> {
        // Revoke refresh token if provided
        if let Some(token) = refresh_token {
            self.token_repo.revoke(&token).await?;
        }

        // TODO: Add access token to blacklist

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
    async fn generate_token_pair(&self, user: &User, roles: &[String]) -> Result<TokenPair> {
        // Generate JWT access token
        let access_token = self.jwt_service.generate_access_token(
            user.id,
            &user.username,
            &user.email,
            roles,
        )?;

        // Generate JWT refresh token
        let refresh_token = self.jwt_service.generate_refresh_token(user.id)?;

        // Save refresh token hash to database
        let mut hasher = Sha256::new();
        hasher.update(&refresh_token);
        let refresh_token_hash = format!("{:x}", hasher.finalize());
        let expires_at = chrono::Utc::now()
            + chrono::Duration::seconds(self.config.jwt.refresh_token_expiration_secs);

        self.token_repo
            .save(user.id, &refresh_token_hash, expires_at)
            .await?;

        info!("Generated token pair for user: {}", user.id);

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
        let token = self.generate_secure_token();

        // Calculate token hash for storage
        let mut hasher = Sha256::new();
        hasher.update(&token);
        let token_hash = format!("{:x}", hasher.finalize());

        // Save token to database
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
        self.password_reset_repo
            .save(user.id, &token_hash, expires_at)
            .await?;

        // Send password reset email (async, don't wait)
        let email = req.email.clone();
        let user_id = user.id;
        tokio::spawn(async move {
            // TODO: Integrate with koduck-user or message queue for email sending
            // For now, just log the token (in production, send actual email)
            info!(
                "Password reset email should be sent to: {}, token: {} (user_id: {})",
                email, token, user_id
            );
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
    fn generate_secure_token(&self) -> String {
        use rand::Rng;
        rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(32)
            .map(char::from)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_secure_token() {
        let config = Arc::new(Config::default());
        let service = create_test_service(config).unwrap();

        let token1 = service.generate_secure_token();
        let token2 = service.generate_secure_token();

        // Token should be 32 characters
        assert_eq!(token1.len(), 32);
        assert_eq!(token2.len(), 32);

        // Tokens should be unique
        assert_ne!(token1, token2);

        // Tokens should be alphanumeric
        assert!(token1.chars().all(|c| c.is_alphanumeric()));
    }

    fn create_test_service(config: Arc<Config>) -> Result<AuthService> {
        // This is a simplified test helper
        // In real tests, you would use mock repositories
        todo!("Implement test helper with mock repositories")
    }
}
