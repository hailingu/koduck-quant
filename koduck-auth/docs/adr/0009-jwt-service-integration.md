# ADR-0009: JWT 服务集成与密钥管理

- Status: Accepted
- Date: 2026-04-08
- Issue: #646

## Context

koduck-auth 的 JWT 模块已实现核心功能（JwtService、JwtValidator、JwksService），但存在两个关键缺口：

1. **服务未实例化**: JWT 服务未在应用启动时创建，state.rs 中没有 JwtService 实例
2. **密钥未加载**: 未从配置文件读取 JWT 密钥路径并加载 PEM 文件
3. **Token 生成占位**: AuthService::generate_token_pair 仍是 "placeholder_access_token" 占位实现

需要完成 JWT 服务的集成，使认证流程真正可用。

## Decision

### 1. 密钥加载策略

在 state.rs 初始化时加载 JWT 密钥：

```rust
// 1. 从配置文件获取密钥路径
let private_key_path = &config.jwt.private_key_path;
let public_key_path = &config.jwt.public_key_path;

// 2. 开发环境自动生成密钥（如果文件不存在）
let auto_generate = env::var("KODUCK_AUTH_DEV_MODE").is_ok();
let (private_key, public_key) = load_or_generate_keys(
    private_key_path, 
    public_key_path, 
    auto_generate
).await?;

// 3. 创建 JwtService
let jwt_service = JwtService::new(
    &private_key,
    config.jwt.key_id.clone(),
    config.jwt.access_token_expiration_secs,
    config.jwt.refresh_token_expiration_secs,
    config.jwt.issuer.clone(),
    config.jwt.audience.clone(),
)?;
```

### 2. 开发环境密钥生成

开发环境（`KODUCK_AUTH_DEV_MODE=true`）下，如果密钥文件不存在，自动生成 RSA 密钥对：

- 使用 `rsa` crate 生成 2048 位密钥
- 保存到配置的密钥路径
- 便于开发测试，无需手动生成

### 3. 服务依赖注入

AuthService 接收 JwtService 依赖：

```rust
pub struct AuthService {
    user_repo: UserRepository,
    token_repo: RefreshTokenRepository,
    redis: RedisCache,
    jwt_service: JwtService,
    db_pool: PgPool,
    config: Arc<Config>,
}
```

### 4. Token 生成实现

AuthService::generate_token_pair 使用真实 JWT：

```rust
async fn generate_token_pair(&self, user: &User, roles: &[String]) -> Result<TokenPair> {
    // 生成访问令牌
    let access_token = self.jwt_service.generate_access_token(
        user.id,
        &user.username,
        &user.email,
        roles,
    )?;
    
    // 生成刷新令牌
    let refresh_token = self.jwt_service.generate_refresh_token(user.id)?;
    
    // 保存刷新令牌到数据库...
}
```

## Consequences

### 正向影响

1. **功能完整**: Token 生成使用真实 JWT，符合 RFC 7519
2. **安全性**: RSA 签名，支持密钥轮换
3. **开发便利**: 开发环境自动生成密钥，无需手动配置
4. **可测试性**: JwtService 可独立测试

### 代价与风险

1. **启动依赖**: 应用启动需要有效密钥，否则启动失败
2. **密钥管理**: 生产环境需要安全地管理和轮换密钥
3. **文件权限**: 密钥文件需要适当的权限控制

### 兼容性影响

- **API 兼容**: Token 格式对客户端透明，无破坏性变更
- **配置兼容**: 新增密钥路径配置，需提供默认值

## Implementation Plan

1. **state.rs**: 
   - 添加 `jwt_service: JwtService` 字段
   - 初始化时加载密钥并创建 JwtService
   - 提供 `jwt_service()` 访问方法

2. **main.rs**: 
   - 从 state 获取 jwt_service
   - 注入到 AuthService

3. **auth_service.rs**: 
   - 添加 `jwt_service` 字段
   - 实现真实的 `generate_token_pair`
   - 移除占位实现

4. **密钥加载工具**: 
   - 实现 `load_or_generate_keys` 函数
   - 支持开发环境自动生成

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 4.1
- JWT RFC: https://tools.ietf.org/html/rfc7519
- RSA 密钥生成: https://docs.rs/rsa/
