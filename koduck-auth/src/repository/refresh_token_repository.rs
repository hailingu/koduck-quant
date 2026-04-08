//! Refresh token repository

use crate::{
    error::{AppError, Result},
    model::RefreshTokenRecord,
};
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};

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

    // ============== Transaction Methods ==============

    /// Save refresh token within a transaction
    pub async fn save_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
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
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(token)
    }

    /// Revoke token within a transaction
    pub async fn revoke_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        token_hash: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE token_hash = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(token_hash)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Revoke all user tokens within a transaction
    pub async fn revoke_all_user_tokens_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
    ) -> Result<u64> {
        let result = sqlx::query(
            r#"
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(user_id)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{CreateUserDto, UserStatus};
    use crate::repository::UserRepository;

    #[sqlx::test]
    async fn test_save_and_find_token(pool: PgPool) {
        let token_repo = RefreshTokenRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        // Create a test user first
        let user = user_repo
            .create(&CreateUserDto {
                username: "testtoken".to_string(),
                email: "token@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save refresh token
        let token_hash = "test_hash_123";
        let expires_at = Utc::now() + chrono::Duration::days(7);
        let saved = token_repo.save(user.id, token_hash, expires_at).await.unwrap();

        assert_eq!(saved.user_id, user.id);
        assert_eq!(saved.token_hash, token_hash);

        // Find token
        let found = token_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.id, saved.id);
    }

    #[sqlx::test]
    async fn test_revoke_token(pool: PgPool) {
        let token_repo = RefreshTokenRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        let user = user_repo
            .create(&CreateUserDto {
                username: "testrevoke".to_string(),
                email: "revoke@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save and revoke token
        let token_hash = "test_hash_revoke";
        let expires_at = Utc::now() + chrono::Duration::days(7);
        let _ = token_repo.save(user.id, token_hash, expires_at).await.unwrap();

        token_repo.revoke(token_hash).await.unwrap();

        // Verify token is revoked (revoked_at is set)
        let found = token_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        assert!(found.unwrap().revoked_at.is_some());
    }

    #[sqlx::test]
    async fn test_revoke_all_user_tokens(pool: PgPool) {
        let token_repo = RefreshTokenRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        let user = user_repo
            .create(&CreateUserDto {
                username: "testrevokeall".to_string(),
                email: "revokeall@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Create multiple tokens
        let expires_at = Utc::now() + chrono::Duration::days(7);
        token_repo.save(user.id, "token1", expires_at).await.unwrap();
        token_repo.save(user.id, "token2", expires_at).await.unwrap();

        // Revoke all tokens
        let revoked_count = token_repo.revoke_all_user_tokens(user.id).await.unwrap();
        assert_eq!(revoked_count, 2);
    }

    #[sqlx::test]
    async fn test_transaction_save_and_revoke(pool: PgPool) {
        let token_repo = RefreshTokenRepository::new(pool.clone());
        let user_repo = UserRepository::new(pool);

        let user = user_repo
            .create(&CreateUserDto {
                username: "testtx".to_string(),
                email: "tx@test.com".to_string(),
                password_hash: "hash".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // Save token in transaction
        let mut tx = pool.begin().await.unwrap();
        let token_hash = "tx_token";
        let expires_at = Utc::now() + chrono::Duration::days(7);
        let _ = token_repo
            .save_with_tx(&mut tx, user.id, token_hash, expires_at)
            .await
            .unwrap();

        // Revoke in same transaction
        token_repo.revoke_with_tx(&mut tx, token_hash).await.unwrap();

        tx.commit().await.unwrap();

        // Verify token is revoked
        let found = token_repo.find_by_token(token_hash).await.unwrap();
        assert!(found.is_some());
        assert!(found.unwrap().revoked_at.is_some());
    }
}
