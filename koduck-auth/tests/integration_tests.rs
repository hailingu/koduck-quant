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
        confirm_password: test_user.password.clone(),
        nickname: Some("Test User".to_string()),
        turnstile_token: None,
    };

    let response = app.post("/api/v1/auth/register", request).await;
    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
    assert!(body["data"]["tokens"]["access_token"].as_str().is_some());
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
    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
    assert!(body["data"]["tokens"]["access_token"].as_str().is_some());
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
    assert_eq!(response.status().as_u16(), 401);
}

/// Test refresh token endpoint
#[tokio::test]
async fn test_refresh_token() {
    let app = TestApp::new().await;
    let user = app.create_test_user().await;

    let login_response = app
        .post(
            "/api/v1/auth/login",
            LoginRequest {
                username: user.username.clone(),
                password: app.test_user.password.clone(),
                turnstile_token: None,
            },
        )
        .await;
    assert_eq!(login_response.status().as_u16(), 200);
    let login_body: serde_json::Value = login_response
        .json()
        .await
        .expect("Failed to parse login response");
    let refresh_token = login_body["data"]["tokens"]["refresh_token"]
        .as_str()
        .expect("refresh token missing")
        .to_string();

    let response = app
        .post(
            "/api/v1/auth/refresh",
            RefreshTokenRequest { refresh_token },
        )
        .await;

    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
    assert!(body["data"]["tokens"]["access_token"].as_str().is_some());
}

/// Test refresh token with invalid token
#[tokio::test]
async fn test_refresh_token_invalid() {
    let app = TestApp::new().await;

    let response = app
        .post(
            "/api/v1/auth/refresh",
            RefreshTokenRequest {
                refresh_token: "invalid_token".to_string(),
            },
        )
        .await;

    assert_eq!(response.status().as_u16(), 401);
}

/// Test logout endpoint
#[tokio::test]
async fn test_logout() {
    let app = TestApp::new().await;
    let user = app.create_test_user().await;

    let login_response = app
        .post(
            "/api/v1/auth/login",
            LoginRequest {
                username: user.username.clone(),
                password: app.test_user.password.clone(),
                turnstile_token: None,
            },
        )
        .await;
    assert_eq!(login_response.status().as_u16(), 200);
    let login_body: serde_json::Value = login_response
        .json()
        .await
        .expect("Failed to parse login response");
    let refresh_token = login_body["data"]["tokens"]["refresh_token"]
        .as_str()
        .expect("refresh token missing")
        .to_string();

    let response = app
        .post(
            "/api/v1/auth/logout",
            serde_json::json!({ "refresh_token": refresh_token }),
        )
        .await;

    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
}

/// Test forgot password endpoint
#[tokio::test]
async fn test_forgot_password() {
    let app = TestApp::new().await;
    let _ = app.create_test_user().await;

    let request = ForgotPasswordRequest {
        email: app.test_user.email.clone(),
    };

    let response = app.post("/api/v1/auth/forgot-password", request).await;
    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
}

/// Test reset password endpoint
#[tokio::test]
async fn test_reset_password() {
    let app = TestApp::new().await;

    let request = ResetPasswordRequest {
        token: "invalid_token".to_string(),
        new_password: "NewPassword123!".to_string(),
        confirm_password: "NewPassword123!".to_string(),
    };

    let response = app.post("/api/v1/auth/reset-password", request).await;
    assert_eq!(response.status().as_u16(), 401);
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
    assert!(
        json["keys"].as_array().map(|k| !k.is_empty()).unwrap_or(false),
        "JWKS keys should not be empty"
    );
}

/// Test security config endpoint
#[tokio::test]
async fn test_security_config() {
    let app = TestApp::new().await;

    let response = app.get("/api/v1/auth/security-config").await;
    assert_eq!(response.status().as_u16(), 200);
    let body: serde_json::Value = response.json().await.expect("Failed to parse JSON");
    assert_eq!(body["success"], true);
    assert!(body["data"]["password_policy"].is_object());
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

    assert!(
        response.status().is_success(),
        "CORS preflight should return success status, got {}",
        response.status()
    );
    assert!(response.headers().contains_key("access-control-allow-origin"));
}
