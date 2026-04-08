//! Auth handlers

use axum::{
    extract::{ConnectInfo, State},
    http::{header::USER_AGENT, HeaderMap},
    Json,
};
use std::net::SocketAddr;
use std::sync::Arc;
use validator::Validate;

use crate::{
    error::Result,
    model::{
        ApiResponse, ForgotPasswordRequest, LoginRequest, LogoutRequest,
        RefreshTokenRequest, RegisterRequest, ResetPasswordRequest,
        SecurityConfigResponse, TokenResponse,
    },
    repository::{PasswordResetRepository, RedisCache, RefreshTokenRepository, UserRepository},
    service::AuthService as AuthServiceImpl,
    state::AppState,
};

fn build_auth_service(state: &AppState) -> Result<AuthServiceImpl> {
    let user_repo = UserRepository::new(state.db_pool().clone());
    let token_repo = RefreshTokenRepository::new(state.db_pool().clone());
    let password_reset_repo = PasswordResetRepository::new(state.db_pool().clone());
    let redis = RedisCache::new(state.redis_pool().clone());
    let config = Arc::new(state.config().clone());

    AuthServiceImpl::new(
        user_repo,
        token_repo,
        password_reset_repo,
        redis,
        state.jwt_service().clone(),
        state.db_pool().clone(),
        config,
    )
}

/// Login handler
pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    req.validate()?;

    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();

    let auth_service = build_auth_service(&state)?;
    let token_response = auth_service.login(req, ip, user_agent).await?;

    Ok(Json(ApiResponse::success(token_response)))
}

/// Register handler
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    req.validate()?;

    let auth_service = build_auth_service(&state)?;
    let token_response = auth_service.register(req).await?;

    Ok(Json(ApiResponse::success(token_response)))
}

/// Refresh token handler
pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshTokenRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    req.validate()?;

    let auth_service = build_auth_service(&state)?;
    let token_response = auth_service.refresh_token(req).await?;

    Ok(Json(ApiResponse::success(token_response)))
}

/// Logout handler
pub async fn logout(
    State(state): State<Arc<AppState>>,
    Json(req): Json<Option<LogoutRequest>>,
) -> Result<Json<ApiResponse<()>>> {
    let auth_service = build_auth_service(&state)?;
    let refresh_token = req.and_then(|r| r.refresh_token);
    auth_service.logout(refresh_token, 0).await?;

    Ok(Json(ApiResponse::success(())))
}

/// Security config handler
pub async fn security_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<SecurityConfigResponse>>> {
    let auth_service = build_auth_service(&state)?;
    let config = auth_service.get_security_config().await?;
    Ok(Json(ApiResponse::success(config)))
}

/// Forgot password handler
pub async fn forgot_password(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<ForgotPasswordRequest>,
) -> Result<Json<ApiResponse<()>>> {
    req.validate()?;

    let auth_service = build_auth_service(&state)?;
    auth_service
        .forgot_password(req, addr.ip().to_string())
        .await?;

    Ok(Json(ApiResponse::success(())))
}

/// Reset password handler
pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<ApiResponse<()>>> {
    req.validate()?;

    let auth_service = build_auth_service(&state)?;
    auth_service.reset_password(req).await?;

    Ok(Json(ApiResponse::success(())))
}
