# ADR-0023: Task 2.2 为 koduck-auth 安全域表增加 tenant_id

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #765, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 2.2, ADR-0022

---

## 背景与问题陈述

Task 2.1 已经为 `koduck-user` 建立了租户化 schema 基线，但 `koduck-auth` 的安全域仍然只有单租户语义：

1. `refresh_tokens` 没有 `tenant_id`
2. `password_reset_tokens` 没有 `tenant_id`
3. `audit_logs` 没有 `tenant_id`

这会导致 refresh、password reset、审计查询都只能按 `user_id` 或 token hash 理解身份，无法满足多租户设计中“安全域表显式增加 `tenant_id`”的要求。

---

## 决策驱动因素

1. **安全隔离**: token 与审计记录必须保留租户维度，避免跨租户误关联。
2. **查询效率**: 后续 refresh、revoke、审计检索需要租户维度索引，而不是全表扫描。
3. **渐进演进**: 保持当前调用链仍能以 `default` tenant 继续运行，同时为后续 tenant-aware 调用埋好接口。
4. **实现边界**: 本任务聚焦 schema 和最小仓储承接，不提前混入 Task 4 的完整认证租户化逻辑。

---

## 考虑的选项

### 选项 1：只加列，不补任何仓储层承接

**优点**:
- 改动最小

**缺点**:
- “按租户查询可用”只能停留在数据库层，代码层无法使用

### 选项 2：加列、回填、补索引，并在仓储层增加最小 tenant-aware 方法（选定）

**优点**:
- schema 与代码两侧都能承接租户过滤
- 对现有默认单租户链路影响最小

**缺点**:
- 仓储层会出现 default tenant 兼容方法与 tenant-aware 方法并存

### 选项 3：等 Task 4 再一次性重构 auth 全链路

**优点**:
- 看起来更集中

**缺点**:
- 无法满足当前任务拆分
- 风险过于集中

---

## 决策结果

采用 **选项 2**：

1. 为 `refresh_tokens`、`password_reset_tokens`、`audit_logs` 增加 `tenant_id VARCHAR(128) NOT NULL DEFAULT 'default'`
2. 对现有记录回填 `default`
3. 增加租户维度索引，重点覆盖 `(tenant_id, user_id)` 与 `(tenant_id, created_at / expires_at)`
4. 在 token / password reset 仓储层新增按租户保存、查询、吊销的方法
5. 保留现有无 tenant 参数的方法，让其默认落到 `default`，保证旧链路兼容

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-auth/migrations/202604110001_add_tenant_to_security_tables.sql` | 为安全域表新增 `tenant_id`、回填默认值、补索引 |
| `koduck-auth/src/model/token.rs` | 为 token 记录模型补充 `tenant_id` 字段 |
| `koduck-auth/src/repository/refresh_token_repository.rs` | 新增 tenant-aware 保存、查询、吊销方法 |
| `koduck-auth/src/repository/password_reset_repository.rs` | 新增 tenant-aware 保存、查询、标记使用方法 |

### 兼容策略

1. 默认 tenant 仍使用 `default`
2. 旧调用链继续调用无 tenant 参数的方法
3. 新的 tenant-aware 方法供后续 Task 4.x 直接接入

---

## 权衡与影响

### 正向影响

- refresh / password reset / audit log 都拥有显式租户维度。
- 仓储层已经可以按租户过滤，而不必等待完整 auth 重构。
- 旧链路依然能继续运行。

### 负向影响

- 默认兼容方法与 tenant-aware 方法会短期并存。
- `audit_logs` 目前只完成 schema 演进，业务写入 tenant 仍留到后续链路改造。

### 缓解措施

- 在 Task 4.3 中将登录、refresh、审计链路切换到 tenant-aware 调用。
- 保持 default tenant 兼容窗口，避免一次性破坏现有链路。

---

## 兼容性影响

1. **运行时兼容性**: 旧链路继续使用 `default` tenant，不要求当前业务代码立即改造。
2. **数据兼容性**: 存量 token 与审计记录会回填 `default`。
3. **调用方兼容性**: 对外/对内 API 暂不变化，变化主要在 schema 与仓储层。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-semantics-tasks.md](../../../docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)
- [ADR-0022](./0022-inventory-tenant-id-contract-impacts.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
