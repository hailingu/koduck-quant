//! HTTP test application wrapper built on shared runtime harness.

use super::harness::{HttpServerHandle, TestRuntime, TestUser};
use sqlx::PgPool;

/// Test application wrapper
pub struct TestApp {
    pub db_pool: PgPool,
    pub user_repo: koduck_auth::repository::UserRepository,
    pub http_client: reqwest::Client,
    pub base_url: String,
    pub test_user: TestUser,
    runtime: TestRuntime,
    _http_server: HttpServerHandle,
}

impl TestApp {
    /// Create new isolated HTTP test app.
    pub async fn new() -> Self {
        let runtime = TestRuntime::new().await;
        let http_server = runtime.start_http_server().await;

        Self {
            db_pool: runtime.state.db_pool().clone(),
            user_repo: runtime.user_repo.clone(),
            http_client: reqwest::Client::new(),
            base_url: http_server.base_url.clone(),
            test_user: runtime.test_user.clone(),
            runtime,
            _http_server: http_server,
        }
    }

    /// Create a test user in the database
    pub async fn create_test_user(&self) -> koduck_auth::model::User {
        self.runtime.create_test_user().await
    }

    /// HTTP request helpers
    pub async fn post<T: serde::Serialize>(&self, path: &str, body: T) -> reqwest::Response {
        self.http_client
            .post(format!("{}{}", self.base_url, path))
            .json(&body)
            .send()
            .await
            .expect("failed to send request")
    }

    pub async fn get(&self, path: &str) -> reqwest::Response {
        self.http_client
            .get(format!("{}{}", self.base_url, path))
            .send()
            .await
            .expect("failed to send request")
    }
}

pub type TestAppWithServer = TestApp;
