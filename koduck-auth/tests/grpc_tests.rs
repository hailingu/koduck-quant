//! gRPC Integration Tests

mod common;

use common::TestApp;
use koduck_auth::grpc::proto::{
    auth_service_client::AuthServiceClient,
    token_service_client::TokenServiceClient,
    ValidateCredentialsRequest, ValidateTokenRequest, GetUserRequest,
    get_user_request, RevokeTokenRequest, HealthCheckRequest,
};
use tonic::transport::Channel;

/// Helper function to create gRPC auth client
async fn create_auth_client(app: &TestApp) -> AuthServiceClient<Channel> {
    // For now, we test without actual gRPC server running
    // In full integration tests, this would connect to a running server
    let channel = Channel::from_static("http://127.0.0.1:50051")
        .connect()
        .await
        .expect("Failed to connect to gRPC server");
    
    AuthServiceClient::new(channel)
}

/// Helper function to create gRPC token client
async fn create_token_client(app: &TestApp) -> TokenServiceClient<Channel> {
    let channel = Channel::from_static("http://127.0.0.1:50051")
        .connect()
        .await
        .expect("Failed to connect to gRPC server");
    
    TokenServiceClient::new(channel)
}

/// Test gRPC health check
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_grpc_health_check() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(HealthCheckRequest {});
    let response = client.health_check(request).await;

    // Should return serving status
    assert!(response.is_ok());
    let response = response.unwrap();
    assert_eq!(response.into_inner().status, 1); // SERVING = 1
}

/// Test ValidateCredentials with valid credentials
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_validate_credentials_success() {
    let app = TestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(ValidateCredentialsRequest {
        username: user.username,
        password: app.test_user.password,
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test".to_string(),
    });

    let response = client.validate_credentials(request).await;

    assert!(response.is_ok());
    let response = response.unwrap().into_inner();
    assert!(response.user.is_some());
    assert!(response.tokens.is_some());
}

/// Test ValidateCredentials with invalid credentials
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_validate_credentials_invalid() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(ValidateCredentialsRequest {
        username: "nonexistent".to_string(),
        password: "wrong".to_string(),
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test".to_string(),
    });

    let response = client.validate_credentials(request).await;

    assert!(response.is_err());
    let status = response.unwrap_err();
    assert_eq!(status.code(), tonic::Code::Unauthenticated);
}

/// Test ValidateToken with valid token
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_validate_token_success() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    // First get a valid token through credentials validation
    let user = app.create_test_user().await;
    let creds_request = tonic::Request::new(ValidateCredentialsRequest {
        username: user.username.clone(),
        password: app.test_user.password.clone(),
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test".to_string(),
    });

    let creds_response = client.validate_credentials(creds_request).await.unwrap();
    let access_token = creds_response.into_inner().tokens.unwrap().access_token;

    // Now validate the token
    let token_request = tonic::Request::new(ValidateTokenRequest {
        token: access_token,
    });

    let response = client.validate_token(token_request).await;

    assert!(response.is_ok());
    let response = response.unwrap().into_inner();
    assert_eq!(response.username, user.username);
}

/// Test ValidateToken with invalid token
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_validate_token_invalid() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(ValidateTokenRequest {
        token: "invalid.token.here".to_string(),
    });

    let response = client.validate_token(request).await;

    assert!(response.is_err());
    let status = response.unwrap_err();
    assert_eq!(status.code(), tonic::Code::Unauthenticated);
}

/// Test GetUser by user_id
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_get_user_by_id() {
    let app = TestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(GetUserRequest {
        identifier: Some(get_user_request::Identifier::UserId(user.id)),
    });

    let response = client.get_user(request).await;

    assert!(response.is_ok());
    let response = response.unwrap().into_inner();
    assert!(response.user.is_some());
    assert_eq!(response.user.unwrap().id, user.id);
}

/// Test GetUser by username
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_get_user_by_username() {
    let app = TestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(GetUserRequest {
        identifier: Some(get_user_request::Identifier::Username(user.username.clone())),
    });

    let response = client.get_user(request).await;

    assert!(response.is_ok());
    let response = response.unwrap().into_inner();
    assert!(response.user.is_some());
    assert_eq!(response.user.unwrap().username, user.username);
}

/// Test GetUser with non-existent user
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_get_user_not_found() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    let request = tonic::Request::new(GetUserRequest {
        identifier: Some(get_user_request::Identifier::Username("nonexistent".to_string())),
    });

    let response = client.get_user(request).await;

    assert!(response.is_err());
    let status = response.unwrap_err();
    assert_eq!(status.code(), tonic::Code::NotFound);
}

/// Test RevokeToken
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_revoke_token() {
    let app = TestApp::new().await;
    let mut client = create_auth_client(&app).await;

    let user = app.create_test_user().await;

    // First get a valid token
    let creds_request = tonic::Request::new(ValidateCredentialsRequest {
        username: user.username.clone(),
        password: app.test_user.password.clone(),
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test".to_string(),
    });

    let creds_response = client.validate_credentials(creds_request).await.unwrap();
    let access_token = creds_response.into_inner().tokens.unwrap().access_token;

    // Revoke the token
    let revoke_request = tonic::Request::new(RevokeTokenRequest {
        token: access_token.clone(),
        user_id: user.id,
    });

    let response = client.revoke_token(revoke_request).await;
    assert!(response.is_ok());

    // Verify token is revoked by trying to validate it again
    let validate_request = tonic::Request::new(ValidateTokenRequest {
        token: access_token,
    });

    let response = client.validate_token(validate_request).await;
    assert!(response.is_err());
}

/// Test TokenService introspection
#[tokio::test]
#[ignore = "Requires running gRPC server"]
async fn test_token_introspection() {
    let app = TestApp::new().await;
    let mut auth_client = create_auth_client(&app).await;
    let mut token_client = create_token_client(&app).await;

    let user = app.create_test_user().await;

    // Get a token
    let creds_request = tonic::Request::new(ValidateCredentialsRequest {
        username: user.username.clone(),
        password: app.test_user.password.clone(),
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test".to_string(),
    });

    let creds_response = auth_client.validate_credentials(creds_request).await.unwrap();
    let access_token = creds_response.into_inner().tokens.unwrap().access_token;

    // Introspect the token
    use koduck_auth::grpc::proto::IntrospectTokenRequest;
    
    let introspect_request = tonic::Request::new(IntrospectTokenRequest {
        token: access_token,
    });

    let response = token_client.introspect_access_token(introspect_request).await;

    assert!(response.is_ok());
    let response = response.unwrap().into_inner();
    assert!(response.active);
    assert_eq!(response.username, user.username);
}
