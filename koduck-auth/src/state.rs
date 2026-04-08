//! Application state management

use crate::{
    config::Config,
    crypto::load_or_generate_keys,
    error::{AppError, Result},
    jwt::JwtService,
    repository::RedisCache,
};
use deadpool_redis::{Config as RedisConfig, Pool as RedisPool, Runtime};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tracing::{info, warn};

/// Shared application state
pub struct AppState {
    config: Config,
    db_pool: PgPool,
    redis_pool: RedisPool,
    redis_cache: RedisCache,
    jwt_service: JwtService,
}

impl AppState {
    /// Create new application state
    pub async fn new(config: Config) -> Result<Self> {
        let skip_db_on_boot = std::env::var("KODUCK_AUTH_SKIP_DB_ON_BOOT")
            .ok()
            .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(false);

        let db_pool = if skip_db_on_boot {
            warn!("KODUCK_AUTH_SKIP_DB_ON_BOOT=true, skip database connectivity check and migrations at startup");
            PgPoolOptions::new()
                .max_connections(config.database.max_connections)
                .min_connections(config.database.min_connections)
                .acquire_timeout(std::time::Duration::from_secs(
                    config.database.acquire_timeout_secs,
                ))
                .idle_timeout(std::time::Duration::from_secs(config.database.idle_timeout_secs))
                .connect_lazy(config.database_url())
                .map_err(AppError::Database)?
        } else {
            // Create database connection pool
            let pool = PgPoolOptions::new()
                .max_connections(config.database.max_connections)
                .min_connections(config.database.min_connections)
                .acquire_timeout(std::time::Duration::from_secs(
                    config.database.acquire_timeout_secs,
                ))
                .idle_timeout(std::time::Duration::from_secs(config.database.idle_timeout_secs))
                .connect(config.database_url())
                .await
                .map_err(AppError::Database)?;

            // Run migrations
            sqlx::migrate!("./migrations")
                .run(&pool)
                .await
                .map_err(|e| AppError::Internal(format!("Migration failed: {}", e)))?;
            pool
        };

        // Create Redis connection pool
        let redis_config = RedisConfig::from_url(config.redis_url());
        let redis_pool = redis_config
            .create_pool(Some(Runtime::Tokio1))
            .map_err(|e| AppError::Config(format!("Redis pool creation failed: {}", e)))?;

        // Create Redis cache wrapper
        let redis_cache = RedisCache::new(redis_pool.clone());

        // Load or generate JWT keys
        let auto_generate_keys = std::env::var("KODUCK_AUTH_DEV_MODE")
            .ok()
            .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(false);

        let (private_key, _public_key) = load_or_generate_keys(
            &config.jwt.private_key_path,
            &config.jwt.public_key_path,
            auto_generate_keys,
        )
        .await?;

        info!("JWT keys loaded successfully");

        // Create JWT service
        let jwt_service = JwtService::new(
            &private_key,
            config.jwt.key_id.clone(),
            config.jwt.access_token_expiration_secs,
            config.jwt.refresh_token_expiration_secs,
            config.jwt.issuer.clone(),
            config.jwt.audience.clone(),
        )?;

        info!("JWT service initialized successfully");

        Ok(Self {
            config,
            db_pool,
            redis_pool,
            redis_cache,
            jwt_service,
        })
    }

    /// Get configuration
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Get database pool
    pub fn db_pool(&self) -> &PgPool {
        &self.db_pool
    }

    /// Get Redis pool
    pub fn redis_pool(&self) -> &RedisPool {
        &self.redis_pool
    }

    /// Get Redis cache
    pub fn redis_cache(&self) -> &RedisCache {
        &self.redis_cache
    }

    /// Get JWT service
    pub fn jwt_service(&self) -> &JwtService {
        &self.jwt_service
    }
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            db_pool: self.db_pool.clone(),
            redis_pool: self.redis_pool.clone(),
            redis_cache: self.redis_cache.clone(),
            jwt_service: self.jwt_service.clone(),
        }
    }
}
