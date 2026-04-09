# ADR-0015: Implement Missing gRPC AuthService Methods

- Status: Accepted
- Date: 2026-04-08
- Issue: #658

## Context

koduck-auth gRPC AuthService 有 4 个方法尚未完全实现：

1. **get_user**: 需要根据 identifier（user_id/username/email）查询用户信息
2. **get_user_roles**: 需要返回用户的角色和权限列表
3. **get_jwks**: 需要返回真实的 JWKS 公钥数据
4. **validate_token**: 需要从 token 自省结果中提取完整的用户信息

当前实现都是占位符，返回 unimplemented 错误或空数据。

## Decision

### 1. 依赖注入扩展

GrpcAuthService 需要新增依赖：

```rust
pub struct GrpcAuthService {
    auth_service: AuthServiceImpl,
    token_service: TokenServiceImpl,
    user_repo: UserRepository,      // 新增：查询用户信息
    jwks_service: JwksService,      // 新增：获取 JWKS
}
```

### 2. get_user 实现

支持三种 identifier 类型：

```rust
match req.identifier {
    Some(get_user_request::Identifier::UserId(id)) => {
        self.user_repo.find_by_id(id).await
    }
    Some(get_user_request::Identifier::Username(name)) => {
        self.user_repo.find_by_username(&name).await
    }
    Some(get_user_request::Identifier::Email(email)) => {
        self.user_repo.find_by_email(&email).await
    }
    None => Err(Status::invalid_argument("Identifier required")),
}
```

### 3. get_user_roles 实现

调用 repository 获取角色和权限：

```rust
let roles = self.user_repo.get_user_roles(req.user_id).await?;
let permissions = self.user_repo.get_user_permissions(req.user_id).await?;
```

注意：需要在 UserRepository 中新增 `get_user_permissions` 方法。

### 4. get_jwks 实现

使用 JwksService 获取真实公钥数据：

```rust
let jwks_json = self.jwks_service.get_jwks()?;
// Parse JSON and convert to proto Jwk messages
```

### 5. validate_token 实现

从 introspect_token 结果提取完整字段：

```rust
match self.token_service.introspect_token(&req.token).await {
    Ok(result) if result.active => {
        let user_id = result.sub
            .as_ref()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        
        ValidateTokenResponse {
            user_id,
            username: result.username.unwrap_or_default(),
            email: result.email.unwrap_or_default(),
            roles: result.roles,
            expires_at: result.exp.map(to_timestamp),
            issued_at: result.iat.map(to_timestamp),
            token_id: result.jti.unwrap_or_default(),
            token_type: TokenType::Access as i32,
        }
    }
    _ => Err(Status::unauthenticated("Invalid token")),
}
```

## Consequences

### 正向影响

1. **功能完整**: AuthService 所有方法都能正常工作
2. **服务间调用**: 其他服务可以通过 gRPC 获取用户信息和验证 token
3. **标准兼容**: JWKS 端点提供标准公钥查询

### 代价与风险

1. **API 变更**: GrpcAuthService::new 签名变更，需要更新 main.rs
2. **新增依赖**: 需要注入 UserRepository 和 JwksService

### 兼容性影响

- **破坏性变更**: GrpcAuthService::new 需要新增参数
- **需要更新**: main.rs 中创建 GrpcAuthService 的代码

## Implementation Plan

1. **UserRepository**: 添加 `get_user_permissions` 方法
2. **GrpcAuthService**: 
   - 修改结构体添加 user_repo 和 jwks_service 字段
   - 更新构造函数
   - 实现 4 个缺失的方法
3. **main.rs**: 更新 GrpcAuthService 创建代码，注入新依赖

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 6.1
- gRPC AuthService 设计: `docs/koduck-auth-rust-grpc-design.md`
