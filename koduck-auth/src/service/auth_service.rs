//! Authentication service

use crate::{
    config::Config,
    crypto::PasswordHasher,
    error::{AppError, Result},
    jwt::JwtService,
    model::{
        CreateUserDto, LoginRequest, RegisterRequest, RefreshTokenRequest,
        SecurityConfigResponse, TokenPair, TokenResponse, User, UserInfo,
    },
    repository::{RedisCache, RefreshTokenRepository, UserRepository},
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
}
