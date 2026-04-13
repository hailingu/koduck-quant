# ADR-0021: Task 3.2 为 internal user API 增加 tenant context

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #772, `../implementation/koduck-user-service-tasks.md` 多租户实施映射, ADR-0020

---

## 背景与问题陈述

Task 3.1 已经让 `koduck-user` 的实体与 repository 具备 tenant-aware 查询能力，但 `InternalUserController` 仍未显式接收租户上下文：

1. internal API 没有 `X-Tenant-Id`
2. `findByUsername` / `findByEmail` / `getUserRoles` / `getUserPermissions` 只能走默认租户
3. 旧的 internal 调用链缺少明确兼容策略

这会让后续 `koduck-auth` 接入时继续存在跨租户串读风险。

---

## 决策驱动因素

1. **契约一致性**: internal API 需要显式表达租户上下文。
2. **读路径隔离**: 用户定位、角色读取、权限读取都必须按 tenant scope 执行。
3. **兼容过渡**: 在调用方尚未全部升级前，缺失 `X-Tenant-Id` 的旧路径需要有稳定默认行为。
4. **任务边界清晰**: 本任务只处理 internal API，不提前引入 `UserContext` 改造。

---

## 考虑的选项

### 选项 1：要求 `X-Tenant-Id` 必填，缺失直接拒绝

**优点**:
- 语义最严格

**缺点**:
- 会立即打断尚未升级的调用方

### 选项 2：增加 `X-Tenant-Id`，缺失时回退到 `default` tenant（选定）

**优点**:
- 满足租户化契约
- 对旧调用方保持平滑兼容
- 后续可以在 Task 3.3 / 4.x 再逐步强化

**缺点**:
- 过渡阶段仍存在“未显式传 header 但走默认租户”的兼容路径

### 选项 3：继续只在 service 层固定 `default`

**优点**:
- 改动最少

**缺点**:
- internal API 仍无法表达真实租户上下文
- 不满足 Task 3.2 的要求

---

## 决策结果

采用 **选项 2**：

1. `InternalUserController` 支持读取 `X-Tenant-Id`
2. `findByUsername` / `findByEmail` / `createUser` / `updateLastLogin` / `getUserRoles` / `getUserPermissions` 将 tenantId 传入 `UserService`
3. 当 `X-Tenant-Id` 缺失或为空时，兼容回退到 `default` tenant
4. 审计日志中记录 tenantId，便于后续排查

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/java/com/koduck/controller/user/InternalUserController.java` | 增加 `X-Tenant-Id` 读取、默认租户回退和审计日志扩展 |
| `koduck-user/src/main/java/com/koduck/service/UserService.java` | internal API 方法签名增加 tenantId |
| `koduck-user/src/main/java/com/koduck/service/impl/UserServiceImpl.java` | internal API 查询按传入 tenantId 执行 |
| `koduck-user/src/test/java/...` | 补充自定义租户与默认租户兼容测试 |
| `koduck-user/docs/implementation/koduck-user-service-tasks.md` | 收敛 Task 3.2 执行结果与 checklist |

---

## 权衡与影响

### 正向影响

- internal API 正式具备租户上下文。
- 用户、角色、权限等内部读路径可按租户隔离。
- `koduck-auth` 后续可直接传递 `X-Tenant-Id`。

### 负向影响

- 过渡阶段仍保留 `default` tenant 回退逻辑。
- internal service 接口签名有所变化，需要同步测试桩和调用方。

### 缓解措施

- 在 ADR 与任务清单中明确“缺失 header 回退 default”的兼容策略。
- 在 Task 3.3 中继续将 tenant 上下文提升到统一的 `UserContext`。

---

## 兼容性影响

1. **调用方兼容性**: 未传 `X-Tenant-Id` 的旧 internal 调用仍可落到 `default` tenant。
2. **运行时兼容性**: 已升级调用方可以按 header 显式控制租户作用域。
3. **数据兼容性**: 不涉及额外 schema 变更。

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md)
- [ADR-0020](./0020-align-entities-and-repositories-with-tenant-scope.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
