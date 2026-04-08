# Koduck-Auth Rust + gRPC 实施任务清单

> 本文档基于 `docs/design/koduck-auth-rust-grpc-design.md` 拆分，提供 step-by-step 可执行任务。
> 
> **状态**: 待执行  
> **创建日期**: 2026-04-07  
> **对应设计文档**: [koduck-auth-rust-grpc-design.md](../design/koduck-auth-rust-grpc-design.md)

---

## 执行阶段概览

| 阶段 | 名称 | 预计工作量 | 依赖 | 优先级 |
|------|------|----------|------|--------|
| Phase 1 | 项目初始化与基础设施 | 1-2 天 | - | P0 |
| Phase 2 | gRPC 接口定义与代码生成 | 1 天 | Phase 1 | P0 |
| Phase 3 | 数据层实现 | 2 天 | Phase 1 | P0 |
| Phase 4 | 核心业务逻辑 | 3-4 天 | Phase 2, 3 | P0 |
| Phase 5 | HTTP API 层 | 2 天 | Phase 4 | P1 |
| Phase 6 | gRPC 服务层 | 2 天 | Phase 4 | P1 |
| Phase 7 | 集成测试与部署 | 2-3 天 | Phase 5, 6 | P1 |

---

## Phase 1: 项目初始化与基础设施

### Task 1.1: 创建 Rust 项目骨架
**执行命令:**
```bash
cargo new --lib koduck-auth-rust
cd koduck-auth-rust
```

**详细要求:**
1. 创建 `Cargo.toml`，按设计文档 6.2 节配置所有依赖
2. 创建 `build.rs` 用于编译 proto 文件
3. 按 6.1 节创建完整目录结构

**验收标准:**
- [x] `Cargo.toml` 包含所有必需依赖（tokio, axum, tonic, sqlx, jsonwebtoken 等）
- [x] `build.rs` 配置 tonic-build 编译 proto
- [x] 目录结构完整：src/{grpc,http,model,repository,service,jwt,crypto,client,util}, tests/, benches/, migrations/
- [x] `cargo check` 无错误

**参考文档:** 设计文档 6.1 节（目录结构）、6.2 节（Cargo.toml）

---

### Task 1.2: 配置管理实现
**文件:** `src/config.rs`

**详细要求:**
1. 实现配置结构体，支持：
   - 服务器配置（HTTP 端口 8081、gRPC 端口 50051、Metrics 端口 9090）
   - 数据库配置（PostgreSQL、Redis）
   - JWT 配置（密钥路径、过期时间）
   - 安全配置（Argon2 参数、登录限制）
   - 客户端配置（koduck-user 服务地址）
2. 实现从环境变量加载配置
3. 支持 YAML 配置文件格式

**验收标准:**
- [x] `Config::from_env()` 方法正常工作
- [x] 支持设计文档 8.1 节的所有配置项
- [x] 环境变量覆盖配置文件
- [x] 敏感信息使用 `secrecy::SecretString`
- [x] 配置验证（如端口号范围检查）

**参考文档:** 设计文档 8.1 节（application.yml）、8.2 节（环境变量）

---

### Task 1.3: 错误处理框架
**文件:** `src/error.rs`

**详细要求:**
1. 定义 `AppError` 枚举，包含：
   - `Unauthorized(String)` - 401 认证失败
   - `Forbidden(String)` - 403 权限不足
   - `NotFound(String)` - 404 资源不存在
   - `Validation(String)` - 400 参数校验失败
   - `Conflict(String)` - 409 资源冲突
   - `Internal(String)` - 500 内部错误
2. 使用 `thiserror` 派生 Error trait
3. 实现到 HTTP Status Code 的映射
4. 实现统一的错误响应 JSON 格式

**验收标准:**
- [x] 所有错误类型定义完整
- [x] `impl IntoResponse for AppError` 实现
- [x] 错误响应格式：`{ "success": false, "message": "...", "code": "ERROR_CODE" }`
- [x] 内部错误隐藏详细信息，仅记录日志
- [x] 支持错误链追踪

---

### Task 1.4: 数据库迁移脚本
**文件:** `migrations/001_initial.sql`, `migrations/002_add_indexes.sql`

**详细要求:**
1. **001_initial.sql** - 初始表结构：
   - `users` 表：id, username, email, password_hash, nickname, avatar_url, status, email_verified, last_login_at, created_at, updated_at
   - `refresh_tokens` 表：id, user_id, token_hash, expires_at, created_at, revoked_at
   - `password_reset_tokens` 表：id, user_id, token_hash, expires_at, created_at, used_at
   - `login_attempts` 表：ip_address, attempt_count, last_attempt_at, locked_until
   - `roles` 和 `user_roles` 关联表

2. **002_add_indexes.sql** - 性能优化索引：
   - users: username（唯一）、email（唯一）、status
   - refresh_tokens: user_id、token_hash（唯一）、expires_at
   - password_reset_tokens: token_hash（唯一）、expires_at
   - login_attempts: ip_address（唯一）

**验收标准:**
- [x] SQL 脚本可在 PostgreSQL 14+ 正常执行
- [x] 所有主键、外键、唯一约束定义正确
- [x] 索引命名规范：`idx_<table>_<column>`
- [x] 字段类型选择合理（使用 `timestamptz`、`uuid`、`bigint` 等）
- [x] 支持 `sqlx migrate run` 执行

---

## Phase 2: gRPC 接口定义与代码生成

### Task 2.1: Proto 文件定义
**文件:** `proto/koduck/auth/v1/auth.proto`

**详细要求:**
1. 定义 package：`koduck.auth.v1`
2. 配置选项：
   - `go_package`
   - `java_package`
   - 注意：不使用 `rust_package`，Rust 模块路径由 `build.rs` 控制
3. 定义 `AuthService` 服务（9 个 RPC 方法）：
   - `ValidateCredentials` — 凭证验证
   - `ValidateToken` — Token 验证
   - `GetUser` — 用户信息查询
   - `GetUserRoles` — 用户角色权限
   - `RevokeToken` — Token 吊销
   - `Logout` — 用户登出（对齐 REST `POST /logout`）
   - `GetSecurityConfig` — 安全配置查询
   - `GetJwks` — JWKS 公钥分发
   - `HealthCheck` — 健康检查
4. 定义 `TokenService` 服务（3 个 RPC 方法）：
   - `IntrospectAccessToken` — OIDC RFC 7662 Token 自省
   - `RefreshToken` — Token 刷新
   - `GenerateTokenPair` — 内部 Token 生成
5. 定义所有消息类型（参考设计文档 3.1 节）
6. 定义枚举：`TokenType`、`UserStatus`、`ServingStatus`
7. 错误处理：错误通过 gRPC Status 返回，不在 Response body 中携带（IntrospectToken 除外）

**验收标准:**
- [ ] 完整的 proto 文件，与设计文档 3.1 节一致
- [ ] 所有 message、service、enum 定义正确
- [ ] 字段编号正确（proto3 语法）
- [ ] 使用 `google.protobuf.Timestamp` 和 `google.protobuf.Empty`
- [ ] 包含必要的导入语句

---

### Task 2.2: 配置 tonic-build
**文件:** `build.rs`

**详细要求:**
1. 配置 `tonic-build` 编译 proto 文件
2. 设置输出目录：`src/grpc/proto/`
3. 配置编译选项：
   - 生成服务器端代码
   - 生成客户端代码（供其他服务调用）
   - 使用 prost 进行序列化

**验收标准:**
- [ ] `build.rs` 正确配置 tonic-build
- [ ] proto 文件变更后自动重新编译
- [ ] 生成代码输出到正确目录
- [ ] `cargo build` 成功执行

---

### Task 2.3: 生成代码验证
**执行命令:**
```bash
cargo build
```

**验收标准:**
- [ ] 成功生成 `auth.rs` 和 `auth_grpc.rs`
- [ ] `AuthService` trait 可用
- [ ] `TokenService` trait 可用
- [ ] 所有消息类型可导入
- [ ] 无编译警告

---

## Phase 3: 数据层实现

### Task 3.1: 数据模型定义
**文件:**
- `src/model/mod.rs`
- `src/model/user.rs`
- `src/model/token.rs`
- `src/model/request.rs`
- `src/model/response.rs`

**详细要求:**
1. **user.rs**:
   - `User` 结构体（对应数据库表和 proto UserInfo）
   - `UserStatus` 枚举（映射到 proto）
   - `From`/`Into` trait 实现（与 proto 互转）

2. **token.rs**:
   - `Claims` 结构体（JWT claims）
   - `TokenType` 枚举
   - `RefreshTokenRecord` 结构体

3. **request.rs**:
   - `LoginRequest`: username/email, password, captcha?
   - `RegisterRequest`: username, email, password
   - `RefreshTokenRequest`: refresh_token
   - `LogoutRequest`: refresh_token (optional)
   - `ForgotPasswordRequest`: email
   - `ResetPasswordRequest`: token, new_password
   - 使用 `validator` crate 添加字段校验

4. **response.rs**:
   - `ApiResponse<T>` 统一响应包装
   - `TokenResponse`: access_token, refresh_token, expires_in, token_type
   - `SecurityConfigResponse`: password_policy, lockout_policy
   - `UserResponse`: 用户信息

**验收标准:**
- [ ] 所有模型结构体定义完整
- [ ] 与 proto message 的互转实现
- [ ] 请求 DTO 字段校验注解
- [ ] 使用 `serde` 进行序列化/反序列化
- [ ] 敏感字段使用 `#[serde(skip)]` 或 `SecretString`

---

### Task 3.2: Repository 层实现
**文件:**
- `src/repository/mod.rs`
- `src/repository/user_repository.rs`
- `src/repository/refresh_token_repository.rs`
- `src/repository/password_reset_repository.rs`

**详细要求:**
1. **UserRepository**:
   - `find_by_id(id: i64) -> Result<Option<User>, AppError>`
   - `find_by_username(username: &str) -> Result<Option<User>, AppError>`
   - `find_by_email(email: &str) -> Result<Option<User>, AppError>`
   - `create(user: &CreateUserDto) -> Result<User, AppError>`
   - `update(user: &User) -> Result<(), AppError>`
   - `update_last_login(id: i64) -> Result<(), AppError>`
   - `get_user_roles(user_id: i64) -> Result<Vec<String>, AppError>`
   - `get_user_permissions(user_id: i64) -> Result<Vec<Permission>, AppError>`

2. **RefreshTokenRepository**:
   - `save(token: &RefreshTokenRecord) -> Result<(), AppError>`
   - `find_by_token(token_hash: &str) -> Result<Option<RefreshTokenRecord>, AppError>`
   - `revoke(token_hash: &str) -> Result<(), AppError>`
   - `cleanup_expired() -> Result<u64, AppError>`
   - `revoke_all_user_tokens(user_id: i64) -> Result<(), AppError>`

3. **PasswordResetRepository**:
   - `save(token: &PasswordResetToken) -> Result<(), AppError>`
   - `find_by_token(token_hash: &str) -> Result<Option<PasswordResetToken>, AppError>`
   - `mark_as_used(token_hash: &str) -> Result<(), AppError>`
   - `cleanup_expired() -> Result<u64, AppError>`

**验收标准:**
- [ ] 所有方法使用 sqlx 实现
- [ ] 使用 `sqlx::query_as!` 进行类型安全查询
- [ ] 事务处理（需要时使用 `sqlx::Transaction`）
- [ ] 错误处理完善，转换为 AppError
- [ ] 单元测试覆盖

---

### Task 3.3: Redis 缓存封装
**文件:** `src/repository/cache.rs`

**详细要求:**
1. 使用 `deadpool-redis` 创建连接池
2. 实现方法：
   - `add_to_token_blacklist(jti: &str, exp: usize) -> Result<(), AppError>`
   - `is_token_revoked(jti: &str) -> Result<bool, AppError>`
   - `incr_login_attempt(ip: &str) -> Result<i32, AppError>`
   - `get_login_attempts(ip: &str) -> Result<i32, AppError>`
   - `reset_login_attempts(ip: &str) -> Result<(), AppError>`
   - `lock_ip(ip: &str, duration_secs: u64) -> Result<(), AppError>`
   - `is_ip_locked(ip: &str) -> Result<bool, AppError>`

**验收标准:**
- [x] Redis 连接池配置正确
- [x] 所有缓存操作封装完善
- [x] TTL 设置正确
- [x] 错误处理转换为 AppError
- [x] 支持连接池健康检查

---

## Phase 4: 核心业务逻辑

### Task 4.1: JWT 服务实现
**文件:**
- `src/jwt/mod.rs`
- `src/jwt/generator.rs`
- `src/jwt/validator.rs`
- `src/jwt/jwks.rs`

**详细要求:**
1. **JwtService 结构体**:
   - `private_key: EncodingKey`
   - `public_key: DecodingKey`
   - `key_id: String`
   - `access_expiration: i64`
   - `refresh_expiration: i64`

2. **实现方法**:
   - `new(private_key_pem, public_key_pem, key_id, access_exp, refresh_exp) -> Result<Self, AppError>`
   - `generate_access_token(user_id, username, email, roles) -> Result<String, AppError>`
   - `generate_refresh_token(user_id) -> Result<String, AppError>`
   - `validate_token(token) -> Result<Claims, AppError>`
   - `get_key_id() -> &str`

3. **JWKS 实现**:
   - 从 RSA 公钥提取模数(n)和指数(e)
   - Base64URL 编码
   - 生成 JWK 结构

**验收标准:**
- [ ] 使用 `jsonwebtoken` crate，RS256 算法
- [ ] Access Token 包含完整用户信息
- [ ] Refresh Token 仅包含 user_id
- [ ] Token 过期时间配置化
- [ ] JWKS 生成正确，可被其他服务验证
- [ ] 密钥加载支持从文件读取 PEM

---

### Task 4.2: 密码加密服务
**文件:** `src/crypto/password.rs`

**详细要求:**
1. 使用 `argon2` crate（Argon2id 变体）
2. 实现函数：
   - `hash_password(password: &str) -> Result<String, AppError>`
   - `verify_password(password: &str, hash: &str) -> Result<bool, AppError>`
3. 配置参数（从 Config 读取）：
   - memory_cost: 65536 (64 MB)
   - time_cost: 3
   - parallelism: 4

**验收标准:**
- [ ] 密码哈希使用 Argon2id
- [ ] 参数可配置
- [ ] 哈希结果包含 salt
- [ ] 验证性能测试（< 100ms）
- [ ] 线程安全

---

### Task 4.3: 认证服务业务逻辑
**文件:** `src/service/auth_service.rs`

**详细要求:**
1. **结构体**: `AuthService { user_repo, token_repo, redis, jwt_service, config }`

2. **实现方法**:
   - `validate_credentials(username, password) -> Result<(User, Vec<String>), AppError>`
     - 查询用户
     - 验证密码（Argon2）
     - 检查账户状态
     - 返回用户和角色
   
   - `login(req, ip_address, user_agent) -> Result<TokenResponse, AppError>`
     - 检查 IP 是否被锁定
     - 验证凭据
     - 生成 Token 对
     - 保存 Refresh Token
     - 更新最后登录时间
     - 重置登录失败计数
   
   - `register(req) -> Result<TokenResponse, AppError>`
     - 检查用户名/邮箱是否已存在
     - 密码哈希
     - 创建用户
     - 生成 Token 对
   
   - `refresh_token(req) -> Result<TokenResponse, AppError>`
     - 验证 Refresh Token
     - 检查是否被吊销
     - 轮换 Refresh Token（删除旧，创建新）
     - 生成新的 Access Token
   
   - `logout(refresh_token_opt) -> Result<(), AppError>`
     - 如果有 refresh_token，吊销它
   
   - `forgot_password(req, ip_address) -> Result<(), AppError>`
     - 查找用户
     - 生成重置令牌
     - 保存到数据库
     - 发送邮件（异步，调用 koduck-user 或消息队列）
   
   - `reset_password(req) -> Result<(), AppError>`
     - 验证重置令牌
     - 更新密码
     - 吊销用户所有 Refresh Token
   
   - `get_security_config() -> Result<SecurityConfigResponse, AppError>`
     - 返回密码策略、锁策略等配置

**验收标准:**
- [ ] 所有方法按设计实现
- [ ] 登录失败次数限制和 IP 锁定
- [ ] Refresh Token 轮换机制
- [ ] 密码重置流程完整
- [ ] 安全事件记录（日志）
- [ ] 与 koduck-user 服务集成（如果需要）

---

### Task 4.4: Token 服务业务逻辑
**文件:** `src/service/token_service.rs`

**详细要求:**
1. **结构体**: `TokenService { jwt_service, token_repo, redis }`

2. **实现方法**:
   - `introspect_token(token) -> Result<IntrospectResult, AppError>`
     - 验证 Token 签名和过期
     - 检查是否在黑名单
     - 返回 Token 状态和用户信息
   
   - `revoke_token(token, user_id) -> Result<(), AppError>`
     - 将 Token JTI 加入黑名单（Redis）
     - 可选：记录吊销日志

**验收标准:**
- [ ] Token 自省功能完整
- [ ] 黑名单机制有效
- [ ] 吊销操作幂等
- [ ] 支持批量吊销用户所有 Token

---

## Phase 5: HTTP API 层

### Task 5.1: HTTP Handler 实现
**文件:**
- `src/http/handler/mod.rs`
- `src/http/handler/auth.rs`
- `src/http/handler/jwks.rs`
- `src/http/handler/health.rs`

**详细要求:**
1. **auth.rs** - 实现 handler（参考设计文档 4.3 节）：
   - `login(State, ConnectInfo, Json<LoginRequest>) -> Result<Json<ApiResponse<TokenResponse>>, AppError>`
   - `register(State, Json<RegisterRequest>) -> Result<Json<ApiResponse<TokenResponse>>, AppError>`
   - `refresh_token(State, Json<RefreshTokenRequest>) -> Result<Json<ApiResponse<TokenResponse>>, AppError>`
   - `logout(State, Json<Option<LogoutRequest>>) -> Result<Json<ApiResponse<()>>, AppError>`
   - `security_config(State) -> Result<Json<ApiResponse<SecurityConfigResponse>>, AppError>`
   - `forgot_password(State, ConnectInfo, Json<ForgotPasswordRequest>) -> Result<Json<ApiResponse<()>>, AppError>`
   - `reset_password(State, Json<ResetPasswordRequest>) -> Result<Json<ApiResponse<()>>, AppError>`

2. **jwks.rs**:
   - `get_jwks(State) -> Result<Json<JwksResponse>, AppError>`
   - 返回 JWKS JSON 格式

3. **health.rs**:
   - `health_check() -> &'static str`
   - `actuator_health(State) -> Json<HealthResponse>`
   - `liveness() -> StatusCode`
   - `readiness(State) -> Result<StatusCode, AppError>`

**验收标准:**
- [ ] 所有 handler 与设计文档 4.1 节 API 列表一致
- [ ] 从 Header 获取 User-Agent
- [ ] 从 ConnectInfo 获取 IP 地址
- [ ] 统一响应格式
- [ ] 错误正确处理

---

### Task 5.2: 路由配置
**文件:** `src/http/routes.rs`

**详细要求:**
1. 按设计文档 4.1 节配置路由：
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/register`
   - `POST /api/v1/auth/refresh`
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/auth/security-config`
   - `POST /api/v1/auth/forgot-password`
   - `POST /api/v1/auth/reset-password`
   - `GET /.well-known/jwks.json`
   - `GET /health`
   - `GET /actuator/health`
   - `GET /actuator/health/liveness`
   - `GET /actuator/health/readiness`
   - `GET /metrics`

2. 配置中间件：
   - CORS
   - Trace（请求日志）
   - Compression
   - Request ID

**验收标准:**
- [ ] 所有路由配置正确
- [ ] 路由列表与设计文档一致
- [ ] Tower HTTP 中间件正确集成
- [ ] 路由测试通过

---

### Task 5.3: 中间件实现
**文件:**
- `src/http/middleware/mod.rs`
- `src/http/middleware/logging.rs`
- `src/http/middleware/error_handler.rs`

**详细要求:**
1. **logging.rs**:
   - 使用 `tracing` 记录请求/响应
   - 包含：request_id, method, path, status, duration, ip
   - 敏感信息脱敏（如密码）

2. **error_handler.rs**:
   - 捕获所有错误并转换为统一 JSON 响应
   - 区分客户端错误（4xx）和服务器错误（5xx）
   - 服务器错误不暴露内部信息

**验收标准:**
- [ ] 每个请求有唯一 request_id
- [ ] 请求日志包含完整上下文
- [ ] 错误响应格式统一
- [ ] 性能开销可接受

---

## Phase 6: gRPC 服务层

### Task 6.1: gRPC AuthService 实现
**文件:** `src/grpc/auth_service.rs`

**详细要求:**
1. **结构体**: `GrpcAuthService { auth_service, token_service }`

2. 实现 `AuthService` trait（9 个方法）：
   - `validate_credentials` - 调用 auth_service.validate_credentials
   - `validate_token` - 调用 token_service.introspect_token
   - `get_user` - 根据 identifier 查询用户
   - `get_user_roles` - 获取用户角色和权限
   - `revoke_token` - 调用 token_service.revoke_token
   - `logout` - 调用 auth_service.logout
   - `get_security_config` - 调用 auth_service.get_security_config
   - `get_jwks` - 返回 JWKS
   - `health_check` - 返回服务状态（含 version、timestamp、details）

3. 实现 proto 到内部类型的转换

**验收标准:**
- [ ] 实现设计文档 7.2 节所有方法
- [ ] tonic::async_trait 正确使用
- [ ] Status Code 映射合理
- [ ] 日志记录完整
- [ ] 错误处理转换为 tonic::Status

---

### Task 6.2: gRPC TokenService 实现
**文件:** `src/grpc/token_service.rs`

**详细要求:**
1. **结构体**: `GrpcTokenService { token_service }`

2. 实现 `TokenService` trait（3 个方法）：
   - `introspect_access_token` - Token 自省（OIDC RFC 7662，active=false 通过 Response 返回）
   - `refresh_token` - 刷新 Token
   - `generate_token_pair` - 内部 Token 对生成

**验收标准:**
- [ ] Token 自省返回完整信息
- [ ] Refresh Token 逻辑正确
- [ ] 错误处理完善

---

### Task 6.3: gRPC Server 启动
**文件:**
- `src/grpc/mod.rs`
- `src/grpc/server.rs`

**详细要求:**
1. **server.rs**:
   - 创建 gRPC Server 构建函数
   - 注册 AuthService
   - 注册 TokenService
   - 集成 `tonic-health` 健康检查
   - 集成 `tonic-reflection`（可选）

2. **mod.rs**:
   - 导出 proto 生成的模块
   - 导出服务实现

**验收标准:**
- [ ] gRPC Server 可独立启动
- [ ] 健康检查端点可用
- [ ] 支持优雅关闭
- [ ] 反射服务可访问（调试用途）

---

## Phase 7: 集成测试与部署

### Task 7.1: 主入口整合
**文件:**
- `src/main.rs`
- `src/lib.rs`
- `src/state.rs`

**详细要求:**
1. **state.rs**:
   - `AppState` 结构体包含：
     - `config: Config`
     - `db_pool: sqlx::PgPool`
     - `redis_pool: deadpool_redis::Pool`
     - `auth_service: Arc<AuthService>`
     - `token_service: Arc<TokenService>`
     - `jwt_service: Arc<JwtService>`

2. **main.rs**（参考设计文档 7.3 节）：
   - 初始化 tracing
   - 加载配置
   - 创建连接池
   - 初始化服务
   - 使用 `tokio::select!` 同时运行 HTTP 和 gRPC
   - 优雅关闭处理

3. **lib.rs**:
   - 声明所有模块
   - 导出公共 API

**验收标准:**
- [ ] 应用可正常启动
- [ ] HTTP (8081) 和 gRPC (50051) 同时监听
- [ ] 状态共享正确
- [ ] 优雅关闭处理完善
- [ ] 指标端点 (9090) 可用

---

### Task 7.2: 集成测试
**文件:**
- `tests/integration_tests.rs`
- `tests/grpc_tests.rs`
- `tests/common/mod.rs`

**详细要求:**
1. **common/mod.rs**:
   - 测试辅助函数
   - 测试数据库初始化
   - 测试用户创建/清理

2. **integration_tests.rs**:
   - HTTP API 测试：
     - 登录成功/失败
     - 注册
     - Token 刷新
     - 登出
     - 密码重置流程
     - JWKS 获取
   - 使用 `reqwest` 进行 HTTP 测试

3. **grpc_tests.rs**:
   - gRPC 服务测试：
     - ValidateCredentials
     - ValidateToken
     - GetUser
     - RevokeToken
   - 使用 `tonic` 客户端测试

**验收标准:**
- [ ] 测试覆盖主要业务场景
- [ ] 使用 testcontainers 或内存数据库
- [ ] 每个测试独立，可并行运行
- [ ] CI 可运行

---

### Task 7.3: Dockerfile
**文件:** `Dockerfile`

**详细要求:**
1. 多阶段构建：
   - Stage 1: Builder（使用 `rust:1.75`）
   - Stage 2: Runtime（使用 `debian:bookworm-slim` 或 `distroless/cc`）

2. 优化：
   - 缓存依赖层
   - 使用 cargo-chef 或类似工具
   - 静态链接或最小化运行时依赖

3. 配置：
   - 暴露端口：8081, 50051, 9090
   - 健康检查
   - 非 root 用户运行

**验收标准:**
- [ ] 镜像大小 < 100MB（运行时）
- [ ] 构建时间优化
- [ ] 安全扫描通过（无高危漏洞）
- [ ] 健康检查配置正确

---

### Task 7.4: K8s 部署配置
**文件:**
- `k8s/base/koduck-auth-deployment.yaml`
- `k8s/base/koduck-auth-service.yaml`
- `k8s/base/koduck-auth-secrets.yaml`

**详细要求:**
1. **deployment.yaml**（参考设计文档 9.1 节）：
   - 2 个副本
   - 资源限制：requests 100m/64Mi, limits 500m/256Mi
   - 存活探针和就绪探针
   - 环境变量配置
   - JWT 密钥挂载
   - Prometheus 监控注解

2. **service.yaml**（参考设计文档 5.3 节）：
   - ClusterIP Service，端口 8081（HTTP）和 50051（gRPC）
   - Headless Service 用于 gRPC 客户端负载均衡（可选）

3. **secrets.yaml**（示例，实际使用 sealed-secrets 或外部 secret 管理）：
   - JWT 密钥
   - 数据库连接字符串
   - 内部 API 密钥

**验收标准:**
- [ ] K8s 配置完整
- [ ] 资源限制合理
- [ ] 探针配置正确
- [ ] Secret 管理安全
- [ ] 可在本地 kind/k3s 运行

---

### Task 7.5: APISIX 路由配置脚本
**文件:** `scripts/apisix-route-init-auth.sh`

**详细要求:**
1. 按设计文档 9.2 节配置路由：
   - 路由 1: `/api/v1/auth/*` → koduck-auth:8081（HTTP）
   - 路由 2: `/.well-known/jwks.json` → koduck-auth:8081（HTTP）
   - 路由 3: `/koduck.auth.v1.AuthService/*` → koduck-auth:50051（gRPC，key-auth 保护）
   - 路由 4: `/grpc.reflection.v1alpha.ServerReflection/*`（可选，gRPC 反射）

2. 功能：
   - 支持 dry-run 模式
   - 检查现有路由并更新
   - 返回配置结果

**验收标准:**
- [ ] 脚本可执行
- [ ] 所有路由配置正确
- [ ] 支持 APISIX Admin API 认证
- [ ] 错误处理完善
- [ ] 提供回滚命令

---

## 附录

### A. 开发环境快速启动

```bash
# 1. 创建 feature 分支
git checkout dev && git pull origin dev
git worktree add ../koduck-auth-rust -b feature/koduck-auth-rust-grpc

# 2. 进入 worktree
cd ../koduck-auth-rust

# 3. 初始化项目
cargo init --name koduck-auth

# 4. 创建目录结构
mkdir -p src/{grpc/{proto,handler},http/{handler,middleware},model,repository,service,jwt,crypto,client,util}
mkdir -p {tests,benches,migrations,proto/koduck/auth/v1,scripts,k8s/base}

# 5. 安装依赖（开发用）
cargo install cargo-watch sqlx-cli cargo-tarpaulin

# 6. 设置数据库
sqlx database create
sqlx migrate run

# 7. 开发完成后提交
git add .
git commit -m "feat(auth): implement koduck-auth rust grpc service"
git push -u origin feature/koduck-auth-rust-grpc

# 8. 创建 PR
cd ../koduck-quant
gh pr create --base dev --head feature/koduck-auth-rust-grpc \
  --title "feat(auth): Koduck-Auth Rust + gRPC 服务实现" \
  --body "实现 koduck-auth Rust 版本，支持 HTTP REST API 和 gRPC 双协议"
```

### B. 依赖版本参考

```toml
# 核心依赖版本（与设计文档一致）
tokio = "1.35"
axum = "0.7"
tonic = "0.11"
sqlx = "0.7"
jsonwebtoken = "9.2"
argon2 = "0.5"
deadpool-redis = "0.14"
```

### C. 相关文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 设计文档 | [../design/koduck-auth-rust-grpc-design.md](../design/koduck-auth-rust-grpc-design.md) | 完整设计方案 |
| 原服务设计 | [../design/koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) | 原服务参考 |
| JWT 架构 | [../design/koduck-user-jwt-design.md](../design/koduck-user-jwt-design.md) | JWT 设计细节 |

### D. 任务追踪模板

创建 Issue 时使用以下模板：

```markdown
## 任务: [Task ID]
**所属 Phase**: [Phase X]
**优先级**: [P0/P1/P2]
**预估工时**: [X 天]
**依赖**: [Task IDs]

### 目标
[简要描述]

### 详细要求
1. [要求 1]
2. [要求 2]

### 验收标准
- [ ] [标准 1]
- [ ] [标准 2]

### 参考文档
- [设计文档章节]

### 备注
[其他信息]
```

---

*文档版本: 1.0*  
*创建日期: 2026-04-07*  
*作者: Koduck Team*
