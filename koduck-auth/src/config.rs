//! Configuration management for koduck-auth

use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use std::fmt;

/// Application configuration
#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub jwt: JwtConfig,
    pub security: SecurityConfig,
    pub client: ClientConfig,
}

/// Server configuration
#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub http_addr: String,
    pub grpc_addr: String,
    pub metrics_addr: String,
    pub request_timeout_secs: u64,
}

/// Database configuration
#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: SecretString,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout_secs: u64,
    pub idle_timeout_secs: u64,
}

/// Redis configuration
#[derive(Debug, Deserialize, Clone)]
pub struct RedisConfig {
    pub url: SecretString,
    pub pool_size: usize,
    pub connection_timeout_secs: u64,
}

/// JWT configuration
#[derive(Debug, Deserialize, Clone)]
pub struct JwtConfig {
    pub private_key_path: String,
    pub public_key_path: String,
    pub key_id: String,
    pub access_token_expiration_secs: i64,
    pub refresh_token_expiration_secs: i64,
    pub issuer: String,
    pub audience: String,
}

/// Security configuration
#[derive(Debug, Deserialize, Clone)]
pub struct SecurityConfig {
    pub argon2_memory_cost: u32,
    pub argon2_time_cost: u32,
    pub argon2_parallelism: u32,
    pub max_login_attempts: i32,
    pub lockout_duration_minutes: i32,
    pub password_min_length: u32,
    pub password_max_length: u32,
    pub turnstile_enabled: bool,
    pub turnstile_secret_key: SecretString,
}

/// Client configuration for external services
#[derive(Debug, Deserialize, Clone)]
pub struct ClientConfig {
    pub user_service_url: String,
    pub user_service_timeout_secs: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            http_addr: "0.0.0.0:8081".to_string(),
            grpc_addr: "0.0.0.0:50051".to_string(),
            metrics_addr: "0.0.0.0:9090".to_string(),
            request_timeout_secs: 30,
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: SecretString::from("postgres://postgres:postgres@localhost:5432/koduck_auth".to_string()),
            max_connections: 10,
            min_connections: 2,
            acquire_timeout_secs: 10,
            idle_timeout_secs: 600,
        }
    }
}

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            url: SecretString::from("redis://localhost:6379".to_string()),
            pool_size: 10,
            connection_timeout_secs: 5,
        }
    }
}

impl Default for JwtConfig {
    fn default() -> Self {
        Self {
            private_key_path: "./keys/private.pem".to_string(),
            public_key_path: "./keys/public.pem".to_string(),
            key_id: "koduck-key-001".to_string(),
            access_token_expiration_secs: 3600,      // 1 hour
            refresh_token_expiration_secs: 604800,   // 7 days
            issuer: "koduck-auth".to_string(),
            audience: "koduck".to_string(),
        }
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            argon2_memory_cost: 65536,  // 64 MB
            argon2_time_cost: 3,
            argon2_parallelism: 4,
            max_login_attempts: 5,
            lockout_duration_minutes: 30,
            password_min_length: 6,
            password_max_length: 100,
            turnstile_enabled: false,
            turnstile_secret_key: SecretString::from("".to_string()),
        }
    }
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            user_service_url: "http://koduck-user:8082".to_string(),
            user_service_timeout_secs: 10,
        }
    }
}

impl Config {
    /// Load configuration from environment variables and config files
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if exists
        let _ = dotenvy::dotenv();

        let config = ConfigBuilder::builder()
            // Default configuration
            .set_default("server.http_addr", "0.0.0.0:8081")?
            .set_default("server.grpc_addr", "0.0.0.0:50051")?
            .set_default("server.metrics_addr", "0.0.0.0:9090")?
            .set_default("server.request_timeout_secs", 30)?
            .set_default("database.url", "postgres://postgres:postgres@localhost:5432/koduck_auth")?
            .set_default("database.max_connections", 10)?
            .set_default("database.min_connections", 2)?
            .set_default("database.acquire_timeout_secs", 10)?
            .set_default("database.idle_timeout_secs", 600)?
            .set_default("redis.url", "redis://localhost:6379")?
            .set_default("redis.pool_size", 10)?
            .set_default("redis.connection_timeout_secs", 5)?
            .set_default("jwt.private_key_path", "./keys/private.pem")?
            .set_default("jwt.public_key_path", "./keys/public.pem")?
            .set_default("jwt.key_id", "koduck-key-001")?
            .set_default("jwt.access_token_expiration_secs", 3600)?
            .set_default("jwt.refresh_token_expiration_secs", 604800)?
            .set_default("jwt.issuer", "koduck-auth")?
            .set_default("jwt.audience", "koduck")?
            .set_default("security.argon2_memory_cost", 65536)?
            .set_default("security.argon2_time_cost", 3)?
            .set_default("security.argon2_parallelism", 4)?
            .set_default("security.max_login_attempts", 5)?
            .set_default("security.lockout_duration_minutes", 30)?
            .set_default("security.password_min_length", 6)?
            .set_default("security.password_max_length", 100)?
            .set_default("security.turnstile_enabled", false)?
            .set_default("security.turnstile_secret_key", "")?
            .set_default("client.user_service_url", "http://koduck-user:8082")?
            .set_default("client.user_service_timeout_secs", 10)?
            // Config file (optional)
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name("config/local").required(false))
            // Environment variables with prefix KODUCK_AUTH
            .add_source(Environment::with_prefix("KODUCK_AUTH").separator("__"))
            .build()?;

        config.try_deserialize()
    }

    /// Get database URL (exposed for connection pool creation)
    pub fn database_url(&self) -> &str {
        self.database.url.expose_secret()
    }

    /// Get Redis URL (exposed for connection pool creation)
    pub fn redis_url(&self) -> &str {
        self.redis.url.expose_secret()
    }
}

// Custom Display for Config to hide sensitive data
impl fmt::Display for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Config {{ server: {:?}, database: ***, redis: ***, jwt: {:?}, security: ***, client: {:?} }}",
            self.server, self.jwt, self.client
        )
    }
}
