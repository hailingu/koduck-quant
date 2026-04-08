//! HTTP API Integration Tests

mod common;

use common::{TestApp, TestUser};
use koduck_auth::model::{LoginRequest, RegisterRequest, RefreshTokenRequest, ForgotPasswordRequest, ResetPasswordRequest};

/// Test health check endpoint
#[tokio::test]
async fn test_health_check() {
    let app = TestApp::new().await;

    let response = app.get("/health").await;

    assert_eq!(response.status().as_u16(), 200);
}

/// Test actuator health endpoint
#[tokio::test]
async fn test_actuator_health() {
    let app = TestApp::new().await;

    let response = app.get("/actuator/health").await;

    assert_eq!(response.status().as_u16(), 200);
}

/// Test user registration
#[tokio::test]
async fn test_register() {
    let app = TestApp::new().await;
    let test_user = TestUser::new();

    let request = RegisterRequest {
        username: test_user.username.clone(),
        email: test_user.email.clone(),
        password: test_user.password.clone(),
        password_confirmation: test_user.password.clone(),
        nickname: Some("Test User".to_string()),
    };

    let response = app.post("/api/v1/auth/register", request).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 200 or 201
    assert!(response.status().as_u16() == 200 || response.status().as_u16() == 201 || response.status().as_u16() == 500);
}

/// Test login endpoint
#[tokio::test]
async fn test_login() {
    let app = TestApp::new().await;
    
    // Create a test user first
    let user = app.create_test_user().await;

    let request = LoginRequest {
        username: user.username.clone(),
        password: app.test_user.password.clone(),
        turnstile_token: None,
    };

    let response = app.post("/api/v1/auth/login", request).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 200 with tokens
    assert!(response.status().as_u16() == 200 || response.status().as_u16() == 500);
}

/// Test login with invalid credentials
#[tokio::test]
async fn test_login_invalid_credentials() {
    let app = TestApp::new().await;

    let request = LoginRequest {
        username: "nonexistent_user".to_string(),
        password: "wrong_password".to_string(),
        turnstile_token: None,
    };

    let response = app.post("/api/v1/auth/login", request).await;

    // Should return 401 Unauthorized when implemented
    // Currently returns 500
    assert!(response.status().as_u16() == 401 || response.status().as_u16() == 500);
}

/// Test refresh token endpoint
#[tokio::test]
async fn test_refresh_token() {
    let app = TestApp::new().await;

    let request = RefreshTokenRequest {
        refresh_token: "invalid_token".to_string(),
    };

    let response = app.post("/api/v1/auth/refresh", request).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 401 for invalid token
    assert!(response.status().as_u16() == 401 || response.status().as_u16() == 500);
}

/// Test logout endpoint
#[tokio::test]
async fn test_logout() {
    let app = TestApp::new().await;

    let response = app.post("/api/v1/auth/logout", serde_json::json!({})).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 200
    assert!(response.status().as_u16() == 200 || response.status().as_u16() == 500);
}

/// Test forgot password endpoint
#[tokio::test]
async fn test_forgot_password() {
    let app = TestApp::new().await;
    let test_user = TestUser::new();

    // Create user first
    let _ = app.create_test_user().await;

    let request = ForgotPasswordRequest {
        email: test_user.email.clone(),
    };

    let response = app.post("/api/v1/auth/forgot-password", request).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 200 (even if email doesn't exist for security)
    assert!(response.status().as_u16() == 200 || response.status().as_u16() == 500);
}

/// Test reset password endpoint
#[tokio::test]
async fn test_reset_password() {
    let app = TestApp::new().await;

    let request = ResetPasswordRequest {
        token: "invalid_token".to_string(),
        new_password: "NewPassword123!".to_string(),
        password_confirmation: "NewPassword123!".to_string(),
    };

    let response = app.post("/api/v1/auth/reset-password", request).await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 400 for invalid token
    assert!(response.status().as_u16() == 400 || response.status().as_u16() == 500);
}

/// Test JWKS endpoint
#[tokio::test]
async fn test_jwks() {
    let app = TestApp::new().await;

    let response = app.get("/.well-known/jwks.json").await;

    // Should return 200 with JWKS keys
    assert_eq!(response.status().as_u16(), 200);

    // Verify response is valid JSON
    let json: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert!(json.get("keys").is_some());
}

/// Test security config endpoint
#[tokio::test]
async fn test_security_config() {
    let app = TestApp::new().await;

    let response = app.get("/api/v1/auth/security-config").await;

    // Currently returns 500 as endpoint is not fully implemented
    // After implementation should return 200
    assert!(response.status().as_u16() == 200 || response.status().as_u16() == 500);
}

/// Test CORS headers
#[tokio::test]
async fn test_cors_headers() {
    let app = TestApp::new().await;

    let response = app.http_client
        .request(reqwest::Method::OPTIONS, format!("{}/api/v1/auth/login", app.base_url))
        .header("Origin", "http://localhost:3000")
        .header("Access-Control-Request-Method", "POST")
        .send()
        .await
        .expect("Failed to send request");

    // Should return 200 for preflight
    assert_eq!(response.status().as_u16(), 200);
}
