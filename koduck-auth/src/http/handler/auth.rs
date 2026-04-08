//! Auth handlers

use axum::{
    extract::{ConnectInfo, State},
    http::{header::USER_AGENT, HeaderMap},
    Json,
};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::{
    error::{AppError, Result},
    model::{
        ApiResponse, ForgotPasswordRequest, LoginRequest, LogoutRequest,
        RefreshTokenRequest, RegisterRequest, ResetPasswordRequest,
        SecurityConfigResponse, TokenResponse,
    },
    state::AppState,
};

/// Login handler
pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    // TODO: Implement login logic using auth service
    let _ = (state, req, ip, user_agent);

    Err(AppError::Internal("Not implemented".to_string()))
}

/// Register handler
pub async fn register(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    // TODO: Implement register logic
    Err(AppError::Internal("Not implemented".to_string()))
}

/// Refresh token handler
pub async fn refresh_token(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<RefreshTokenRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    // TODO: Implement refresh token logic
    Err(AppError::Internal("Not implemented".to_string()))
}

/// Logout handler
pub async fn logout(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<Option<LogoutRequest>>,
) -> Result<Json<ApiResponse<()>>> {
    // TODO: Implement logout logic
    Err(AppError::Internal("Not implemented".to_string()))
}

/// Security config handler
pub async fn security_config(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<SecurityConfigResponse>>> {
    // TODO: Implement security config logic
    Err(AppError::Internal("Not implemented".to_string()))
}

/// Forgot password handler
pub async fn forgot_password(
    State(_state): State<Arc<AppState>>,
    ConnectInfo(_addr): ConnectInfo<SocketAddr>,
    Json(_req): Json<ForgotPasswordRequest>,
) -> Result<Json<ApiResponse<()>>> {
    // TODO: Implement forgot password logic
    Err(AppError::Internal("Not implemented".to_string()))
}

/// Reset password handler
pub async fn reset_password(
    State(_state): State<Arc<AppState>>,
    Json(_req): Json<ResetPasswordRequest>,
) -> Result<Json<ApiResponse<()>>> {
    // TODO: Implement reset password logic
    Err(AppError::Internal("Not implemented".to_string()))
}
