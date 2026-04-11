//! Shared test runtime harness for HTTP and gRPC integration tests.

use koduck_auth::{
    config::{ClientConfig, Config, DatabaseConfig, JwtConfig, RedisConfig, SecurityConfig, ServerConfig},
    crypto::{generate_dev_keys, load_public_key},
    grpc::{
        create_and_run_grpc_server_with_shutdown,
        proto::{auth_service_client::AuthServiceClient, HealthCheckRequest},
    },
    http::create_router,
    init_state,
    jwt::{JwksService, JwtValidator},
    model::CreateUserDto,
    repository::{AuditLogRepository, PasswordResetRepository, RedisCache, RefreshTokenRepository, UserRepository},
    service::{AuthService as AuthServiceImpl, TokenService as TokenServiceImpl},
    AppState,
};
use secrecy::SecretString;
use std::{
    net::{SocketAddr, TcpListener},
    path::PathBuf,
    sync::{Arc, Once},
    time::Duration,
};
use testcontainers::{
    clients::Cli,
    images::{generic::GenericImage, postgres::Postgres},
    Container,
};
use tokio::sync::{broadcast, oneshot};
use tonic::transport::Channel;

static INIT: Once = Once::new();

/// Test user credentials
#[derive(Debug, Clone)]
pub struct TestUser {
    pub username: String,
    pub email: String,
    pub password: String,
}

impl TestUser {
    pub fn new() -> Self {
        let uid = uuid::Uuid::new_v4().to_string().replace('-', "");
        Self {
            username: format!("testuser_{}", uid),
            email: format!("test_{}@example.com", uid),
            password: "TestPassword123!".to_string(),
        }
    }
}

/// HTTP server lifecycle holder.
pub struct HttpServerHandle {
    pub base_url: String,
    shutdown_tx: Option<oneshot::Sender<()>>,
    _server_handle: tokio::task::JoinHandle<()>,
}

impl Drop for HttpServerHandle {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

/// gRPC server lifecycle holder.
pub struct GrpcServerHandle {
    pub endpoint: String,
    shutdown_tx: broadcast::Sender<()>,
    _server_handle: tokio::task::JoinHandle<()>,
}

impl Drop for GrpcServerHandle {
    fn drop(&mut self) {
        let _ = self.shutdown_tx.send(());
    }
}

/// Shared runtime for integration tests.
pub struct TestRuntime {
    _pg_container: Container<'static, Postgres>,
    _redis_container: Container<'static, GenericImage>,
    pub state: Arc<AppState>,
    pub user_repo: UserRepository,
    pub test_user: TestUser,
}

impl TestRuntime {
    pub async fn new() -> Self {
        INIT.call_once(|| {
            let _ = tracing_subscriber::fmt().with_env_filter("debug").try_init();
        });

        let docker: &'static Cli = Box::leak(Box::new(Cli::default()));
        let pg_container = docker.run(Postgres::default());
        let redis_container = docker.run(GenericImage::new("redis", "7-alpine"));

        let pg_port = pg_container.get_host_port_ipv4(5432);
        let redis_port = redis_container.get_host_port_ipv4(6379);
        let db_url = format!("postgres://postgres:postgres@127.0.0.1:{pg_port}/postgres");
        let redis_url = format!("redis://127.0.0.1:{redis_port}");

        let key_dir = std::env::temp_dir().join(format!("koduck-auth-test-keys-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&key_dir).expect("failed to create key dir");
        let private_key_path = key_dir.join("private.pem");
        let public_key_path = key_dir.join("public.pem");
        generate_dev_keys(
            private_key_path.to_string_lossy().as_ref(),
            public_key_path.to_string_lossy().as_ref(),
        )
        .await
        .expect("failed to generate rsa keys");

        let cfg = build_test_config(
            &db_url,
            &redis_url,
            &private_key_path,
            &public_key_path,
            &format!("127.0.0.1:{}", find_free_port()),
            &format!("127.0.0.1:{}", find_free_port()),
            &format!("127.0.0.1:{}", find_free_port()),
        );
        let state = init_state(cfg).await.expect("failed to init app state");
        let user_repo = UserRepository::new(state.db_pool().clone());

        Self {
            _pg_container: pg_container,
            _redis_container: redis_container,
            state,
            user_repo,
            test_user: TestUser::new(),
        }
    }

    pub async fn create_test_user(&self) -> koduck_auth::model::User {
        let password_hash = koduck_auth::crypto::hash_password(&self.test_user.password)
            .await
            .expect("failed to hash password");

        self.user_repo
            .create(&CreateUserDto {
                username: self.test_user.username.clone(),
                email: self.test_user.email.clone(),
                password_hash,
                nickname: Some("Test User".to_string()),
            })
            .await
            .expect("failed to create test user")
    }

    pub async fn start_http_server(&self) -> HttpServerHandle {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("failed to bind http listener");
        let http_port = listener
            .local_addr()
            .expect("failed to read listener addr")
            .port();

        let router = create_router(self.state.clone());
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let server_handle = tokio::spawn(async move {
            axum::serve(
                listener,
                router.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .expect("http server failed");
        });

        let base_url = format!("http://127.0.0.1:{http_port}");
        wait_for_http_ready(&base_url).await;

        HttpServerHandle {
            base_url,
            shutdown_tx: Some(shutdown_tx),
            _server_handle: server_handle,
        }
    }

    pub async fn start_grpc_server(&self) -> GrpcServerHandle {
        let cfg = self.state.config().clone();

        let token_repo = RefreshTokenRepository::new(self.state.db_pool().clone());
        let password_reset_repo = PasswordResetRepository::new(self.state.db_pool().clone());
        let audit_log_repo = AuditLogRepository::new(self.state.db_pool().clone());
        let redis = RedisCache::new(self.state.redis_pool().clone());

        let public_key = load_public_key(&cfg.jwt.public_key_path)
            .await
            .expect("failed to load public key");
        let jwt_validator = JwtValidator::new(&public_key, cfg.jwt.audience.clone(), cfg.jwt.issuer.clone())
            .expect("failed to init jwt validator");
        let jwks_service = JwksService::new(&public_key, cfg.jwt.key_id.clone())
            .expect("failed to init jwks");

        let auth_service_impl = AuthServiceImpl::new(
            self.user_repo.clone(),
            token_repo.clone(),
            password_reset_repo,
            audit_log_repo,
            redis.clone(),
            self.state.jwt_service().clone(),
            self.state.db_pool().clone(),
            Arc::new(cfg),
        )
        .expect("failed to init auth service");
        let token_service_impl = TokenServiceImpl::new(token_repo, redis, jwt_validator);

        let grpc_port = find_free_port();
        let grpc_addr = format!("127.0.0.1:{grpc_port}");
        let grpc_addr_socket: SocketAddr = grpc_addr.parse().expect("invalid grpc addr");
        let endpoint = format!("http://127.0.0.1:{grpc_port}");

        let (shutdown_tx, mut shutdown_rx) = broadcast::channel::<()>(1);
        let user_repo_for_server = self.user_repo.clone();
        let jwt_service_for_server = self.state.jwt_service().clone();

        let server_handle = tokio::spawn(async move {
            let _ = create_and_run_grpc_server_with_shutdown(
                grpc_addr_socket,
                auth_service_impl,
                token_service_impl,
                user_repo_for_server,
                jwks_service,
                jwt_service_for_server,
                async move {
                    let _ = shutdown_rx.recv().await;
                },
            )
            .await;
        });

        wait_for_grpc_ready(grpc_port).await;

        GrpcServerHandle {
            endpoint,
            shutdown_tx,
            _server_handle: server_handle,
        }
    }
}

pub fn build_test_config(
    db_url: &str,
    redis_url: &str,
    private_key_path: &PathBuf,
    public_key_path: &PathBuf,
    http_addr: &str,
    grpc_addr: &str,
    metrics_addr: &str,
) -> Config {
    Config {
        server: ServerConfig {
            http_addr: http_addr.to_string(),
            grpc_addr: grpc_addr.to_string(),
            metrics_addr: metrics_addr.to_string(),
            request_timeout_secs: 30,
        },
        database: DatabaseConfig {
            url: SecretString::from(db_url.to_string()),
            max_connections: 5,
            min_connections: 1,
            acquire_timeout_secs: 10,
            idle_timeout_secs: 60,
        },
        redis: RedisConfig {
            url: SecretString::from(redis_url.to_string()),
            pool_size: 5,
            connection_timeout_secs: 5,
        },
        jwt: JwtConfig {
            private_key_path: private_key_path.to_string_lossy().to_string(),
            public_key_path: public_key_path.to_string_lossy().to_string(),
            key_id: "test-key-001".to_string(),
            access_token_expiration_secs: 3600,
            refresh_token_expiration_secs: 604800,
            issuer: "koduck-auth".to_string(),
            audience: "koduck".to_string(),
        },
        security: SecurityConfig::default(),
        client: ClientConfig {
            user_service_url: "http://127.0.0.1:65535".to_string(),
            user_service_timeout_secs: 1,
        },
    }
}

pub fn find_free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("failed to bind free port")
        .local_addr()
        .expect("failed to read local addr")
        .port()
}

async fn wait_for_http_ready(base_url: &str) {
    let client = reqwest::Client::new();
    for _ in 0..50 {
        match client.get(format!("{}/health", base_url)).send().await {
            Ok(resp) if resp.status().is_success() => return,
            _ => tokio::time::sleep(Duration::from_millis(100)).await,
        }
    }
    panic!("http test server did not become ready in time");
}

async fn wait_for_grpc_ready(port: u16) {
    for _ in 0..30 {
        if let Ok(channel) = Channel::from_shared(format!("http://127.0.0.1:{port}"))
            .expect("invalid grpc endpoint")
            .connect()
            .await
        {
            let mut client = AuthServiceClient::new(channel);
            if client
                .health_check(tonic::Request::new(HealthCheckRequest {}))
                .await
                .is_ok()
            {
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    panic!("gRPC server did not become ready in time");
}
