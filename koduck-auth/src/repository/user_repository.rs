//! User repository

use crate::{
    error::{AppError, Result},
    model::{CreateUserDto, UpdateUserDto, User, UserStatus},
};
use sqlx::{PgPool, Postgres, Transaction};

/// User repository
#[derive(Debug, Clone)]
pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    /// Create new user repository
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Find user by ID
    pub async fn find_by_id(&self, id: i64) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, nickname, avatar_url,
                   status, email_verified, last_login_at, created_at, updated_at
            FROM users
            WHERE id = $1 AND status != 'DELETED'
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(user)
    }

    /// Find user by username
    pub async fn find_by_username(&self, username: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, nickname, avatar_url,
                   status, email_verified, last_login_at, created_at, updated_at
            FROM users
            WHERE username = $1 AND status != 'DELETED'
            "#,
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(user)
    }

    /// Find user by email
    pub async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, nickname, avatar_url,
                   status, email_verified, last_login_at, created_at, updated_at
            FROM users
            WHERE email = $1 AND status != 'DELETED'
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(user)
    }

    /// Find user by username or email
    pub async fn find_by_username_or_email(&self, identifier: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, username, email, password_hash, nickname, avatar_url,
                   status, email_verified, last_login_at, created_at, updated_at
            FROM users
            WHERE (username = $1 OR email = $1) AND status != 'DELETED'
            "#,
        )
        .bind(identifier)
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(user)
    }

    /// Create new user
    pub async fn create(&self, dto: &CreateUserDto) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, email, password_hash, nickname, status, email_verified)
            VALUES ($1, $2, $3, $4, 'ACTIVE', false)
            RETURNING id, username, email, password_hash, nickname, avatar_url,
                      status, email_verified, last_login_at, created_at, updated_at
            "#,
        )
        .bind(&dto.username)
        .bind(&dto.email)
        .bind(&dto.password_hash)
        .bind(&dto.nickname)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                AppError::Conflict("Username or email already exists".to_string())
            }
            _ => AppError::Database(e),
        })?;

        Ok(user)
    }

    /// Update user
    pub async fn update(&self, id: i64, dto: &UpdateUserDto) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET nickname = COALESCE($2, nickname),
                avatar_url = COALESCE($3, avatar_url),
                updated_at = NOW()
            WHERE id = $1 AND status != 'DELETED'
            RETURNING id, username, email, password_hash, nickname, avatar_url,
                      status, email_verified, last_login_at, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(&dto.nickname)
        .bind(&dto.avatar_url)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound("User not found".to_string()),
            _ => AppError::Database(e),
        })?;

        Ok(user)
    }

    /// Update last login time
    pub async fn update_last_login(&self, id: i64) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET last_login_at = NOW(), updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Update password
    pub async fn update_password(&self, id: i64, password_hash: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET password_hash = $2, updated_at = NOW()
            WHERE id = $1 AND status != 'DELETED'
            "#,
        )
        .bind(id)
        .bind(password_hash)
        .execute(&self.pool)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound("User not found".to_string()),
            _ => AppError::Database(e),
        })?;

        Ok(())
    }

    /// Update user status
    pub async fn update_status(&self, id: i64, status: UserStatus) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(status)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Get user roles
    pub async fn get_user_roles(&self, user_id: i64) -> Result<Vec<String>> {
        let roles = sqlx::query_scalar::<_, String>(
            r#"
            SELECT r.name
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(roles)
    }

    /// Assign role to user
    pub async fn assign_role(&self, user_id: i64, role_name: &str) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_roles (user_id, role_id)
            SELECT $1, id FROM roles WHERE name = $2
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(role_name)
        .execute(&self.pool)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    // ============== Transaction Methods ==============

    /// Create new user within a transaction
    pub async fn create_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        dto: &CreateUserDto,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (username, email, password_hash, nickname, status, email_verified)
            VALUES ($1, $2, $3, $4, 'ACTIVE', false)
            RETURNING id, username, email, password_hash, nickname, avatar_url,
                      status, email_verified, last_login_at, created_at, updated_at
            "#,
        )
        .bind(&dto.username)
        .bind(&dto.email)
        .bind(&dto.password_hash)
        .bind(&dto.nickname)
        .fetch_one(&mut **tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                AppError::Conflict("Username or email already exists".to_string())
            }
            _ => AppError::Database(e),
        })?;

        Ok(user)
    }

    /// Assign role to user within a transaction
    pub async fn assign_role_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        user_id: i64,
        role_name: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_roles (user_id, role_id)
            SELECT $1, id FROM roles WHERE name = $2
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(role_name)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;

        Ok(())
    }

    /// Update password within a transaction
    pub async fn update_password_with_tx(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: i64,
        password_hash: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET password_hash = $2, updated_at = NOW()
            WHERE id = $1 AND status != 'DELETED'
            "#,
        )
        .bind(id)
        .bind(password_hash)
        .execute(&mut **tx)
        .await
        .map_err(|e| match e {
            sqlx::Error::RowNotFound => AppError::NotFound("User not found".to_string()),
            _ => AppError::Database(e),
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::CreateUserDto;

    // Helper function to create test user DTO
    fn test_user_dto(suffix: &str) -> CreateUserDto {
        CreateUserDto {
            username: format!("testuser{}", suffix),
            email: format!("test{}@example.com", suffix),
            password_hash: "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$hash".to_string(),
            nickname: Some(format!("Test User {}", suffix)),
        }
    }

    #[sqlx::test]
    async fn test_create_user(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("1");

        let user = repo.create(&dto).await.unwrap();

        assert_eq!(user.username, dto.username);
        assert_eq!(user.email, dto.email);
        assert_eq!(user.status, UserStatus::Active);
    }

    #[sqlx::test]
    async fn test_find_by_id(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("2");

        let created = repo.create(&dto).await.unwrap();
        let found = repo.find_by_id(created.id).await.unwrap();

        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.id, created.id);
        assert_eq!(found.username, dto.username);
    }

    #[sqlx::test]
    async fn test_find_by_username(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("3");

        let created = repo.create(&dto).await.unwrap();
        let found = repo.find_by_username(&dto.username).await.unwrap();

        assert!(found.is_some());
        assert_eq!(found.unwrap().id, created.id);
    }

    #[sqlx::test]
    async fn test_find_by_email(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("4");

        let created = repo.create(&dto).await.unwrap();
        let found = repo.find_by_email(&dto.email).await.unwrap();

        assert!(found.is_some());
        assert_eq!(found.unwrap().id, created.id);
    }

    #[sqlx::test]
    async fn test_create_duplicate_user(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("5");

        // First create should succeed
        let _ = repo.create(&dto).await.unwrap();

        // Second create with same username should fail
        let result = repo.create(&dto).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Conflict(_)));
    }

    #[sqlx::test]
    async fn test_assign_role(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("6");

        let user = repo.create(&dto).await.unwrap();

        // Assign USER role (should exist from migrations)
        repo.assign_role(user.id, "USER").await.unwrap();

        let roles = repo.get_user_roles(user.id).await.unwrap();
        assert!(roles.contains(&"USER".to_string()));
    }

    #[sqlx::test]
    async fn test_transaction_create_and_assign_role(pool: PgPool) {
        let repo = UserRepository::new(pool);
        let dto = test_user_dto("7");

        // Start transaction
        let mut tx = pool.begin().await.unwrap();

        // Create user in transaction
        let user = repo.create_with_tx(&mut tx, &dto).await.unwrap();

        // Assign role in same transaction
        repo.assign_role_with_tx(&mut tx, user.id, "USER").await.unwrap();

        // Commit transaction
        tx.commit().await.unwrap();

        // Verify both operations succeeded
        let found = repo.find_by_id(user.id).await.unwrap();
        assert!(found.is_some());

        let roles = repo.get_user_roles(user.id).await.unwrap();
        assert!(roles.contains(&"USER".to_string()));
    }
}
