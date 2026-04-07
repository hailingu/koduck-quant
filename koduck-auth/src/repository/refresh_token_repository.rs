//! Refresh token repository

use crate::{
    error::{AppError, Result},
    model::RefreshTokenRecord,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;

/// Refresh token repository
#[derive(Debug, Clone)]
pub struct RefreshTokenRepository {
    pool: PgPool,
}

impl RefreshTokenRepository {
    /// Create new refresh token repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Save refresh token
    pub async fn save(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<RefreshTokenRecord> {
        let token = sqlx::query_as::<_, RefreshTokenRecord>(
            r#"
            INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, token_hash, expires_at, created_at, revoked_at
            "#,
        )
        .bind(user_id)
        .bind(token_hash)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(token)
    }

    /// Find token by hash
    pub async fn find_by_token(&self, token_hash: &str) -> Result<Option<RefreshTokenRecord>> {
        let token = sqlx::query_as::<_, RefreshTokenRecord>(
            r#"
            SELECT id, user_id, token_hash, expires_at, created_at, revoked_at
            FROM refresh_tokens
            WHERE token_hash = $1
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(token)
    }

    /// Revoke token
    pub async fn revoke(&self, token_hash: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE token_hash = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(token_hash)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Revoke all user tokens
    pub async fn revoke_all_user_tokens(&self, user_id: i64) -> Result<u64> {
        let result = sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(result.rows_affected())
    }

    /// Cleanup expired tokens
    pub async fn cleanup_expired(&self) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM refresh_tokens
            WHERE expires_at < NOW() - INTERVAL '7 days'
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(result.rows_affected())
    }
}
