//! User model definitions

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// User status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserStatus {
    Active,
    Inactive,
    Locked,
    Deleted,
}

impl Default for UserStatus {
    fn default() -> Self {
        UserStatus::Active
    }
}

/// User entity
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub status: UserStatus,
    pub email_verified: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// User info for API responses (without sensitive fields)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: i64,
    pub tenant_id: String,
    pub username: String,
    pub email: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub status: UserStatus,
    pub email_verified: bool,
}

impl From<User> for UserInfo {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            tenant_id: "default".to_string(),
            username: user.username,
            email: user.email,
            nickname: user.nickname,
            avatar_url: user.avatar_url,
            status: user.status,
            email_verified: user.email_verified,
        }
    }
}

/// Create user DTO
#[derive(Debug, Deserialize)]
pub struct CreateUserDto {
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub nickname: Option<String>,
}

/// Update user DTO
#[derive(Debug, Deserialize)]
pub struct UpdateUserDto {
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
}

/// Permission entity
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Permission {
    pub id: i64,
    pub name: String,
    pub resource: String,
    pub action: String,
}
