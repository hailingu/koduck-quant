//! Type converters between proto and internal models

use crate::grpc::proto;
use crate::model::{TokenType, UserInfo, UserStatus};

// UserStatus <-> proto::UserStatus
impl From<UserStatus> for proto::UserStatus {
    fn from(status: UserStatus) -> Self {
        match status {
            UserStatus::Active => proto::UserStatus::Active,
            UserStatus::Inactive => proto::UserStatus::Inactive,
            UserStatus::Locked => proto::UserStatus::Locked,
            UserStatus::Deleted => proto::UserStatus::Deleted,
        }
    }
}

impl From<proto::UserStatus> for UserStatus {
    fn from(status: proto::UserStatus) -> Self {
        match status {
            proto::UserStatus::Active => UserStatus::Active,
            proto::UserStatus::Inactive => UserStatus::Inactive,
            proto::UserStatus::Locked => UserStatus::Locked,
            proto::UserStatus::Deleted => UserStatus::Deleted,
            proto::UserStatus::Unspecified => UserStatus::Active, // Default
        }
    }
}

// TokenType <-> proto::TokenType
impl From<TokenType> for proto::TokenType {
    fn from(token_type: TokenType) -> Self {
        match token_type {
            TokenType::Access => proto::TokenType::Access,
            TokenType::Refresh => proto::TokenType::Refresh,
        }
    }
}

impl From<proto::TokenType> for TokenType {
    fn from(token_type: proto::TokenType) -> Self {
        match token_type {
            proto::TokenType::Access => TokenType::Access,
            proto::TokenType::Refresh => TokenType::Refresh,
            proto::TokenType::Unspecified => TokenType::Access, // Default
        }
    }
}

// UserInfo <-> proto::UserInfo
impl From<UserInfo> for proto::UserInfo {
    fn from(user: UserInfo) -> Self {
        use prost_types::Timestamp;
        let now = Timestamp {
            seconds: chrono::Utc::now().timestamp(),
            nanos: 0,
        };
        
        proto::UserInfo {
            id: user.id,
            username: user.username,
            email: user.email,
            nickname: user.nickname.unwrap_or_default(),
            avatar_url: user.avatar_url.unwrap_or_default(),
            status: proto::UserStatus::from(user.status) as i32,
            email_verified: user.email_verified,
            created_at: Some(now.clone()),
            updated_at: Some(now),
        }
    }
}

impl From<proto::UserInfo> for UserInfo {
    fn from(user: proto::UserInfo) -> Self {
        UserInfo {
            id: user.id,
            username: user.username,
            email: user.email,
            nickname: if user.nickname.is_empty() {
                None
            } else {
                Some(user.nickname)
            },
            avatar_url: if user.avatar_url.is_empty() {
                None
            } else {
                Some(user.avatar_url)
            },
            status: UserStatus::from(proto::UserStatus::try_from(user.status).unwrap_or_default()),
            email_verified: user.email_verified,
        }
    }
}
