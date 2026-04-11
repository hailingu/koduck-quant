//! HTTP request DTOs

use serde::{Deserialize, Serialize};
use validator::Validate;

/// Login request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct LoginRequest {
    #[validate(length(min = 3, max = 100, message = "Username must be 3-100 characters"))]
    pub username: String, // Can be username or email
    
    #[validate(length(min = 6, max = 100, message = "Password must be 6-100 characters"))]
    pub password: String,

    #[validate(length(min = 1, max = 128, message = "tenant_id must be 1-128 characters"))]
    pub tenant_id: Option<String>,

    pub turnstile_token: Option<String>,
}

/// Register request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 50, message = "Username must be 3-50 characters"))]
    #[validate(regex(path = "crate::model::USERNAME_REGEX", message = "Username can only contain letters, numbers, and underscores"))]
    pub username: String,
    
    #[validate(email(message = "Invalid email format"))]
    #[validate(length(max = 100, message = "Email must not exceed 100 characters"))]
    pub email: String,
    
    #[validate(length(min = 6, max = 100, message = "Password must be 6-100 characters"))]
    pub password: String,
    
    #[validate(must_match(other = "password", message = "Passwords do not match"))]
    pub confirm_password: String,
    
    #[validate(length(max = 50, message = "Nickname must not exceed 50 characters"))]
    pub nickname: Option<String>,
    
    pub turnstile_token: Option<String>,
}

/// Refresh token request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct RefreshTokenRequest {
    #[validate(length(min = 1, message = "Refresh token is required"))]
    pub refresh_token: String,
}

/// Logout request
#[derive(Debug, Deserialize, Serialize)]
pub struct LogoutRequest {
    pub refresh_token: Option<String>,
}

/// Forgot password request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct ForgotPasswordRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
}

/// Reset password request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct ResetPasswordRequest {
    #[validate(length(min = 1, message = "Token is required"))]
    pub token: String,
    
    #[validate(length(min = 6, max = 100, message = "Password must be 6-100 characters"))]
    pub new_password: String,
    
    #[validate(must_match(other = "new_password", message = "Passwords do not match"))]
    pub confirm_password: String,
}

/// Username regex pattern
pub static USERNAME_REGEX: once_cell::sync::Lazy<regex::Regex> = 
    once_cell::sync::Lazy::new(|| {
        regex::Regex::new(r"^[a-zA-Z0-9_]+$").unwrap()
    });

/// Change password request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    
    #[validate(length(min = 6, max = 100, message = "Password must be 6-100 characters"))]
    pub new_password: String,
    
    #[validate(must_match(other = "new_password", message = "Passwords do not match"))]
    pub confirm_password: String,
}

/// Update profile request
#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct UpdateProfileRequest {
    #[validate(length(max = 50, message = "Nickname must not exceed 50 characters"))]
    pub nickname: Option<String>,
    
    #[validate(length(max = 255, message = "Avatar URL must not exceed 255 characters"))]
    pub avatar_url: Option<String>,
}
