# ADR-0022: Task 3.3 为 UserContext 增加 tenant_id

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #774, `../implementation/koduck-user-service-tasks.md` 多租户实施映射, ADR-0021

---

## 背景与问题陈述

Task 3.2 已经让 internal API 显式支持 `X-Tenant-Id`，但公开 API 与通用权限校验链路仍然缺少统一的租户上下文入口：

1. `UserContext` 只能读取 `X-User-Id`、`X-Username`、`X-Roles`
2. `UserController`、`RoleController`、`PermissionController` 还不能统一从上下文获取 tenant
3. 服务层公开 API 仍大量依赖默认 tenant，而不是从控制器显式传入

如果不先解决这一层，后续 `koduck-auth` 写入租户 claim 后，公开 API 仍然无法稳定消费租户上下文。

---

## 决策驱动因素

1. **统一入口**: 租户上下文应与用户身份上下文一样，通过 `UserContext` 统一读取。
2. **控制器可见性**: 公开 API 控制器需要显式拿到 tenantId，而不是依赖服务层内置默认值。
3. **服务层透传**: 服务层公开 API 方法应能直接接收 tenantId。
4. **兼容过渡**: 缺失 `X-Tenant-Id` 时仍需兼容回退到 `default` tenant。

---

## 考虑的选项

### 选项 1：只给 `UserContext` 增加 `getTenantId()`，其他层不动

**优点**:
- 改动较小

**缺点**:
- 控制器和服务层仍未真正消费租户上下文
- 无法满足验收标准

### 选项 2：扩展 `UserContext`，并让公开 API 控制器和服务层显式透传 tenantId（选定）

**优点**:
- 控制器与服务层都能读取租户上下文
- 与 Task 3.2 的 internal API header 语义保持一致
- 为后续 auth claim 接入打好统一入口

**缺点**:
- 需要同步调整多个 service 接口和测试桩

### 选项 3：等待 Task 4 再一起处理租户上下文

**优点**:
- 当前任务改动更少

**缺点**:
- `koduck-user` 侧上下文链路仍不完整
- 不符合任务拆分顺序

---

## 决策结果

采用 **选项 2**：

1. 在 `UserContext` 中新增 `X-Tenant-Id` 读取与 `getTenantId()`
2. 缺失 tenant header 时兼容回退到 `default`
3. `UserController`、`RoleController`、`PermissionController` 通过 `UserContext.getTenantId()` 获取租户上下文
4. 公开 API 相关的 `UserService`、`RoleService`、`PermissionService` 方法显式增加 tenantId 参数
5. `AccessControl` 在权限校验前同步读取 tenant 上下文，确保统一上下文已存在

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/java/com/koduck/context/UserContext.java` | 新增 `X-Tenant-Id` 和 `getTenantId()` |
| `koduck-user/src/main/java/com/koduck/context/AccessControl.java` | 权限校验前同步读取 tenant 上下文 |
| `koduck-user/src/main/java/com/koduck/controller/user/*.java` | 公开 API 控制器通过 `UserContext` 读取 tenantId |
| `koduck-user/src/main/java/com/koduck/service/*.java` | 公开 API 相关 service 方法显式增加 tenantId 参数 |
| `koduck-user/src/test/java/...` | 补充 `UserContext` 行为测试并更新测试桩 |
| `koduck-user/docs/implementation/koduck-user-service-tasks.md` | 收敛 Task 3.3 执行结果与 checklist |

---

## 权衡与影响

### 正向影响

- 公开 API 和 internal API 统一拥有租户上下文读取入口。
- 控制器和服务层都能显式消费 tenantId。
- 后续 JWT claim 注入 `tenant_id` 后，`koduck-user` 可以直接消费。

### 负向影响

- service 接口签名变化较多，需要同步测试和调用点。
- 过渡阶段仍保留 `default` tenant 回退路径。

### 缓解措施

- 用单元测试覆盖 `UserContext.getTenantId()` 的显式值与默认回退行为。
- 在 ADR 中明确 default tenant 的兼容策略。

---

## 兼容性影响

1. **运行时兼容性**: 缺失 `X-Tenant-Id` 的公开 API 请求仍会回退到 `default` tenant。
2. **调用方兼容性**: 已传租户 header 的调用链可立即获得租户作用域行为。
3. **接口兼容性**: HTTP API 只新增可选 header，不改变路径与 body。

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md)
- [ADR-0021](./0021-add-tenant-context-to-internal-user-api.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
