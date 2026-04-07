# ADR-0003: JWT 服务与业务逻辑集成

- Status: Accepted
- Date: 2026-04-08
- Issue: #634

## Context

koduck-auth 项目已完成 gRPC 服务层实现，但核心业务逻辑中的 Token 生成和验证仍使用 placeholder。当前状态：

- `JwtService` / `JwtValidator` 已实现，但未集成到业务层
- `AuthService::generate_token_pair` 返回 placeholder token
- `TokenService::introspect_token` 仅返回 `Ok(true)`
- Token 吊销和黑名单机制未实现

需要完整集成 JWT 服务，使认证流程真正可用。

## Decision

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      AuthService                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  JwtService │    │ UserRepo    │    │ RefreshToken│     │
│  │  (签发)     │    │ (用户查询)   │    │ Repo (存储) │     │
│  └──────┬──────┘    └─────────────┘    └──────┬──────┘     │
│         │                                       │           │
│         ▼                                       ▼           │
│  ┌─────────────┐                        ┌─────────────┐     │
│  │  RSA 私钥   │                        │ 数据库      │     │
│  └─────────────┘                        └─────────────┘     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     TokenService                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐                        │
│  │ JwtValidator│    │ RedisCache  │                        │
│  │ (验证)      │    │ (黑名单)     │                        │
│  └──────┬──────┘    └─────────────┘                        │
│         │                                                  │
│         ▼                                                  │
│  ┌─────────────┐                                           │
│  │  RSA 公钥   │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

#### 1. Token 生命周期管理

| 阶段 | 操作 | 存储位置 |
|------|------|----------|
| 签发 | JwtService 生成 | 内存（无状态） |
| 刷新 | 验证旧 token → 签发新 token → 吊销旧 refresh token | 数据库 + Redis |
| 验证 | JwtValidator 验证签名和过期时间 | 内存 |
| 吊销 | JTI 加入 Redis 黑名单 | Redis（TTL=token剩余有效期） |

#### 2. Refresh Token 轮换（Rotation）

```rust
// 刷新流程
1. 验证 refresh token 签名和过期
2. 检查 token 是否在黑名单
3. 查询数据库验证 token 未被吊销
4. 生成新的 access_token + refresh_token
5. 吊销旧的 refresh token（数据库标记 + Redis 黑名单）
6. 返回新的 token 对
```

#### 3. 密钥管理策略

- **生产环境**：从 K8s Secret 挂载的文件读取 RSA 密钥对
- **开发环境**：如密钥文件不存在，自动生成临时密钥对
- **密钥格式**：PKCS#8 PEM 格式

#### 4. Redis 黑名单设计

```
Key: token:blacklist:{jti}
Value: 1
TTL: token_expiration - current_time
```

### 代码结构变更

```
src/
├── service/
│   ├── auth_service.rs    # 集成 JwtService
│   ├── token_service.rs   # 集成 JwtValidator + Redis 黑名单
│   └── jwt_service.rs     # 新增：包装 JwtService 和 JwtValidator
├── state.rs               # 初始化 JwtService
└── jwt/
    ├── generator.rs       # JwtService（已存在）
    ├── validator.rs       # JwtValidator（已存在）
    └── jwks.rs            # JWKS 生成（已存在）
```

## Consequences

### 正向影响

1. **安全性提升**：真正的 RSA 签名 Token，支持密钥轮换
2. **无状态认证**：JWT 自带用户信息，减少数据库查询
3. **可扩展性**：Token 验证不依赖数据库，支持水平扩展
4. **标准兼容**：支持 OIDC RFC 7662 Token 自省

### 代价与风险

1. **密钥管理复杂**：需要安全的密钥存储和轮换机制
2. **Token 无法撤销**：JWT 本身无状态，吊销依赖黑名单，存在短暂延迟
3. **Token 大小**：JWT 包含 claims，比 session ID 大

### 兼容性影响

- **API 兼容性**：对外 API 不变，内部实现变更
- **数据库兼容性**：refresh_tokens 表结构不变
- **客户端兼容性**：JWT 格式对客户端透明

## Alternatives Considered

### 1. 使用 Session + Redis 存储

- **拒绝理由**：需要中心化存储，扩展性差，不适合微服务架构

### 2. 使用外部认证服务（Auth0, Keycloak）

- **未采用理由**：增加运维复杂度，需要额外成本，当前阶段自研更合适

### 3. 使用对称加密（HMAC）而非 RSA

- **拒绝理由**：RSA 支持密钥分离（私钥签发/公钥验证），更安全，且支持 JWKS 分发公钥

## Implementation Plan

### Phase 1: JwtService 集成到 AuthService
- [ ] 在 `AuthService` 中添加 `jwt_service: JwtService` 字段
- [ ] 修改 `generate_token_pair` 使用真实 JWT
- [ ] 实现 refresh token 存储到数据库

### Phase 2: JwtValidator 集成到 TokenService
- [ ] 在 `TokenService` 中添加 `jwt_validator: JwtValidator` 字段
- [ ] 实现 `introspect_token` 完整逻辑
- [ ] 实现 Redis 黑名单检查

### Phase 3: Token 吊销和轮换
- [ ] 实现 `revoke_token` 方法（数据库 + Redis）
- [ ] 实现 refresh token 轮换
- [ ] 清理过期 token 的定时任务

### Phase 4: 密钥加载
- [ ] 实现 RSA 密钥文件加载
- [ ] 开发环境自动生成密钥
- [ ] 配置化密钥路径

## Verification

- 登录返回有效 JWT，可通过 jwt.io 验证
- Token 验证通过 JWKS 端点
- Token 吊销后 5 秒内失效（Redis TTL）
- 刷新 token 后旧 refresh token 失效

## References

- 设计文档: `docs/design/koduck-auth-rust-grpc-design.md`
- Issue: #634
- JWT RFC: https://tools.ietf.org/html/rfc7519
- OIDC Token Introspection: https://tools.ietf.org/html/rfc7662
