//! Test application helper

use koduck_auth::{
    config::Config,
    grpc::proto::{auth_service_client::AuthServiceClient, HealthCheckRequest},
    http::create_router,
    init_state,
    repository::UserRepository,
};
use sqlx::PgPool;
use std::sync::Arc;
use testcontainers::{clients::Cli, images::postgres::Postgres, Container};

/// Test user credentials
#[derive(Debug, Clone)]
pub struct TestUser {
    pub username: String,
    pub email: String,
    pub password: String,
}

impl TestUser {
    pub fn new() -> Self {
        Self {
            username: format!("testuser_{}", uuid::Uuid::new_v4()),
            email: format!("test_{}@example.com", uuid::Uuid::new_v4()),
            password: "TestPassword123!".to_string(),
        }
    }
}

/// Test application wrapper
pub struct TestApp {
    pub db_pool: PgPool,
    pub user_repo: UserRepository,
    pub http_client: reqwest::Client,
    pub base_url: String,
    pub test_user: TestUser,
    _container: Container<'static, Postgres>,
}

impl TestApp {
    /// Create new test application with test database
    pub async fn new() -> Self {
        // Initialize tracing
        let _ = tracing_subscriber::fmt()
            .with_env_filter("debug")
            .try_init();

        // Start PostgreSQL container
        let docker = Cli::default();
        let container = docker.run(Postgres::default());

        // Get connection string
        let port = container.get_host_port_ipv4(5432);
        let database_url = format!(
            "postgres://postgres:postgres@127.0.0.1:{}/postgres",
            port
        );

        // Create database pool
        let db_pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&db_pool)
            .await
            .expect("Failed to run migrations");

        // Create user repository
        let user_repo = UserRepository::new(db_pool.clone());

        // Create HTTP client
        let http_client = reqwest::Client::new();

        // Create test user
        let test_user = TestUser::new();

        TestApp {
            db_pool,
            user_repo,
            http_client,
            base_url: "http://localhost:8081".to_string(),
            test_user,
            _container: container,
        }
    }

    /// Create a test user in the database
    pub async fn create_test_user(&self) -> koduck_auth::model::User {
        use koduck_auth::crypto::hash_password;
        use koduck_auth::model::CreateUserDto;

        let password_hash = hash_password(&self.test_user.password)
            .expect("Failed to hash password");

        let dto = CreateUserDto {
            username: self.test_user.username.clone(),
            email: self.test_user.email.clone(),
            password_hash,
            nickname: Some("Test User".to_string()),
        };

        self.user_repo
            .create(&dto)
            .await
            .expect("Failed to create test user")
    }

    /// HTTP request helpers
    pub async fn post<T: serde::Serialize>(
        &self,
        path: &str,
        body: T,
    ) -> reqwest::Response {
        self.http_client
            .post(format!("{}{}", self.base_url, path))
            .json(&body)
            .send()
            .await
            .expect("Failed to send request")
    }

    pub async fn get(&self, path: &str) -> reqwest::Response {
        self.http_client
            .get(format!("{}{}", self.base_url, path))
            .send()
            .await
            .expect("Failed to send request")
    }
}

/// Test app with HTTP server running
pub struct TestAppWithServer {
    pub app: TestApp,
    pub server_handle: tokio::task::JoinHandle<()>,
}

impl TestAppWithServer {
    pub async fn new() -> Self {
        use axum::Serve;
        use tokio::net::TcpListener;

        let app = TestApp::new().await;
        let pool = app.db_pool.clone();

        // Create config with test settings
        let mut config = Config::from_env().expect("Failed to load config");
        config.server.http_addr = "127.0.0.1:0".to_string(); // Random port

        // Create state
        let state = init_state(config).await.expect("Failed to create state");

        // Create router
        let router = create_router(Arc::new(state));

        // Start server on random port
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("Failed to bind");
        let port = listener.local_addr().unwrap().port();

        let server_handle = tokio::spawn(async move {
            Serve::new(listener, router)
                .await
                .expect("Server failed");
        });

        // Update base URL with actual port
        let mut app = app;
        app.base_url = format!("http://127.0.0.1:{}", port);

        TestAppWithServer {
            app,
            server_handle,
        }
    }
}
