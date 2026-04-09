# ADR-0007: Repository 层测试策略与事务管理

- Status: Accepted
- Date: 2026-04-08
- Issue: #642

## Context

koduck-auth 的 Repository 层已实现基本的数据访问功能，但缺少：

1. **单元测试覆盖**: UserRepository、RefreshTokenRepository、PasswordResetRepository 没有单元测试，难以保证代码质量和回归测试。

2. **事务管理**: 注册流程涉及多个数据库操作（创建用户 + 分配角色），当前没有事务保护，可能导致数据不一致。

需要设计合理的测试策略和事务管理机制。

## Decision

### 1. 测试策略

采用 **sqlx::test** 宏进行集成测试：

```rust
#[sqlx::test]
async fn test_create_user(pool: PgPool) {
    // 测试代码
}
```

**理由**:
- sqlx::test 自动管理测试数据库生命周期
- 支持在真实 PostgreSQL 上测试，验证 SQL 语句正确性
- 每个测试在独立事务中运行，测试间数据隔离
- 测试失败自动回滚，不污染数据库

**替代方案考虑**:
- Mock 方式: 无法验证 SQL 语句正确性，仅测试业务逻辑
- Testcontainers: 启动慢，资源占用高
- 内存数据库 (SQLite): 与生产环境 PostgreSQL 行为差异

### 2. 事务管理

在 **Service 层** 实现事务控制：

```rust
pub async fn register(&self, req: RegisterRequest) -> Result<TokenResponse> {
    let mut tx = self.db_pool.begin().await?;
    
    // 创建用户
    let user = self.user_repo.create_with_tx(&mut tx, &dto).await?;
    
    // 分配角色
    self.user_repo.assign_role_with_tx(&mut tx, user.id, "USER").await?;
    
    // 提交事务
    tx.commit().await?;
    
    Ok(...)
}
```

**设计原则**:
- Repository 层：提供 `*_with_tx` 方法，接收 `&mut Transaction` 参数
- Service 层：控制事务边界，处理业务逻辑编排
- 错误时事务自动回滚，保证数据一致性

### 3. 事务边界

需要事务保护的操作：

| 操作 | 涉及表 | 事务原因 |
|------|--------|---------|
| 用户注册 | users, user_roles | 创建用户和分配角色需原子性 |
| 密码重置 | password_reset_tokens, users | 验证令牌和更新密码需原子性 |
| 令牌刷新 | refresh_tokens | 吊销旧令牌和创建新令牌 |

## Consequences

### 正向影响

1. **质量保证**: 单元测试覆盖确保 Repository 逻辑正确
2. **数据一致性**: 事务保护避免部分更新导致的数据不一致
3. **可维护性**: 测试作为文档，帮助理解代码行为
4. **回归测试**: 防止后续修改引入 bug

### 代价与风险

1. **测试依赖**: 需要 PostgreSQL 实例运行测试
2. **测试时间**: 数据库测试比内存测试慢
3. **复杂性**: Repository 需要维护普通方法和事务方法两套接口

### 兼容性影响

- **API 兼容**: Repository 接口新增 `*_with_tx` 方法，旧方法保留
- **行为兼容**: 非事务方法行为不变，新增事务方法供 Service 使用

## Implementation Plan

### Phase 1: Repository 事务方法

为 Repository 添加 `*_with_tx` 方法：

```rust
// UserRepository
pub async fn create_with_tx(
    &self,
    tx: &mut sqlx::Transaction<'_, Postgres>,
    dto: &CreateUserDto,
) -> Result<User>;

pub async fn assign_role_with_tx(
    &self,
    tx: &mut sqlx::Transaction<'_, Postgres>,
    user_id: i64,
    role_name: &str,
) -> Result<()>;
```

### Phase 2: Service 层事务

修改 Service 方法使用事务：

```rust
// AuthService::register
let mut tx = self.db_pool.begin().await?;
// ... 使用 _with_tx 方法
```

### Phase 3: 单元测试

添加 Repository 单元测试：

```rust
#[sqlx::test]
async fn test_user_repository_crud(pool: PgPool) {
    let repo = UserRepository::new(pool);
    // 测试创建、查询、更新
}
```

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 3.2
- sqlx test: https://docs.rs/sqlx/latest/sqlx/attr.test.html
- PostgreSQL 事务: https://www.postgresql.org/docs/current/tutorial-transactions.html
