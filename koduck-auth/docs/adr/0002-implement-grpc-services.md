# ADR-0002: 实现 gRPC AuthService 和 TokenService

- Status: Accepted
- Date: 2026-04-08
- Issue: #632

## Context

koduck-auth 项目已完成基础架构搭建（Phase 1-4），包括：
- 项目目录结构和依赖配置
- gRPC proto 文件定义和 tonic-build 配置
- 数据模型和 Repository 层实现
- JWT 服务和业务逻辑层基础实现

目前需要实现 gRPC 服务层，用于：
1. **服务间通信** - 其他微服务（market, portfolio 等）需要验证 Token 和获取用户信息
2. **统一认证接口** - 内部服务调用使用 gRPC，外部客户端使用 HTTP REST API
3. **性能优化** - gRPC 基于 HTTP/2，支持流式处理和更低的延迟

### 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| gRPC 框架 | tonic 0.11 | Rust 生态最成熟的 gRPC 实现，与 tokio 集成好 |
| 序列化 | prost | 高性能 Protocol Buffers 实现 |
| 健康检查 | tonic-health | 官方健康检查插件，与 Kubernetes 集成 |
| 反射服务 | tonic-reflection | 调试用途，支持 grpcurl 等工具 |

## Decision

### 服务结构设计

```
src/grpc/
├── mod.rs                 # 模块导出
├── server.rs              # gRPC Server 启动和配置
├── auth_service.rs        # AuthService 实现
├── token_service.rs       # TokenService 实现
└── proto/                 # tonic-build 生成代码
    ├── mod.rs
    └── *.rs               # 生成的 Rust 代码
```

### gRPC 服务实现

#### AuthService (9 个 RPC 方法)

| RPC 方法 | 功能 | 对应业务方法 |
|----------|------|-------------|
| ValidateCredentials | 验证用户凭证 | auth_service.login() |
| ValidateToken | 验证 Token 有效性 | token_service.introspect_token() |
| GetUser | 获取用户信息 | user_repo.find_by_id/username/email |
| GetUserRoles | 获取用户角色权限 | user_repo.get_user_roles() |
| RevokeToken | 吊销 Token | token_service.revoke_token() |
| Logout | 用户登出 | auth_service.logout() |
| GetSecurityConfig | 获取安全配置 | auth_service.get_security_config() |
| GetJwks | 获取 JWKS 公钥 | jwt_service.get_jwks() |
| HealthCheck | 健康检查 | tonic-health 内置 |

#### TokenService (3 个 RPC 方法)

| RPC 方法 | 功能 | 说明 |
|----------|------|------|
| IntrospectAccessToken | Token 自省 | 遵循 OIDC RFC 7662 |
| RefreshToken | 刷新 Token | 轮换 Refresh Token |
| GenerateTokenPair | 生成 Token 对 | 内部使用 |

### 错误处理策略

错误通过 gRPC Status 返回，映射关系：

| 业务错误 | gRPC Status Code |
|----------|-----------------|
| Unauthorized | `UNAUTHENTICATED` |
| Forbidden | `PERMISSION_DENIED` |
| NotFound | `NOT_FOUND` |
| Validation | `INVALID_ARGUMENT` |
| Conflict | `ALREADY_EXISTS` |
| Locked | `FAILED_PRECONDITION` |
| RateLimit | `RESOURCE_EXHAUSTED` |
| Internal | `INTERNAL` |

### 类型转换

proto 类型与内部模型互转实现 `From`/`Into` trait：

```rust
// Proto UserInfo -> 内部 UserInfo
impl From<proto::UserInfo> for model::UserInfo { ... }

// 内部 UserInfo -> Proto UserInfo
impl From<model::UserInfo> for proto::UserInfo { ... }
```

## Consequences

### 正向影响

1. **服务解耦** - 认证逻辑中心化，其他服务通过 gRPC 调用验证
2. **性能提升** - gRPC 二进制协议比 HTTP JSON 更高效
3. **类型安全** - Protocol Buffers 编译期类型检查
4. **可观测性** - tonic 集成 tracing，支持分布式链路追踪

### 代价与风险

1. **复杂度增加** - 需要维护 proto 文件和生成的代码
2. **调试难度** - 二进制协议不如 HTTP REST 直观
3. **兼容性** - proto 变更需要协调所有依赖服务

### 兼容性影响

- **API 兼容性** - gRPC 接口新增字段向后兼容（proto3 optional）
- **服务发现** - 使用 Kubernetes Headless Service 支持客户端负载均衡
- **版本管理** - proto 文件版本化，支持多版本并行

## Alternatives Considered

### 1. 仅使用 HTTP REST API

- **拒绝理由**：服务间调用需要更高性能，且 gRPC 支持流式处理

### 2. 使用 gRPC-Gateway 自动生成 HTTP 接口

- **未采用理由**：项目需要保持与现有 Java 版本 API 完全兼容，手动实现更可控

### 3. 使用 JSON-RPC 或 GraphQL

- **拒绝理由**：JSON-RPC 生态较弱，GraphQL 对于内部服务通信过于复杂

## Implementation Plan

### Phase 6.1: AuthService 实现
- [ ] 实现 `GrpcAuthService` 结构体
- [ ] 实现 9 个 RPC 方法
- [ ] 类型转换和错误映射

### Phase 6.2: TokenService 实现
- [ ] 实现 `GrpcTokenService` 结构体
- [ ] 实现 3 个 RPC 方法
- [ ] OIDC RFC 7662 兼容

### Phase 6.3: Server 整合
- [ ] 完善 `GrpcServer` 启动逻辑
- [ ] 集成 tonic-health
- [ ] 主入口同时启动 HTTP (8081) 和 gRPC (50051)

## Verification

- `cargo build` 无错误
- `cargo clippy` 无警告
- gRPC 服务在端口 50051 可访问
- 各 RPC 方法功能测试通过

## References

- 设计文档: `koduck-auth/docs/design/koduck-auth-rust-grpc-design.md`
- 任务清单: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Phase 6
- Issue: #632
- tonic 文档: https://docs.rs/tonic/
