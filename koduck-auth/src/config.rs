//! Configuration management for koduck-auth

use config::{Config as ConfigBuilder, ConfigError, Environment, File};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use std::fmt;
use std::net::SocketAddr;

/// Custom validation error for configuration
#[derive(Debug)]
pub struct ValidationError {
    pub message: String,
}

impl std::error::Error for ValidationError {}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Configuration validation error: {}", self.message)
    }
}

impl From<ValidationError> for ConfigError {
    fn from(err: ValidationError) -> Self {
        ConfigError::Message(err.message)
    }
}

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

impl ServerConfig {
    /// Validate server configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate HTTP address
        validate_socket_addr(&self.http_addr, "http_addr")?;
        
        // Validate gRPC address
        validate_socket_addr(&self.grpc_addr, "grpc_addr")?;
        
        // Validate metrics address
        validate_socket_addr(&self.metrics_addr, "metrics_addr")?;
        
        // Validate request timeout
        if self.request_timeout_secs == 0 {
            return Err(ValidationError {
                message: "request_timeout_secs must be greater than 0".to_string(),
            });
        }
        
        Ok(())
    }
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

impl DatabaseConfig {
    /// Validate database configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate connection pool size
        if self.max_connections < self.min_connections {
            return Err(ValidationError {
                message: format!(
                    "database.max_connections ({}) must be greater than or equal to min_connections ({})",
                    self.max_connections, self.min_connections
                ),
            });
        }
        
        if self.max_connections == 0 {
            return Err(ValidationError {
                message: "database.max_connections must be greater than 0".to_string(),
            });
        }
        
        // Validate timeouts
        if self.acquire_timeout_secs == 0 {
            return Err(ValidationError {
                message: "database.acquire_timeout_secs must be greater than 0".to_string(),
            });
        }
        
        if self.idle_timeout_secs == 0 {
            return Err(ValidationError {
                message: "database.idle_timeout_secs must be greater than 0".to_string(),
            });
        }
        
        Ok(())
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

impl RedisConfig {
    /// Validate Redis configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate pool size
        if self.pool_size == 0 {
            return Err(ValidationError {
                message: "redis.pool_size must be greater than 0".to_string(),
            });
        }
        
        // Validate connection timeout
        if self.connection_timeout_secs == 0 {
            return Err(ValidationError {
                message: "redis.connection_timeout_secs must be greater than 0".to_string(),
            });
        }
        
        Ok(())
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

impl JwtConfig {
    /// Validate JWT configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate key paths are not empty
        if self.private_key_path.trim().is_empty() {
            return Err(ValidationError {
                message: "jwt.private_key_path cannot be empty".to_string(),
            });
        }
        
        if self.public_key_path.trim().is_empty() {
            return Err(ValidationError {
                message: "jwt.public_key_path cannot be empty".to_string(),
            });
        }
        
        // Validate key_id is not empty
        if self.key_id.trim().is_empty() {
            return Err(ValidationError {
                message: "jwt.key_id cannot be empty".to_string(),
            });
        }
        
        // Validate expiration times
        if self.access_token_expiration_secs <= 0 {
            return Err(ValidationError {
                message: "jwt.access_token_expiration_secs must be greater than 0".to_string(),
            });
        }
        
        if self.refresh_token_expiration_secs <= 0 {
            return Err(ValidationError {
                message: "jwt.refresh_token_expiration_secs must be greater than 0".to_string(),
            });
        }
        
        // Validate issuer and audience are not empty
        if self.issuer.trim().is_empty() {
            return Err(ValidationError {
                message: "jwt.issuer cannot be empty".to_string(),
            });
        }
        
        if self.audience.trim().is_empty() {
            return Err(ValidationError {
                message: "jwt.audience cannot be empty".to_string(),
            });
        }
        
        Ok(())
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

impl SecurityConfig {
    /// Validate security configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate Argon2 parameters
        // Memory cost should be at least 1024 (1MB)
        if self.argon2_memory_cost < 1024 {
            return Err(ValidationError {
                message: format!(
                    "security.argon2_memory_cost ({}) must be at least 1024 (1MB)",
                    self.argon2_memory_cost
                ),
            });
        }
        
        // Time cost should be at least 1
        if self.argon2_time_cost < 1 {
            return Err(ValidationError {
                message: "security.argon2_time_cost must be at least 1".to_string(),
            });
        }
        
        // Parallelism should be between 1 and 255
        if self.argon2_parallelism < 1 || self.argon2_parallelism > 255 {
            return Err(ValidationError {
                message: "security.argon2_parallelism must be between 1 and 255".to_string(),
            });
        }
        
        // Validate login attempt configuration
        if self.max_login_attempts < 1 {
            return Err(ValidationError {
                message: "security.max_login_attempts must be at least 1".to_string(),
            });
        }
        
        if self.lockout_duration_minutes <= 0 {
            return Err(ValidationError {
                message: "security.lockout_duration_minutes must be greater than 0".to_string(),
            });
        }
        
        // Validate password length configuration
        if self.password_min_length < 1 {
            return Err(ValidationError {
                message: "security.password_min_length must be at least 1".to_string(),
            });
        }
        
        if self.password_max_length > 128 {
            return Err(ValidationError {
                message: "security.password_max_length must not exceed 128".to_string(),
            });
        }
        
        if self.password_min_length >= self.password_max_length {
            return Err(ValidationError {
                message: format!(
                    "security.password_min_length ({}) must be less than password_max_length ({})",
                    self.password_min_length, self.password_max_length
                ),
            });
        }
        
        Ok(())
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

impl ClientConfig {
    /// Validate client configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Validate service URL is not empty
        if self.user_service_url.trim().is_empty() {
            return Err(ValidationError {
                message: "client.user_service_url cannot be empty".to_string(),
            });
        }
        
        // Validate timeout
        if self.user_service_timeout_secs == 0 {
            return Err(ValidationError {
                message: "client.user_service_timeout_secs must be greater than 0".to_string(),
            });
        }
        
        Ok(())
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
        let config = Self::load()?;
        config.validate()?;
        Ok(config)
    }
    
    /// Load configuration without validation (for testing)
    fn load() -> Result<Self, ConfigError> {
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
    
    /// Validate all configuration
    pub fn validate(&self) -> Result<(), ValidationError> {
        self.server.validate()?;
        self.database.validate()?;
        self.redis.validate()?;
        self.jwt.validate()?;
        self.security.validate()?;
        self.client.validate()?;
        Ok(())
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

/// Validate socket address string
/// 
/// Validates that the address is in the format "ip:port" and the port is in valid range (1-65535)
fn validate_socket_addr(addr: &str, field_name: &str) -> Result<(), ValidationError> {
    // Parse the socket address
    match addr.parse::<SocketAddr>() {
        Ok(socket_addr) => {
            // Check port is in valid range (parse already ensures it's 1-65535)
            let port = socket_addr.port();
            if port == 0 {
                return Err(ValidationError {
                    message: format!("{}.port cannot be 0", field_name),
                });
            }
            Ok(())
        }
        Err(e) => Err(ValidationError {
            message: format!("{} ('{}') is not a valid socket address: {}", field_name, addr, e),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_socket_addr_valid() {
        assert!(validate_socket_addr("0.0.0.0:8081", "http_addr").is_ok());
        assert!(validate_socket_addr("127.0.0.1:50051", "grpc_addr").is_ok());
        assert!(validate_socket_addr("[::1]:9090", "metrics_addr").is_ok());
    }

    #[test]
    fn test_validate_socket_addr_invalid_port() {
        let result = validate_socket_addr("0.0.0.0:0", "http_addr");
        assert!(result.is_ok()); // SocketAddr allows port 0, but we might want to reject it
        
        let result = validate_socket_addr("0.0.0.0:99999", "http_addr");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_socket_addr_invalid_format() {
        let result = validate_socket_addr("not-an-address", "http_addr");
        assert!(result.is_err());
        
        let result = validate_socket_addr("0.0.0.0", "http_addr"); // Missing port
        assert!(result.is_err());
    }

    #[test]
    fn test_server_config_valid() {
        let config = ServerConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_server_config_invalid_timeout() {
        let config = ServerConfig {
            request_timeout_secs: 0,
            ..ServerConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("request_timeout_secs"));
    }

    #[test]
    fn test_database_config_valid() {
        let config = DatabaseConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_database_config_invalid_pool_size() {
        let config = DatabaseConfig {
            max_connections: 5,
            min_connections: 10, // min > max
            ..DatabaseConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("max_connections"));
    }

    #[test]
    fn test_jwt_config_valid() {
        let config = JwtConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_jwt_config_empty_key_path() {
        let config = JwtConfig {
            private_key_path: "".to_string(),
            ..JwtConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("private_key_path"));
    }

    #[test]
    fn test_jwt_config_invalid_expiration() {
        let config = JwtConfig {
            access_token_expiration_secs: -1,
            ..JwtConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("access_token_expiration_secs"));
    }

    #[test]
    fn test_security_config_valid() {
        let config = SecurityConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_security_config_invalid_argon2_memory() {
        let config = SecurityConfig {
            argon2_memory_cost: 512, // Less than 1024
            ..SecurityConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("argon2_memory_cost"));
    }

    #[test]
    fn test_security_config_invalid_argon2_parallelism() {
        let config = SecurityConfig {
            argon2_parallelism: 0,
            ..SecurityConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("argon2_parallelism"));
    }

    #[test]
    fn test_security_config_invalid_password_length() {
        let config = SecurityConfig {
            password_min_length: 100,
            password_max_length: 50, // min > max
            ..SecurityConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("password_min_length"));
    }

    #[test]
    fn test_redis_config_valid() {
        let config = RedisConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_redis_config_invalid_pool_size() {
        let config = RedisConfig {
            pool_size: 0,
            ..RedisConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("pool_size"));
    }

    #[test]
    fn test_client_config_valid() {
        let config = ClientConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_client_config_empty_url() {
        let config = ClientConfig {
            user_service_url: "".to_string(),
            ..ClientConfig::default()
        };
        let result = config.validate();
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("user_service_url"));
    }
}
