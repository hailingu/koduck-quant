//! Password reset token repository

use crate::{
    error::{AppError, Result},
    model::PasswordResetToken,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;

/// Password reset token repository
#[derive(Debug, Clone)]
pub struct PasswordResetRepository {
    pool: PgPool,
}

impl PasswordResetRepository {
    /// Create new password reset repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Save password reset token
    pub async fn save(
        &self,
        user_id: i64,
        token_hash: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<PasswordResetToken> {
        let token = sqlx::query_as::<_, PasswordResetToken>(
            r#"
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, token_hash, expires_at, created_at, used_at
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
    pub async fn find_by_token(&self, token_hash: &str) -> Result<Option<PasswordResetToken>> {
        let token = sqlx::query_as::<_, PasswordResetToken>(
            r#"
            SELECT id, user_id, token_hash, expires_at, created_at, used_at
            FROM password_reset_tokens
            WHERE token_hash = $1
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(token)
    }

    /// Mark token as used
    pub async fn mark_as_used(&self, token_hash: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE password_reset_tokens
            SET used_at = NOW()
            WHERE token_hash = $1 AND used_at IS NULL
            "#,
        )
        .bind(token_hash)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Cleanup expired tokens
    pub async fn cleanup_expired(&self) -> Result<u64> {
        let result = sqlx::query(
            r#"
            DELETE FROM password_reset_tokens
            WHERE expires_at < NOW() - INTERVAL '7 days'
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(result.rows_affected())
    }
}
