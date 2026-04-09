# ADR-0012: Token 自省与黑名单机制

- Status: Accepted
- Date: 2026-04-08
- Issue: #652

## Context

koduck-auth 需要实现 Token 自省（Token Introspection）和黑名单机制：

1. **Token 自省**: 根据 OAuth 2.0 Token Introspection 规范 (RFC 7662)，服务端需要能够验证 access token 的有效性并返回 token 信息

2. **Token 黑名单**: 当用户登出或 token 被吊销时，需要将 access token 加入黑名单，防止被继续使用

当前实现缺失：
- TokenService 缺少 JwtValidator 依赖
- introspect_token 只是占位实现
- revoke_token 没有将 access token 加入黑名单

## Decision

### 1. Token 自省流程

```rust
pub async fn introspect_token(&self, token: &str) -> Result<TokenIntrospectionResult>
```

流程：
1. 使用 JwtValidator 验证 JWT 签名
2. 检查 token 是否过期
3. 检查 Redis 黑名单（使用 JTI）
4. 返回完整的 token 信息

返回结构：
```rust
pub struct TokenIntrospectionResult {
    pub active: bool,
    pub sub: Option<String>,      // user_id
    pub username: Option<String>,
    pub email: Option<String>,
    pub roles: Vec<String>,
    pub exp: Option<i64>,
    pub iat: Option<i64>,
    pub jti: Option<String>,
}
```

### 2. 黑名单机制

```rust
pub async fn revoke_token(&self, token: &str, user_id: i64) -> Result<()>
```

流程：
1. 解析 access token 获取 JTI 和 exp
2. 将 JTI 加入 Redis 黑名单，TTL = token 剩余有效期
3. 吊销用户的 refresh token

Redis 黑名单存储：
- Key: `token:blacklist:{jti}`
- Value: `1`
- TTL: `exp - current_time`

### 3. 依赖注入

TokenService 需要以下依赖：
- `RefreshTokenRepository`: 管理 refresh token
- `RedisCache`: 黑名单存储
- `JwtValidator`: 验证 JWT

## Consequences

### 正向影响

1. **安全性**: 登出后立即生效，token 无法继续使用
2. **标准兼容**: 符合 OAuth 2.0 Token Introspection 规范
3. **可观测性**: 可以查询 token 状态和用户信息

### 代价与风险

1. **Redis 依赖**: 需要 Redis 支持黑名单
2. **性能开销**: 每次验证都需要查询 Redis
3. **存储开销**: 黑名单会占用 Redis 内存直到 token 过期

### 兼容性影响

- **API 变更**: introspect_token 返回类型从 `bool` 变为 `TokenIntrospectionResult`
- **行为变更**: revoke_token 现在会将 access token 加入黑名单

## Implementation Plan

1. **修改 TokenService 结构**:
   - 添加 `jwt_validator: JwtValidator` 字段
   - 修改构造函数

2. **实现 introspect_token**:
   - 验证 JWT
   - 检查黑名单
   - 返回完整信息

3. **实现 revoke_token**:
   - 解析 token 获取 JTI
   - 加入黑名单
   - 吊销 refresh token

4. **更新 main.rs**:
   - 注入 JwtValidator 到 TokenService

5. **添加单元测试**

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 4.4
- RFC 7662: https://tools.ietf.org/html/rfc7662
