//! Application state management

use crate::{
    config::Config,
    error::{AppError, Result},
};
use deadpool_redis::{Config as RedisConfig, Pool as RedisPool, Runtime};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;

/// Shared application state
#[derive(Debug)]
pub struct AppState {
    config: Config,
    db_pool: PgPool,
    redis_pool: RedisPool,
}

impl AppState {
    /// Create new application state
    pub async fn new(config: Config) -> Result<Self> {
        // Create database connection pool
        let db_pool = PgPoolOptions::new()
            .max_connections(config.database.max_connections)
            .min_connections(config.database.min_connections)
            .acquire_timeout(std::time::Duration::from_secs(
                config.database.acquire_timeout_secs,
            ))
            .idle_timeout(std::time::Duration::from_secs(config.database.idle_timeout_secs))
            .connect(config.database_url())
            .await
            .map_err(|e| AppError::Database(e))?;

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&db_pool)
            .await
            .map_err(|e| AppError::Internal(format!("Migration failed: {}", e)))?;

        // Create Redis connection pool
        let redis_config = RedisConfig::from_url(config.redis_url());
        let redis_pool = redis_config
            .create_pool(Some(Runtime::Tokio1))
            .map_err(|e| AppError::Config(format!("Redis pool creation failed: {}", e)))?;

        Ok(Self {
            config,
            db_pool,
            redis_pool,
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
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            db_pool: self.db_pool.clone(),
            redis_pool: self.redis_pool.clone(),
        }
    }
}
