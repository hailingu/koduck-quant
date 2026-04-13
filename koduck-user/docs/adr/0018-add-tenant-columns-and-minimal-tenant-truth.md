# ADR-0018: Task 2.1 为 koduck-user 增加 tenant_id 与最小租户真值

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #763, `../implementation/koduck-user-service-tasks.md` 多租户实施映射, ADR-0017

---

## 背景与问题陈述

Task 1.1 和 Task 1.2 已经冻结了 `tenant_id` 的语义与契约边界，但 `koduck-user` 数据库仍然是单租户结构：

1. `users` 与 `roles` 没有 `tenant_id`
2. `user_roles`、`role_permissions`、`user_credentials` 也没有租户作用域字段
3. 数据库中不存在最小租户真值表，无法给后续认证链路提供稳定来源

如果不先完成这层 schema 演进，后续 Task 2.3 的唯一约束切换、Task 3.x 的 repository 租户化都会缺少基础。

---

## 决策驱动因素

1. **渐进迁移**: 先加列和最小真值，再在后续任务中切唯一约束与查询逻辑。
2. **兼容上线**: 迁移应允许现有单租户数据在 `default` tenant 下继续工作。
3. **关系完整性**: 关系表与凭证表也要具备租户语义，否则后续查询仍需跨表推导。
4. **低风险**: 本任务不提前修改业务查询逻辑，避免把 schema 迁移和行为改造混在一起。

---

## 考虑的选项

### 选项 1：只给 `users`、`roles` 加 `tenant_id`

**优点**:
- 改动最少

**缺点**:
- 关系表与凭证表仍缺少租户语义
- 后续 token / 角色 / 权限链路仍需额外 join 推导

### 选项 2：给主表、关系表、凭证表一起补 tenant 列，并新增最小 `tenants` 表（选定）

**优点**:
- 为后续多租户查询打下统一 schema 基础
- `default` tenant 过渡路径清晰

**缺点**:
- 本阶段会先出现“有 tenant 列但唯一约束仍未切换”的过渡状态

### 选项 3：等 Task 3 再一起修改 schema 和 repository

**优点**:
- 单次改动覆盖更多内容

**缺点**:
- 风险集中，难以定位问题
- 违背任务拆分顺序

---

## 决策结果

采用 **选项 2**，在 `koduck-user` 引入最小多租户 schema：

1. 新增 `tenants` 表，作为最小租户真值，插入默认租户 `default`
2. 为 `users`、`roles` 增加 `tenant_id VARCHAR(128) NOT NULL DEFAULT 'default'`
3. 为 `user_roles`、`role_permissions`、`user_credentials` 增加 `tenant_id VARCHAR(128) NOT NULL DEFAULT 'default'`
4. 增加基础 tenant 索引，但暂不切换用户/角色唯一约束；该动作留给 Task 2.3
5. 通过 Flyway 迁移脚本完成回填，保证现有数据可平滑进入默认租户

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/resources/db/migration/V2__add_tenant_columns.sql` | 新增租户真值表、tenant 列、默认回填与索引 |
| `koduck-user/src/test/java/com/koduck/integration/UserTenantSchemaMigrationIntegrationTest.java` | 用 Testcontainers 验证迁移后的 schema |

### 迁移策略

1. 先创建 `tenants` 表并写入 `default`
2. 再为业务表增加 `tenant_id`
3. 回填已有数据为 `default`
4. 将 `tenant_id` 设为 `NOT NULL` 且保留默认值
5. 唯一约束仍保持旧形态，等待 Task 2.3 再切换

---

## 权衡与影响

### 正向影响

- 为后续 repository 和 internal API 租户化提供 schema 基础。
- 默认 tenant 让现有数据和旧代码仍能继续工作。
- 关系表和凭证表不必在运行时再通过 join 推导 tenant。

### 负向影响

- 当前阶段仍处于“schema 已多租户化，唯一约束尚未切换”的过渡状态。
- 业务代码暂时还不会主动使用这些 tenant 列。

### 缓解措施

- 在 Task 2.3 明确切换租户内唯一约束。
- 在 Task 3.1 再统一更新实体与 repository 查询。

---

## 兼容性影响

1. **运行时兼容性**: 现有写入路径可继续依赖 `DEFAULT 'default'` 正常工作。
2. **数据兼容性**: 存量数据会被回填到 `default` tenant，不要求手工迁移。
3. **调用方兼容性**: 当前任务不改变对外/内部 API 契约。

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md)
- [ADR-0017](./0017-freeze-tenant-id-semantics.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
