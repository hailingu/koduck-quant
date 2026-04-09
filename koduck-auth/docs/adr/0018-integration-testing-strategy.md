# ADR-0018: Integration Testing Strategy with Testcontainers

- Status: Accepted
- Date: 2026-04-08
- Issue: #664

## Context

koduck-auth 需要实现完整的集成测试，覆盖 HTTP API 和 gRPC 端点。当前测试文件仅包含空 stub：

- `tests/integration_tests.rs`: HTTP API 测试为空
- `tests/grpc_tests.rs`: gRPC 测试为空
- `tests/common/mod.rs`: 仅包含基本的 init 函数

## Decision

### 1. 使用 testcontainers-postgres

选择 testcontainers-postgres 作为测试数据库，原因：

1. **隔离性**: 每个测试使用独立的 PostgreSQL 容器，完全隔离
2. **真实性**: 使用真实的 PostgreSQL 数据库，不是内存数据库
3. **可并行**: 容器隔离支持测试并行运行
4. **一致性**: 测试环境与生产环境数据库一致

### 2. 测试架构

```
tests/
├── common/
│   ├── mod.rs          # 共享工具和初始化
│   └── test_app.rs     # TestApp 结构体
├── integration_tests.rs # HTTP API 测试
└── grpc_tests.rs       # gRPC 测试
```

### 3. TestApp 设计

TestApp 封装测试所需的全部组件：

```rust
pub struct TestApp {
    pub db_pool: PgPool,
    pub http_client: reqwest::Client,
    pub grpc_channel: Channel,
    pub test_user: TestUser,
}

impl TestApp {
    pub async fn new() -> Self
    pub async fn setup_database(&self) -> Result<()>
    pub async fn create_test_user(&self) -> TestUser
    pub async fn login(&self) -> TokenResponse
}
```

### 4. HTTP API 测试

覆盖的端点：
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /.well-known/jwks.json`

### 5. gRPC 测试

覆盖的方法：
- `AuthService/ValidateCredentials`
- `AuthService/ValidateToken`
- `AuthService/GetUser`
- `AuthService/RevokeToken`

### 6. 数据库迁移

测试自动运行数据库迁移：

```rust
async fn setup_database(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await?;
    Ok(())
}
```

## Consequences

### 正向影响

1. **质量保证**: 完整的集成测试覆盖核心功能
2. **回归防护**: 捕获破坏性变更
3. **文档价值**: 测试作为 API 使用示例
4. **CI 就绪**: 自动化测试可在 CI 中运行

### 代价与风险

1. **测试时间**: testcontainers 启动需要时间（10-30秒）
2. **资源消耗**: 需要 Docker 运行测试
3. **复杂性**: 测试代码量增加

### 兼容性影响

- **无破坏性变更**: 仅添加测试代码
- **开发环境**: 需要安装 Docker

## Implementation Plan

1. **添加依赖**: testcontainers-postgres, reqwest 等到 dev-dependencies
2. **创建 TestApp**: 实现测试基础设施
3. **实现 HTTP 测试**: 覆盖所有 HTTP 端点
4. **实现 gRPC 测试**: 覆盖关键 gRPC 方法
5. **验证**: 确保所有测试通过并可并行运行

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 7.2
- testcontainers-rs: https://github.com/testcontainers/testcontainers-rs
