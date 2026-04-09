# ADR-0014: Task 6.2 认证与权限边界落地

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #701, docs/implementation/koduck-user-service-tasks.md Task 6.2, ADR-0013

---

## 背景与问题陈述

在 Task 6.1 后，`koduck-user` 的配置基线已对齐，但认证/权限边界仍有三处缺口：

1. 公开 API 中部分管理员接口未强制执行 `user:*`/`role:*` 权限校验。
2. `AccessControl` 仅依赖角色头判断，未先确认 `X-User-Id`，存在伪造 `X-Roles` 的绕过风险。
3. `/internal/*` 端点对 `X-Consumer-Username` 仅审计不强制，无法对“绕过 APISIX key-auth 直连后端”形成后端兜底拒绝。

Task 6.2 目标是建立最小可执行的认证与权限边界，使三条验收标准可验证。

---

## 决策驱动因素

1. **安全优先**: 公开 API 必须依赖已认证身份头，不能只看角色头。
2. **边界清晰**: 内部 API 需要有 APISIX 之外的后端兜底校验。
3. **低侵入**: 在不引入完整 Spring Security 链路的前提下，完成当前阶段可验证边界。
4. **可测试性**: 需通过控制器级测试覆盖 401/403 关键分支。

---

## 考虑的选项

### 选项 1: 立即引入 Spring Security + 统一 Filter 链

**优点**:
- 权限模型更标准化，扩展性好

**缺点**:
- 当前阶段改动面过大，影响既有控制器与测试结构
- 超出 Task 6.2 范围，实施成本高

### 选项 2: 控制层与工具类最小增强（选定）

**优点**:
- 聚焦 Task 6.2 目标，变更范围可控
- 与现有 APISIX 头透传模式兼容
- 快速形成可验证 401/403 行为

**缺点**:
- 仍属于轻量权限体系，后续需演进到更完整模型

### 选项 3: 仅依赖 APISIX，不做后端兜底

**优点**:
- 后端改动最少

**缺点**:
- 直连后端时缺乏保护
- 无法满足 Task 6.2 对内部 API 边界的验收要求

---

## 决策结果

采用 **选项 2**：在现有架构上完成最小增强。

核心落地：

1. 在 `UserController` 管理接口补齐 `user:*` 与 `role:*` 权限校验。
2. 在 `AccessControl.requirePermission` 中先执行 `UserContext.getUserId(request)`，确保权限判断前已认证。
3. 在 `InternalUserController` 强制校验 `X-Consumer-Username`，缺失时返回 401。
4. 补充控制器测试，覆盖：公开 API 未认证 401、内部 API 缺失 consumer 401、权限不足 403。

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/java/com/koduck/controller/user/UserController.java` | 为关键管理接口补充 `AccessControl.requirePermission` |
| `koduck-user/src/main/java/com/koduck/context/AccessControl.java` | 权限校验前强制读取 `X-User-Id` |
| `koduck-user/src/main/java/com/koduck/controller/user/InternalUserController.java` | 强制校验 `X-Consumer-Username` |
| `koduck-user/src/test/java/com/koduck/controller/user/InternalUserControllerTest.java` | 新增缺失 consumer header 返回 401 用例 |
| `koduck-user/src/test/java/com/koduck/controller/user/UserControllerAuthBoundaryTest.java` | 新增公开 API 未认证 401 与权限不足 403 用例 |

---

## 权衡与影响

### 正向影响

- 公开 API 的认证与权限边界更完整，降低越权风险。
- 内部 API 具备后端兜底校验，减少网关绕过风险。
- 验收标准可通过自动化测试与联调命令直接验证。

### 负向影响

- 认证头缺失时更早失败，可能暴露历史调用方未按约定透传的问题。
- 控制层权限调用点增多，后续需要统一抽象以减少重复。

### 缓解措施

- 通过 ADR 与任务文档明确头部契约。
- 后续阶段评估迁移至统一认证授权中间层。

---

## 兼容性影响

1. **公开 API**: 对合法网关流量兼容；未携带身份头将从可执行变为 401 拒绝。
2. **内部 API**: 对合法 key-auth 流量兼容；缺失 `X-Consumer-Username` 将被 401 拒绝。
3. **错误语义**: 权限不足明确返回 403，未认证明确返回 401。
4. **调用方影响**: 非 APISIX 规范调用需按契约补齐头信息。

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 4.1 / 8.3 节
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md)
- [ADR-0013](./0013-application-config-env-baseline.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
