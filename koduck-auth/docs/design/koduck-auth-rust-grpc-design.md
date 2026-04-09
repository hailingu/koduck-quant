# Koduck-Auth Rust + gRPC 服务设计方案

## 1. 概述

本文档定义 koduck-auth 认证中心服务的 Rust + gRPC 实现方案。服务对外保持 HTTP REST API 与现有接口完全兼容，内部使用 gRPC 进行服务间通信，通过 APISIX 实现协议转换和统一网关。

### 1.1 架构目标

| 目标 | 说明 |
|------|------|
| 高性能 | Rust 异步运行时 + gRPC 提供亚毫秒级响应 |
| 兼容性 | HTTP REST API 与现有 koduck-auth 完全一致 |
| 可扩展 | gRPC 服务间通信支持流式处理和负载均衡 |
| 安全性 | APISIX 统一处理认证、鉴权、限流 |

### 1.2 技术栈

| 层级 | 技术选择 | 版本 |
|------|----------|------|
| 语言 | Rust | 1.75+ |
| HTTP 框架 | axum | 0.7+ |
| gRPC | tonic | 0.11+ |
| 数据库 | sqlx (PostgreSQL) | 0.7+ |
| 缓存 | redis (deadpool-redis) | 0.14+ |
| JWT | jsonwebtoken | 9.0+ |
| 配置 | config + serde | - |
| 日志 | tracing + tracing-subscriber | 0.1+ |
| 指标 | metrics + metrics-prometheus | - |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端请求                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              APISIX 网关                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   jwt-auth      │  │  grpc-transcode │  │      服务发现            │  │
│  │                 │  │                 │  │                         │  │
│  │ • RS256 验签     │  │ HTTP ↔ gRPC     │  │ • koduck-auth:8081     │  │
│  │ • Token 解析     │  │ 协议转换         │  │ • koduck-user:8082     │  │
│  │ • 身份透传       │  │                 │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────┐
│   koduck-auth (Rust)  │ │  koduck-user  │ │    Business Service   │
│      (认证中心)        │ │   (用户管理)   │ │    (market, etc.)     │
│                       │ │               │ │                       │
│  ┌─────────────────┐  │ │               │ │                       │
│  │  HTTP REST API  │  │ │               │ │                       │
│  │  (axum)         │  │ │               │ │                       │
│  │                 │  │ │               │ │                       │
│  │ • /auth/login   │  │ │               │ │                       │
│  │ • /auth/register│  │ │               │ │                       │
│  │ • /auth/refresh │  │ │               │ │                       │
│  └─────────────────┘  │ │               │ │                       │
│                       │ │               │ │                       │
│  ┌─────────────────┐  │ │               │ │                       │
│  │  gRPC Service   │  │ │               │ │                       │
│  │  (tonic)        │  │ │               │ │                       │
│  │                 │  │ │               │ │                       │
│  │ • Token Validate│◀─┼─┼───────────────┼─┼────── 内部服务调用      │
│  │ • User Query    │  │ │               │ │                       │
│  │ • JWKS Get      │  │ │               │ │                       │
│  └─────────────────┘  │ │               │ │                       │
└───────────────────────┘ └───────────────┘ └───────────────────────┘
```

### 2.2 服务职责

| 组件 | 职责 | 协议 |
|------|------|------|
| **HTTP REST API** | 对外提供认证接口 | HTTP/1.1, HTTP/2 |
| **gRPC Service** | 服务间通信、Token 验证 | gRPC (HTTP/2) |
| **JWKS Endpoint** | 公钥分发 | HTTP/1.1 |
| **Health Check** | 健康检查 | HTTP/1.1 |

### 2.3 端口规划

| 端口 | 用途 | 协议 |
|------|------|------|
| 8081 | HTTP REST API | HTTP/1.1, HTTP/2 |
| 50051 | gRPC Service | HTTP/2 |
| 9090 | Metrics (Prometheus) | HTTP/1.1 |

---

## 3. gRPC 接口定义

### 3.1 Proto 文件

> 完整 proto 定义见 [`proto/koduck/auth/v1/auth.proto`](../proto/koduck/auth/v1/auth.proto)。
> 以下为关键接口摘要。

**错误处理策略**：错误通过 gRPC Status 返回，不在 Response body 中携带。
唯一例外是 `IntrospectTokenResponse.active`（遵循 OIDC RFC 7662）。

| gRPC Status Code | 使用场景 |
|-----------------|---------|
| `UNAUTHENTICATED` | 凭证无效、Token 过期/无效 |
| `NOT_FOUND` | 用户或资源不存在 |
| `INVALID_ARGUMENT` | 请求参数校验失败 |
| `FAILED_PRECONDITION` | 账户被锁定/禁用 |
| `INTERNAL` | 服务端内部错误 |

```protobuf
// AuthService — 认证服务（服务间调用）
service AuthService {
  rpc ValidateCredentials(ValidateCredentialsRequest) returns (ValidateCredentialsResponse);
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc GetUserRoles(GetUserRolesRequest) returns (GetUserRolesResponse);
  rpc RevokeToken(RevokeTokenRequest) returns (google.protobuf.Empty);
  rpc Logout(LogoutRequest) returns (google.protobuf.Empty);
  rpc GetSecurityConfig(google.protobuf.Empty) returns (SecurityConfigResponse);
  rpc GetJwks(google.protobuf.Empty) returns (JwksResponse);
  rpc HealthCheck(google.protobuf.Empty) returns (HealthCheckResponse);
}

// TokenService — Token 自省与刷新
service TokenService {
  // OIDC RFC 7662 兼容，active=false 通过 Response 返回
  rpc IntrospectAccessToken(IntrospectTokenRequest) returns (IntrospectTokenResponse);
  // 错误通过 gRPC Status 返回
  rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse);
  // 内部使用
  rpc GenerateTokenPair(GenerateTokenPairRequest) returns (GenerateTokenPairResponse);
}
```

**REST API 与 gRPC 对照**：

| REST API 端点 | gRPC RPC | 说明 |
|---------------|----------|------|
| `POST /api/v1/auth/login` | `ValidateCredentials` | 凭证验证，登录逻辑在 HTTP 层组装 |
| `POST /api/v1/auth/register` | — | 仅 REST，注册由用户直接调用 |
| `POST /api/v1/auth/refresh` | `TokenService.RefreshToken` | 双协议支持 |
| `POST /api/v1/auth/logout` | `AuthService.Logout` | 双协议支持 |
| `GET /api/v1/auth/security-config` | `AuthService.GetSecurityConfig` | 双协议支持 |
| `POST /api/v1/auth/forgot-password` | — | 仅 REST，用户直接调用 |
| `POST /api/v1/auth/reset-password` | — | 仅 REST，用户直接调用 |
| `GET /.well-known/jwks.json` | `AuthService.GetJwks` | 双协议支持 |

### 3.2 生成的代码结构

```
koduck-auth/
├── proto/
│   └── koduck/
│       └── auth/
│           └── v1/
│               ├── auth.proto
│               └── gen/
│                   ├── auth.rs          # tonic 生成的 Rust 代码
│                   └── auth_grpc.rs
├── src/
│   ├── grpc/
│   │   ├── mod.rs
│   │   ├── server.rs      # gRPC 服务实现
│   │   ├── auth_service.rs
│   │   └── token_service.rs
│   └── ...
```

---

## 4. HTTP REST API 设计

### 4.1 与现有 API 完全兼容

保持与现有 koduck-auth 的 HTTP REST API 完全一致：

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录 |
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/refresh` | 刷新 Token |
| POST | `/api/v1/auth/logout` | 用户登出 |
| GET | `/api/v1/auth/security-config` | 获取安全配置 |
| POST | `/api/v1/auth/forgot-password` | 忘记密码 |
| POST | `/api/v1/auth/reset-password` | 重置密码 |
| GET | `/.well-known/jwks.json` | JWKS 公钥 |

### 4.2 Axum 路由实现

```rust
// src/http/routes.rs
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    handler::*,
    state::AppState,
};

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        // 认证接口
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/refresh", post(auth::refresh_token))
        .route("/api/v1/auth/logout", post(auth::logout))
        .route("/api/v1/auth/security-config", get(auth::security_config))
        .route("/api/v1/auth/forgot-password", post(auth::forgot_password))
        .route("/api/v1/auth/reset-password", post(auth::reset_password))
        // JWKS
        .route("/.well-known/jwks.json", get(jwks::get_jwks))
        // 健康检查
        .route("/health", get(health::health_check))
        .route("/actuator/health", get(health::actuator_health))
        .route("/actuator/health/liveness", get(health::liveness))
        .route("/actuator/health/readiness", get(health::readiness))
        // 指标
        .route("/metrics", get(metrics::handler))
        .with_state(state)
}
```

### 4.3 Handler 实现示例

```rust
// src/http/handler/auth.rs
use axum::{
    extract::{ConnectInfo, State},
    Json,
};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::{
    error::AppError,
    model::*,
    service::AuthService,
    state::AppState,
};

pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>, AppError> {
    let ip_address = addr.ip().to_string();
    let user_agent = ""; // 从 Header 获取
    
    let response = state
        .auth_service
        .login(req, ip_address, user_agent)
        .await?;
    
    Ok(Json(ApiResponse::success(response)))
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>, AppError> {
    let response = state.auth_service.register(req).await?;
    Ok(Json(ApiResponse::success(response)))
}

pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshTokenRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>, AppError> {
    let response = state.auth_service.refresh_token(req).await?;
    Ok(Json(ApiResponse::success(response)))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    Json(req): Json<Option<LogoutRequest>>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let refresh_token = req.and_then(|r| r.refresh_token);
    state.auth_service.logout(refresh_token).await?;
    Ok(Json(ApiResponse::success(())))
}

pub async fn security_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<SecurityConfigResponse>>, AppError> {
    let config = state.auth_service.get_security_config().await?;
    Ok(Json(ApiResponse::success(config)))
}

pub async fn forgot_password(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<ForgotPasswordRequest>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let ip_address = addr.ip().to_string();
    state.auth_service.forgot_password(req, ip_address).await?;
    Ok(Json(ApiResponse::success(())))
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    state.auth_service.reset_password(req).await?;
    Ok(Json(ApiResponse::success(())))
}
```

---

## 5. APISIX 集成方案

### 5.1 协议转换配置

APISIX 通过 `grpc-transcode` 插件将 HTTP REST API 转换为 gRPC 调用：

```yaml
# APISIX 路由配置 - HTTP 转 gRPC
routes:
  # 认证服务 - HTTP 转 gRPC
  - uri: /api/v1/auth/*
    plugins:
      grpc-transcode:
        proto_id: "koduck-auth-proto"
        service: "koduck.auth.v1.AuthService"
        # 方法映射在代码中处理，这里保持 REST API
    upstream:
      type: roundrobin
      scheme: http
      nodes:
        "koduck-auth:8081": 1  # HTTP REST API 端口

  # gRPC 服务 - 直接代理（服务间调用）
  - uri: /grpc.auth.v1/*
    plugins:
      grpc-web: {}
    upstream:
      type: roundrobin
      scheme: grpc
      nodes:
        "koduck-auth:50051": 1  # gRPC 端口
```

### 5.2 简化方案：HTTP + gRPC 并存

koduck-auth 同时暴露 HTTP 和 gRPC 端口，APISIX 按需路由：

```yaml
# APISIX 路由配置 - 简化版

# 1. 对外 REST API（HTTP）
- uri: /api/v1/auth/*
  priority: 100
  upstream:
    type: roundrobin
    nodes:
      "koduck-auth:8081": 1  # HTTP 端口

# 2. JWKS 端点（HTTP）
- uri: /.well-known/jwks.json
  priority: 100
  upstream:
    type: roundrobin
    nodes:
      "koduck-auth:8081": 1

# 3. 内部 gRPC 服务（服务间调用）
- uri: /koduck.auth.v1.AuthService/*
  priority: 100
  plugins:
    key-auth: {}  # 内部服务认证
  upstream:
    type: roundrobin
    scheme: grpc
    nodes:
      "koduck-auth:50051": 1  # gRPC 端口
```

### 5.3 K8s Service 配置

```yaml
# k8s/base/koduck-auth-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: koduck-auth
  namespace: koduck
spec:
  type: ClusterIP
  selector:
    app: koduck-auth
  ports:
    - name: http
      port: 8081
      targetPort: 8081
    - name: grpc
      port: 50051
      targetPort: 50051
---
# 内部 gRPC 专用 Service（Headless，支持客户端负载均衡）
apiVersion: v1
kind: Service
metadata:
  name: koduck-auth-grpc
  namespace: koduck
spec:
  type: ClusterIP
  clusterIP: None  # Headless
  selector:
    app: koduck-auth
  ports:
    - name: grpc
      port: 50051
      targetPort: 50051
```

---

## 6. Rust 项目结构

### 6.1 目录结构

```
koduck-auth/
├── Cargo.toml
├── Dockerfile
├── proto/
│   └── koduck/
│       └── auth/
│           └── v1/
│               └── auth.proto
├── build.rs                 # 编译 proto
├── migrations/              # SQLx 数据库迁移
│   ├── 001_initial.sql
│   └── 002_add_indexes.sql
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── config.rs            # 配置管理
│   ├── error.rs             # 错误定义
│   ├── state.rs             # 应用状态
│   ├── model/               # 数据模型
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── token.rs
│   │   ├── request.rs       # HTTP 请求 DTO
│   │   └── response.rs      # HTTP 响应 DTO
│   ├── repository/          # 数据访问层
│   │   ├── mod.rs
│   │   ├── user_repository.rs
│   │   ├── refresh_token_repository.rs
│   │   └── password_reset_repository.rs
│   ├── service/             # 业务逻辑层
│   │   ├── mod.rs
│   │   ├── auth_service.rs
│   │   ├── token_service.rs
│   │   └── jwt_service.rs
│   ├── http/                # HTTP REST API
│   │   ├── mod.rs
│   │   ├── routes.rs
│   │   ├── middleware/
│   │   │   ├── mod.rs
│   │   │   ├── logging.rs
│   │   │   └── error_handler.rs
│   │   └── handler/
│   │       ├── mod.rs
│   │       ├── auth.rs
│   │       ├── jwks.rs
│   │       ├── health.rs
│   │       └── metrics.rs
│   ├── grpc/                # gRPC 服务
│   │   ├── mod.rs
│   │   ├── server.rs
│   │   ├── auth_service.rs
│   │   └── token_service.rs
│   ├── client/              # 外部服务客户端
│   │   ├── mod.rs
│   │   └── user_client.rs   # gRPC 调用 koduck-user
│   ├── crypto/              # 加密相关
│   │   ├── mod.rs
│   │   ├── password.rs      # Argon2/BCrypt
│   │   └── rsa.rs           # RSA 密钥管理
│   ├── jwt/                 # JWT 处理
│   │   ├── mod.rs
│   │   ├── generator.rs
│   │   ├── validator.rs
│   │   └── jwks.rs
│   └── util/                # 工具函数
│       ├── mod.rs
│       └── ip.rs
├── tests/                   # 集成测试
│   ├── integration_tests.rs
│   └── grpc_tests.rs
└── benches/                 # 性能测试
    └── jwt_bench.rs
```

### 6.2 Cargo.toml

```toml
[package]
name = "koduck-auth"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
# 异步运行时
tokio = { version = "1.35", features = ["full"] }
tokio-util = { version = "0.7", features = ["codec"] }

# HTTP 框架
axum = { version = "0.7", features = ["http2", "macros"] }
tower = { version = "0.4", features = ["full"] }
tower-http = { version = "0.5", features = [
    "cors",
    "trace",
    "compression",
    "request-id",
    "sensitive-headers",
] }
hyper = { version = "1.0", features = ["full"] }

# gRPC
tonic = { version = "0.11", features = ["tls", "gzip"] }
tonic-health = "0.11"
tonic-reflection = "0.11"
prost = "0.12"
prost-types = "0.12"

# 数据库
sqlx = { version = "0.7", features = [
    "runtime-tokio-rustls",
    "postgres",
    "chrono",
    "uuid",
    "migrate",
] }
deadpool-redis = "0.14"

# JWT
jsonwebtoken = "9.2"
rsa = { version = "0.9", features = ["pem", "sha2"] }
pkcs8 = { version = "0.10", features = ["pem", "pkcs5"] }

# 密码哈希
argon2 = "0.5"

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde_urlencoded = "0.7"

# 配置
config = "0.14"
dotenvy = "0.15"

# 日志和监控
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = [
    "env-filter",
    "json",
    "time",
] }
tracing-opentelemetry = "0.23"
opentelemetry = "0.22"
opentelemetry-jaeger = "0.21"
metrics = "0.22"
metrics-exporter-prometheus = "0.13"

# 错误处理
thiserror = "1.0"
anyhow = "1.0"

# 验证
validator = { version = "0.16", features = ["derive"] }

# 时间和 UUID
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.6", features = ["v4", "serde"] }

# HTTP 客户端（调用其他服务）
reqwest = { version = "0.11", features = [
    "json",
    "rustls-tls",
], default-features = false }

# 工具
lazy_static = "1.4"
once_cell = "1.19"
async-trait = "0.1"
futures = "0.3"
pin-project = "1.1"

# 安全
secrecy = { version = "0.8", features = ["serde"] }
zeroize = { version = "1.7", features = ["derive"] }

[build-dependencies]
tonic-build = "0.11"

[dev-dependencies]
tokio-test = "0.4"
mockall = "0.12"
criterion = { version = "0.5", features = ["async_tokio"] }

[[bench]]
name = "jwt_bench"
harness = false
```

---

## 7. 核心代码实现

### 7.1 JWT 服务实现

```rust
// src/jwt/mod.rs
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;

pub mod generator;
pub mod jwks;
pub mod validator;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // user_id
    pub username: String,
    pub email: String,
    pub roles: Vec<String>,
    pub r#type: TokenType,
    pub exp: usize,
    pub iat: usize,
    pub jti: String,        // JWT ID
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

pub struct JwtService {
    private_key: EncodingKey,
    public_key: DecodingKey,
    key_id: String,
    access_expiration: i64,   // 秒
    refresh_expiration: i64,  // 秒
}

impl JwtService {
    pub fn new(
        private_key_pem: &str,
        public_key_pem: &str,
        key_id: String,
        access_expiration: i64,
        refresh_expiration: i64,
    ) -> Result<Self, AppError> {
        let private_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())
            .map_err(|e| AppError::Internal(format!("Invalid private key: {}", e)))?;
        
        let public_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())
            .map_err(|e| AppError::Internal(format!("Invalid public key: {}", e)))?;
        
        Ok(Self {
            private_key,
            public_key,
            key_id,
            access_expiration,
            refresh_expiration,
        })
    }

    pub fn generate_access_token(
        &self,
        user_id: i64,
        username: &str,
        email: &str,
        roles: &[String],
    ) -> Result<String, AppError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;
        
        let exp = now + self.access_expiration as usize;
        let jti = uuid::Uuid::new_v4().to_string();
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            email: email.to_string(),
            roles: roles.to_vec(),
            r#type: TokenType::Access,
            exp,
            iat: now,
            jti,
        };
        
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.key_id.clone());
        
        encode(&header, &claims, &self.private_key)
            .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))
    }

    pub fn generate_refresh_token(&self, user_id: i64) -> Result<String, AppError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;
        
        let exp = now + self.refresh_expiration as usize;
        let jti = uuid::Uuid::new_v4().to_string();
        
        let claims = Claims {
            sub: user_id.to_string(),
            username: String::new(),
            email: String::new(),
            roles: vec![],
            r#type: TokenType::Refresh,
            exp,
            iat: now,
            jti,
        };
        
        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some(self.key_id.clone());
        
        encode(&header, &claims, &self.private_key)
            .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, AppError> {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&["koduck"]);
        
        let token_data = decode::<Claims>(token, &self.public_key, &validation)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    AppError::Unauthorized("Token expired".to_string())
                }
                _ => AppError::Unauthorized(format!("Invalid token: {}", e)),
            })?;
        
        Ok(token_data.claims)
    }

    pub fn get_public_key_pem(&self) -> &str {
        // 返回公钥 PEM（用于 JWKS）
        ""
    }
}
```

### 7.2 gRPC 服务实现

```rust
// src/grpc/auth_service.rs
use tonic::{Request, Response, Status};
use tracing::{info, warn};

use crate::{
    grpc::proto::{
        auth_service_server::AuthService,
        *,
    },
    service::AuthService as AuthServiceImpl,
};

pub struct GrpcAuthService {
    auth_service: AuthServiceImpl,
}

impl GrpcAuthService {
    pub fn new(auth_service: AuthServiceImpl) -> Self {
        Self { auth_service }
    }
}

#[tonic::async_trait]
impl AuthService for GrpcAuthService {
    async fn validate_credentials(
        &self,
        request: Request<ValidateCredentialsRequest>,
    ) -> Result<Response<ValidateCredentialsResponse>, Status> {
        let req = request.into_inner();

        info!("Validating credentials for user: {}", req.username);

        // 调用业务逻辑，错误通过 gRPC Status 返回
        match self
            .auth_service
            .validate_credentials(&req.username, &req.password)
            .await
        {
            Ok((user, roles)) => {
                let response = ValidateCredentialsResponse {
                    user: Some(user.into()),
                    roles,
                };
                Ok(Response::new(response))
            }
            Err(e) => {
                warn!("Credential validation failed: {}", e);
                Err(Status::unauthenticated(e.to_string()))
            }
        }
    }

    async fn validate_token(
        &self,
        request: Request<ValidateTokenRequest>,
    ) -> Result<Response<ValidateTokenResponse>, Status> {
        let req = request.into_inner();

        match self.auth_service.validate_token(&req.token).await {
            Ok(claims) => {
                let response = ValidateTokenResponse {
                    user_id: claims.sub.parse().unwrap_or_default(),
                    username: claims.username,
                    email: claims.email,
                    roles: claims.roles,
                    expires_at: Some(prost_types::Timestamp {
                        seconds: claims.exp as i64,
                        nanos: 0,
                    }),
                    token_id: claims.jti,
                    issued_at: Some(prost_types::Timestamp {
                        seconds: claims.iat as i64,
                        nanos: 0,
                    }),
                };
                Ok(Response::new(response))
            }
            Err(e) => Err(Status::unauthenticated(e.to_string())),
        }
    }

    async fn get_user(
        &self,
        request: Request<GetUserRequest>,
    ) -> Result<Response<GetUserResponse>, Status> {
        let req = request.into_inner();
        
        let user = match req.identifier {
            Some(get_user_request::Identifier::UserId(id)) => {
                self.auth_service.get_user_by_id(id).await
            }
            Some(get_user_request::Identifier::Username(username)) => {
                self.auth_service.get_user_by_username(&username).await
            }
            Some(get_user_request::Identifier::Email(email)) => {
                self.auth_service.get_user_by_email(&email).await
            }
            None => return Err(Status::invalid_argument("Identifier required")),
        };
        
        match user {
            Ok((user, roles)) => {
                let response = GetUserResponse {
                    user: Some(user.into()),
                    roles,
                };
                Ok(Response::new(response))
            }
            Err(_) => Err(Status::not_found("User not found")),
        }
    }

    async fn get_user_roles(
        &self,
        request: Request<GetUserRolesRequest>,
    ) -> Result<Response<GetUserRolesResponse>, Status> {
        let req = request.into_inner();
        
        match self.auth_service.get_user_roles(req.user_id).await {
            Ok((roles, permissions)) => {
                let response = GetUserRolesResponse {
                    user_id: req.user_id,
                    roles,
                    permissions: permissions.into_iter().map(|p| p.into()).collect(),
                };
                Ok(Response::new(response))
            }
            Err(_) => Err(Status::not_found("User not found")),
        }
    }

    async fn revoke_token(
        &self,
        request: Request<RevokeTokenRequest>,
    ) -> Result<Response<()>, Status> {
        let req = request.into_inner();
        
        self.auth_service
            .revoke_token(&req.token, req.user_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;
        
        Ok(Response::new(()))
    }

    async fn get_jwks(
        &self,
        _request: Request<()>,
    ) -> Result<Response<JwksResponse>, Status> {
        let jwks = self.auth_service.get_jwks().await;
        
        let response = JwksResponse {
            keys: vec![jwk.into()],
        };
        
        Ok(Response::new(response))
    }

    async fn health_check(
        &self,
        _request: Request<()>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        let response = HealthCheckResponse {
            status: health_check_response::ServingStatus::Serving as i32,
            version: env!("CARGO_PKG_VERSION").to_string(),
            timestamp: Some(prost_types::Timestamp::now()),
            details: Default::default(),
        };
        Ok(Response::new(response))
    }
}
```

### 7.3 主入口

```rust
// src/main.rs
use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::TcpListener;
use tonic::transport::Server as TonicServer;
use tracing::{info, error};

mod config;
mod error;
mod grpc;
mod http;
mod jwt;
mod model;
mod repository;
mod service;
mod state;

use crate::{
    config::Config,
    grpc::{proto::auth_service_server::AuthServiceServer, AuthServiceImpl},
    http::create_router,
    state::AppState,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    
    info!("Starting koduck-auth service...");
    
    // 加载配置
    let config = Config::from_env()?;
    
    // 创建应用状态
    let state = Arc::new(AppState::new(config).await?);
    
    // 创建 HTTP 服务
    let http_addr: SocketAddr = "0.0.0.0:8081".parse()?;
    let http_listener = TcpListener::bind(http_addr).await?;
    let http_app = create_router(state.clone());
    
    // 创建 gRPC 服务
    let grpc_addr: SocketAddr = "0.0.0.0:50051".parse()?;
    let grpc_service = AuthServiceServer::new(AuthServiceImpl::new(state.clone()));
    
    info!("HTTP server listening on {}", http_addr);
    info!("gRPC server listening on {}", grpc_addr);
    
    // 同时运行 HTTP 和 gRPC 服务
    tokio::select! {
        result = axum::serve(http_listener, http_app) => {
            if let Err(e) = result {
                error!("HTTP server error: {}", e);
            }
        }
        result = TonicServer::builder()
            .add_service(grpc_service)
            .serve(grpc_addr) => {
            if let Err(e) = result {
                error!("gRPC server error: {}", e);
            }
        }
    }
    
    Ok(())
}
```

---

## 8. 配置清单

### 8.1 application.yml

```yaml
# koduck-auth (Rust) 配置

server:
  http:
    host: "0.0.0.0"
    port: 8081
  grpc:
    host: "0.0.0.0"
    port: 50051
  metrics:
    enabled: true
    port: 9090

database:
  postgres:
    url: "${DATABASE_URL}"
    max_connections: 20
    min_connections: 5
    connect_timeout: 10
    idle_timeout: 300
  redis:
    url: "${REDIS_URL}"
    pool_size: 10

jwt:
  algorithm: "RS256"
  private_key_path: "${JWT_PRIVATE_KEY_PATH}"
  public_key_path: "${JWT_PUBLIC_KEY_PATH}"
  key_id: "${JWT_KEY_ID:koduck-key-001}"
  access_token_expiration: 900    # 15分钟
  refresh_token_expiration: 604800  # 7天

security:
  password:
    algorithm: "argon2"
    argon2:
      memory_cost: 65536
      time_cost: 3
      parallelism: 4
  login:
    max_attempts: 5
    lockout_duration: 900  # 15分钟

# 内部服务调用配置（调用 koduck-user）
clients:
  user_service:
    endpoint: "${USER_SERVICE_ENDPOINT:http://koduck-user:8082}"
    timeout: 5000
    api_key: "${INTERNAL_API_KEY}"

# 日志
logging:
  level: "info"
  format: "json"  # json 或 pretty

# 追踪
tracing:
  enabled: true
  jaeger_endpoint: "${JAEGER_ENDPOINT}"
```

### 8.2 环境变量

```bash
# 数据库
export DATABASE_URL="postgresql://koduck:${AUTH_DB_PASSWORD}@auth-db:5432/koduck_auth"
export REDIS_URL="redis://redis:6379"

# JWT 密钥（从文件或 K8s Secret 挂载）
export JWT_PRIVATE_KEY_PATH="/secrets/jwt-private.pem"
export JWT_PUBLIC_KEY_PATH="/secrets/jwt-public.pem"
export JWT_KEY_ID="koduck-key-2024-001"

# 内部服务认证
export INTERNAL_API_KEY="uk_a1b2c3d4e5f6789012345678"

# 用户服务地址
export USER_SERVICE_ENDPOINT="http://koduck-user:8082"

# 日志级别
export RUST_LOG="koduck_auth=info,tower_http=info"
```

---

## 9. K8s 部署配置

### 9.1 Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: koduck-auth
  namespace: koduck
spec:
  replicas: 2
  selector:
    matchLabels:
      app: koduck-auth
  template:
    metadata:
      labels:
        app: koduck-auth
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
        - name: koduck-auth
          image: koduck/koduck-auth-rust:latest
          ports:
            - name: http
              containerPort: 8081
            - name: grpc
              containerPort: 50051
            - name: metrics
              containerPort: 9090
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: auth-db-secret
                  key: url
            - name: JWT_PRIVATE_KEY_PATH
              value: "/secrets/jwt-private.pem"
            - name: JWT_PUBLIC_KEY_PATH
              value: "/secrets/jwt-public.pem"
            - name: INTERNAL_API_KEY
              valueFrom:
                secretKeyRef:
                  name: koduck-auth-internal
                  key: api-key
          volumeMounts:
            - name: jwt-secrets
              mountPath: /secrets
              readOnly: true
          resources:
            requests:
              memory: "64Mi"      # Rust 内存占用低
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8081
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8081
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: jwt-secrets
          secret:
            secretName: jwt-keys
            items:
              - key: private.pem
                path: jwt-private.pem
              - key: public.pem
                path: jwt-public.pem
```

### 9.2 APISIX 路由配置

```bash
#!/bin/bash
# apisix-route-init-auth.sh

ADMIN="http://apisix-admin:9180/apisix/admin"
KEY="X-API-KEY: ${ADMIN_KEY}"

# 1. koduck-auth HTTP REST API（公开）
curl -fsS -X PUT "${ADMIN}/routes/auth-http" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/auth/*",
    "priority": 100,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'

# 2. JWKS 端点（公开）
curl -fsS -X PUT "${ADMIN}/routes/jwks" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/.well-known/jwks.json",
    "priority": 100,
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-auth:8081": 1
      }
    }
  }'

# 3. koduck-auth gRPC（内部服务调用，key-auth 保护）
curl -fsS -X PUT "${ADMIN}/routes/auth-grpc" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/koduck.auth.v1.AuthService/*",
    "priority": 100,
    "plugins": {
      "key-auth": {},
      "proxy-rewrite": {
        "headers": {
          "X-Consumer-Username": "$consumer_name",
          "apikey": ""
        }
      }
    },
    "upstream": {
      "type": "roundrobin",
      "scheme": "grpc",
      "nodes": {
        "koduck-auth:50051": 1
      }
    }
  }'

# 4. gRPC Reflection（可选，用于调试）
curl -fsS -X PUT "${ADMIN}/routes/auth-grpc-reflection" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/grpc.reflection.v1alpha.ServerReflection/*",
    "priority": 90,
    "plugins": {
      "key-auth": {}
    },
    "upstream": {
      "type": "roundrobin",
      "scheme": "grpc",
      "nodes": {
        "koduck-auth:50051": 1
      }
    }
  }'
```

---

## 10. 性能对比

| 指标 | Java (Spring Boot) | Rust (Axum + Tonic) | 提升 |
|------|-------------------|---------------------|------|
| 启动时间 | ~3-5 秒 | ~100 毫秒 | 30-50x |
| 内存占用（空闲） | ~200-400 MB | ~20-30 MB | 10-15x |
| 内存占用（负载） | ~500-800 MB | ~50-100 MB | 5-10x |
| JWT 签名 | ~2-5 ms | ~0.1-0.3 ms | 10-20x |
| JWT 验证 | ~1-3 ms | ~0.05-0.1 ms | 10-30x |
| 并发连接 | 10K+ | 100K+ | 10x+ |

---

## 11. 相关文档

- `koduck-auth-user-service-design.md` - 原服务设计文档
- `koduck-user-jwt-design.md` - JWT 架构设计
- `koduck-auth-api.yaml` - HTTP REST API 规范（兼容）
- `proto/koduck/auth/v1/auth.proto` - gRPC 接口定义

---

*文档版本: 1.0*  
*更新日期: 2026-04-07*  
*作者: Koduck Team*
