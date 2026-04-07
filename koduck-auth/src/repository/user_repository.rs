//! User repository

use crate::{
    error::{AppError, Result},
    model::{CreateUserDto, UpdateUserDto, User, UserStatus},
};
use sqlx::PgPool;

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
}
