//! gRPC Integration Tests (self-contained, CI-friendly)

mod common;

use common::{GrpcServerHandle, TestRuntime};
use koduck_auth::grpc::proto::{
    auth_service_client::AuthServiceClient,
    get_user_request,
    token_service_client::TokenServiceClient,
    GetUserRequest, GetUserRolesRequest, HealthCheckRequest, IntrospectTokenRequest, RevokeTokenRequest,
    ServingStatus, ValidateCredentialsRequest, ValidateTokenRequest,
};
use tonic::transport::Channel;
use tonic_health::pb::{
    health_check_response,
    health_client::HealthClient,
    HealthCheckRequest as TonicHealthCheckRequest,
};

struct GrpcTestApp {
    runtime: TestRuntime,
    _grpc_server: GrpcServerHandle,
}

impl GrpcTestApp {
    async fn new() -> Self {
        let runtime = TestRuntime::new().await;
        let grpc_server = runtime.start_grpc_server().await;
        Self {
            runtime,
            _grpc_server: grpc_server,
        }
    }

    fn grpc_endpoint(&self) -> &str {
        &self._grpc_server.endpoint
    }

    async fn create_test_user(&self) -> koduck_auth::model::User {
        self.runtime.create_test_user().await
    }
}

async fn create_auth_client(endpoint: &str) -> AuthServiceClient<Channel> {
    let channel = Channel::from_shared(endpoint.to_string())
        .expect("invalid grpc endpoint")
        .connect()
        .await
        .expect("failed to connect to gRPC auth service");
    AuthServiceClient::new(channel)
}

async fn create_token_client(endpoint: &str) -> TokenServiceClient<Channel> {
    let channel = Channel::from_shared(endpoint.to_string())
        .expect("invalid grpc endpoint")
        .connect()
        .await
        .expect("failed to connect to gRPC token service");
    TokenServiceClient::new(channel)
}

#[tokio::test]
async fn test_grpc_health_check() {
    let app = GrpcTestApp::new().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;
    let response = client
        .health_check(tonic::Request::new(HealthCheckRequest {}))
        .await
        .expect("health_check failed")
        .into_inner();
    assert_eq!(response.status, ServingStatus::Serving as i32);
}

#[tokio::test]
async fn test_tonic_health_check_registered_services() {
    let app = GrpcTestApp::new().await;
    let channel = Channel::from_shared(app.grpc_endpoint().to_string())
        .expect("invalid grpc endpoint")
        .connect()
        .await
        .expect("failed to connect to grpc health service");
    let mut client = HealthClient::new(channel);

    let auth = client
        .check(tonic::Request::new(TonicHealthCheckRequest {
            service: "koduck.auth.v1.AuthService".to_string(),
        }))
        .await
        .expect("health check for AuthService failed")
        .into_inner();

    assert_eq!(auth.status, health_check_response::ServingStatus::Serving as i32);

    let token = client
        .check(tonic::Request::new(TonicHealthCheckRequest {
            service: "koduck.auth.v1.TokenService".to_string(),
        }))
        .await
        .expect("health check for TokenService failed")
        .into_inner();

    assert_eq!(token.status, health_check_response::ServingStatus::Serving as i32);
}

#[tokio::test]
async fn test_validate_credentials_success() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;

    let response = client
        .validate_credentials(tonic::Request::new(ValidateCredentialsRequest {
            username: user.username.clone(),
            password: app.runtime.test_user.password.clone(),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test".to_string(),
        }))
        .await
        .expect("validate_credentials should succeed")
        .into_inner();

    assert!(response.user.is_some());
    assert!(response.tokens.is_some());
}

#[tokio::test]
async fn test_validate_credentials_invalid() {
    let app = GrpcTestApp::new().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;
    let response = client
        .validate_credentials(tonic::Request::new(ValidateCredentialsRequest {
            username: "nonexistent".to_string(),
            password: "wrong".to_string(),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test".to_string(),
        }))
        .await;
    assert!(response.is_err());
    assert_eq!(response.unwrap_err().code(), tonic::Code::Unauthenticated);
}

#[tokio::test]
async fn test_validate_token_success() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;

    let creds = client
        .validate_credentials(tonic::Request::new(ValidateCredentialsRequest {
            username: user.username.clone(),
            password: app.runtime.test_user.password.clone(),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test".to_string(),
        }))
        .await
        .expect("validate_credentials should succeed")
        .into_inner();

    let access_token = creds.tokens.expect("missing tokens").access_token;
    let response = client
        .validate_token(tonic::Request::new(ValidateTokenRequest { token: access_token }))
        .await
        .expect("validate_token should succeed")
        .into_inner();

    assert_eq!(response.username, user.username);
}

#[tokio::test]
async fn test_get_user_by_username() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;

    let response = client
        .get_user(tonic::Request::new(GetUserRequest {
            identifier: Some(get_user_request::Identifier::Username(user.username.clone())),
        }))
        .await
        .expect("get_user should succeed")
        .into_inner();

    assert!(response.user.is_some());
    assert_eq!(response.user.expect("missing user").username, user.username);
}

#[tokio::test]
async fn test_get_user_roles() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;

    let response = client
        .get_user_roles(tonic::Request::new(GetUserRolesRequest { user_id: user.id }))
        .await
        .expect("get_user_roles should succeed")
        .into_inner();

    assert_eq!(response.user_id, user.id);
}

#[tokio::test]
async fn test_revoke_token_then_validate_fails() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut client = create_auth_client(app.grpc_endpoint()).await;

    let creds = client
        .validate_credentials(tonic::Request::new(ValidateCredentialsRequest {
            username: user.username.clone(),
            password: app.runtime.test_user.password.clone(),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test".to_string(),
        }))
        .await
        .expect("validate_credentials should succeed")
        .into_inner();

    let access_token = creds.tokens.expect("missing tokens").access_token;

    client
        .revoke_token(tonic::Request::new(RevokeTokenRequest {
            token: access_token.clone(),
            user_id: user.id,
        }))
        .await
        .expect("revoke_token should succeed");

    let response = client
        .validate_token(tonic::Request::new(ValidateTokenRequest { token: access_token }))
        .await;
    assert!(response.is_err());
}

#[tokio::test]
async fn test_token_introspection_active() {
    let app = GrpcTestApp::new().await;
    let user = app.create_test_user().await;
    let mut auth_client = create_auth_client(app.grpc_endpoint()).await;
    let mut token_client = create_token_client(app.grpc_endpoint()).await;

    let creds = auth_client
        .validate_credentials(tonic::Request::new(ValidateCredentialsRequest {
            username: user.username.clone(),
            password: app.runtime.test_user.password.clone(),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test".to_string(),
        }))
        .await
        .expect("validate_credentials should succeed")
        .into_inner();

    let access_token = creds.tokens.expect("missing tokens").access_token;

    let introspect = token_client
        .introspect_access_token(tonic::Request::new(IntrospectTokenRequest {
            token: access_token,
        }))
        .await
        .expect("introspection should succeed")
        .into_inner();

    assert!(introspect.active);
    assert_eq!(introspect.username, user.username);
}
