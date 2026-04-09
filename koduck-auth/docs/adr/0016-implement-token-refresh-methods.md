# ADR-0016: Implement Token Refresh and Generation Methods

- Status: Accepted
- Date: 2026-04-08
- Issue: #660

## Context

gRPC TokenService 有两个方法尚未实现：

1. **refresh_token**: 用于刷新过期的 access token
   - 当前返回 unimplemented 错误
   - 需要调用 auth_service.refresh_token 完成实际的刷新逻辑

2. **generate_token_pair**: 用于内部服务间直接生成 token 对
   - 当前返回 unimplemented 错误
   - 需要直接调用 jwt_service 生成 token，无需验证旧 token
   - 这是内部服务调用，用于服务间 token 生成

## Decision

### 1. 依赖注入扩展

GrpcTokenService 需要新增依赖：

```rust
pub struct GrpcTokenService {
    token_service: TokenServiceImpl,
    auth_service: AuthServiceImpl,  // 新增：用于 refresh_token
    jwt_service: JwtService,        // 新增：用于 generate_token_pair
}
```

### 2. refresh_token 实现

流程：
1. 从请求中提取 refresh_token
2. 调用 auth_service.refresh_token 验证旧 token 并生成新 pair
3. 返回新的 token pair

```rust
let refresh_req = RefreshTokenRequest {
    refresh_token: req.refresh_token,
};

let token_response = self.auth_service.refresh_token(refresh_req).await?;

RefreshTokenResponse {
    tokens: Some(TokenPair {
        access_token: token_response.tokens.access_token,
        refresh_token: token_response.tokens.refresh_token,
        token_type: token_response.tokens.token_type,
        expires_in: token_response.tokens.expires_in,
    }),
}
```

### 3. generate_token_pair 实现

流程：
1. 从请求中提取用户信息（user_id, username, email, roles）
2. 直接调用 jwt_service 生成 access_token 和 refresh_token
3. 返回 token pair

```rust
let access_token = self.jwt_service.generate_access_token(
    req.user_id,
    &req.username,
    &req.email,
    &req.roles,
)?;

let refresh_token = self.jwt_service.generate_refresh_token(req.user_id)?;

GenerateTokenPairResponse {
    tokens: Some(TokenPair {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: self.jwt_service.access_expiration(),
    }),
}
```

### 4. JwtService 扩展

需要添加方法获取 token 过期时间配置：

```rust
impl JwtService {
    pub fn access_expiration(&self) -> i64 {
        self.access_expiration
    }
    
    pub fn refresh_expiration(&self) -> i64 {
        self.refresh_expiration
    }
}
```

## Consequences

### 正向影响

1. **功能完整**: TokenService 所有方法都能正常工作
2. **服务间协作**: 支持服务间 token 刷新和生成
3. **内部调用**: generate_token_pair 可用于内部服务直接生成 token

### 代价与风险

1. **API 变更**: GrpcTokenService::new 签名变更，需要更新 server.rs 和 main.rs
2. **循环依赖风险**: TokenService 依赖 AuthService，需要注意避免循环依赖

### 兼容性影响

- **破坏性变更**: GrpcTokenService::new 需要新增参数
- **需要更新**: server.rs 和 main.rs 中创建 GrpcTokenService 的代码

## Implementation Plan

1. **JwtService**: 添加 access_expiration 和 refresh_expiration getter 方法
2. **GrpcTokenService**:
   - 修改结构体添加 auth_service 和 jwt_service 字段
   - 更新构造函数
   - 实现 refresh_token 和 generate_token_pair 方法
3. **grpc/server.rs**: 更新 GrpcTokenService 创建代码
4. **main.rs**: 注入新的依赖到 GrpcTokenService

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 6.2
- gRPC TokenService 设计: `docs/koduck-auth-rust-grpc-design.md`
