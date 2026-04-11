# ADR-0019: Task 2.3 将用户与角色唯一约束切换为租户内唯一

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #768, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 2.3, ADR-0018

---

## 背景与问题陈述

Task 2.1 已经为 `koduck-user` 引入 `tenant_id` 与最小租户真值，但当前数据库仍保留旧的全局唯一约束：

1. `users.username` 仍然是全局唯一
2. `users.email` 仍然是全局唯一
3. `roles.name` 仍然是全局唯一

这会直接违背 Task 1.1 已冻结的租户语义，即身份唯一性应以 `(tenant_id, user_id)` 为主，用户名、邮箱、角色名也只能在租户内唯一，而不是在全局范围唯一。

---

## 决策驱动因素

1. **语义一致性**: schema 约束必须与根设计文档中的租户边界一致。
2. **平滑迁移**: 已有单租户数据需要继续落在 `default` tenant 下，不要求人工搬迁。
3. **任务边界清晰**: Task 2.3 只处理约束切换，不提前引入 Task 3.x 的 repository / API 逻辑改造。
4. **低风险落地**: 优先通过数据库迁移完成约束替换，避免把运行时行为变更耦合进同一次交付。

---

## 考虑的选项

### 选项 1：继续保留全局唯一，等待 Task 3.x 再统一调整

**优点**:
- 当前改动最少

**缺点**:
- 与冻结的租户语义冲突
- 会阻塞后续租户内查询与写入改造

### 选项 2：在 Task 2.3 通过迁移脚本切换为租户内唯一（选定）

**优点**:
- 变更范围集中在 schema
- 与 Task 2.1 的 `default` tenant 回填策略天然衔接
- 为后续 repository / internal API 租户化扫清数据库约束障碍

**缺点**:
- 运行时查询逻辑仍将在 Task 3.x 才全面显式带 tenant

### 选项 3：直接同时修改 schema、实体、repository、API

**优点**:
- 一次性覆盖更多层次

**缺点**:
- 变更过大，超出 Task 2.3 范围
- 难以区分 schema 约束问题和业务逻辑问题

---

## 决策结果

采用 **选项 2**，通过新的 Flyway 迁移将唯一约束切换为租户内唯一：

1. `users` 从 `UNIQUE (username)` 切换为 `UNIQUE (tenant_id, username)`
2. `users` 从 `UNIQUE (email)` 切换为 `UNIQUE (tenant_id, email)`
3. `roles` 从 `UNIQUE (name)` 切换为 `UNIQUE (tenant_id, name)`
4. 在切换前再次将空 `tenant_id` 收口到 `default`，确保存量单租户数据可平滑迁移

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/resources/db/migration/V3__switch_uniqueness_constraints_to_tenant_scope.sql` | 删除旧的全局唯一约束并添加租户内唯一约束 |
| `koduck-user/src/test/java/com/koduck/integration/UserTenantSchemaMigrationIntegrationTest.java` | 验证约束名称与跨租户/租户内的唯一性行为 |
| `docs/implementation/koduck-auth-user-tenant-semantics-tasks.md` | 回填 Task 2.3 的执行结果与 checklist |

### 迁移策略

1. 再次将 `users.tenant_id` / `roles.tenant_id` 中的空值回填为 `default`
2. 删除旧约束 `uk_users_username`、`uk_users_email`、`uk_roles_name`
3. 新增租户内唯一约束 `uk_users_tenant_username`、`uk_users_tenant_email`、`uk_roles_tenant_name`

---

## 权衡与影响

### 正向影响

- `koduck-user` 的数据库唯一性规则与多租户设计正式一致。
- 后续可以在不同租户中使用相同用户名、邮箱和角色名。
- Task 3.x 可以在不再受全局唯一约束阻碍的前提下推进 repository / API 租户化。

### 负向影响

- 应用层当前仍可能存在默认的全局查询路径，该部分需要在后续任务中继续收口。

### 缓解措施

- 在 Task 3.1 / 3.2 中继续推进 repository 与 internal API 显式带 tenant。
- 用集成测试直接验证迁移后的唯一性行为，避免只改约束名而漏掉真实行为。

---

## 兼容性影响

1. **数据兼容性**: 现有数据仍保留在 `default` tenant 中，可直接迁移。
2. **运行时兼容性**: 本任务不变更 API 契约，仅调整数据库唯一约束。
3. **演进兼容性**: 后续可以在新增租户时复用同名用户名、邮箱和角色名。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-semantics-tasks.md](../../../docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)
- [ADR-0018](./0018-add-tenant-columns-and-minimal-tenant-truth.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
