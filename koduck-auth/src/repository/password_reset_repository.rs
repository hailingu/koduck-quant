//! Password reset token repository

use crate::{
    error::{AppError, Result},
    model::PasswordResetToken,
};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};

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

    // ============== Transaction Methods ==============

    /// Save password reset token within a transaction
    pub async fn save_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
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
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(token)
    }

    /// Mark token as used within a transaction
    pub async fn mark_as_used_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        token_hash: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE password_reset_tokens
            SET used_at = NOW()
            WHERE token_hash = $1 AND used_at IS NULL
            "#,
        )
        .bind(token_hash)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::CreateUserDto;
    use crate::repository::UserRepository;

    #[sqlx::test]
    async fn test_save_and_find_token(pool: PgPool) {
        let reset_repo = PasswordResetRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        // Create a test user first
        let user = user_repo
            .create(&CreateUserDto {
                username: "testreset".to_string(),
                email: "reset@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save password reset token
        let token_hash = "reset_hash_123";
        let expires_at = Utc::now() + chrono::Duration::hours(1);
        let saved = reset_repo.save(user.id, token_hash, expires_at).await.unwrap();

        assert_eq!(saved.user_id, user.id);
        assert_eq!(saved.token_hash, token_hash);

        // Find token
        let found = reset_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.id, saved.id);
    }

    #[sqlx::test]
    async fn test_mark_as_used(pool: PgPool) {
        let reset_repo = PasswordResetRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        let user = user_repo
            .create(&CreateUserDto {
                username: "testused".to_string(),
                email: "used@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save and mark as used
        let token_hash = "used_hash";
        let expires_at = Utc::now() + chrono::Duration::hours(1);
        let _ = reset_repo.save(user.id, token_hash, expires_at).await.unwrap();

        reset_repo.mark_as_used(token_hash).await.unwrap();

        // Verify token is marked as used
        let found = reset_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        assert!(found.unwrap().used_at.is_some());
    }

    #[sqlx::test]
    async fn test_transaction_save_and_mark_used(pool: PgPool) {
        let reset_repo = PasswordResetRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        let user = user_repo
            .create(&CreateUserDto {
                username: "testtxreset".to_string(),
                email: "txreset@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save token in transaction
        let mut tx = pool.begin().await.unwrap();
        let token_hash = "tx_reset_token";
        let expires_at = Utc::now() + chrono::Duration::hours(1);
        let _ = reset_repo
            .save_with_tx(&mut tx, user.id, token_hash, expires_at)
            .await
            .unwrap();

        // Mark as used in same transaction
        reset_repo.mark_as_used_with_tx(&mut tx, token_hash).await.unwrap();

        tx.commit().await.unwrap();

        // Verify token is marked as used
        let found = reset_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        assert!(found.unwrap().used_at.is_some());
    }
}
