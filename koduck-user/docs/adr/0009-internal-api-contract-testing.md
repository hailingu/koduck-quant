# ADR-0009: Internal API 契约联调测试（Task 5.2）

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #695, koduck-user/docs/implementation/koduck-user-service-tasks.md Task 5.2, ADR-0008

---

## 背景与问题陈述

Task 5.1 已实现 `InternalUserController`，但要支持 `koduck-auth` 稳定联调，还需要明确并回归验证服务间契约：

1. 关键路径是否覆盖（用户不存在、创建冲突、登录回写、角色权限查询）
2. 错误码和错误响应体是否可被调用方稳定消费
3. 超时/重试/熔断职责边界是否清晰

---

## 决策驱动因素

1. **跨服务可回归**: 调整内部 API 后需快速识别契约回归
2. **错误语义明确**: `400/404/409` 在不同端点的语义必须固定
3. **职责边界清晰**: 被调用方与调用方的可靠性职责不能混淆

---

## 考虑的选项

### 选项 1: 在 `koduck-user` 增加契约级 Controller 回归测试（选定）

**描述**: 通过 `MockMvc standalone + GlobalExceptionHandler + StubUserService` 验证内部 API 的请求/响应契约。

**优点**:
- 不依赖外部服务和数据库，执行快且稳定
- 能直接验证 HTTP 状态码与响应结构
- 可覆盖冲突与不存在等关键路径

**缺点**:
- 不是跨进程联调，无法覆盖真实网络时序问题

### 选项 2: 仅在 `koduck-auth` 侧做端到端联调测试

**优点**:
- 更接近真实调用链

**缺点**:
- 维护成本更高，环境依赖更重
- 不能替代被调用方本地快速回归

---

## 决策结果

采用 **选项 1**，在 `koduck-user` 本地建立契约回归基线，并补充契约文档固定边界：

1. 扩展 `InternalUserControllerTest` 覆盖 Task 5.2 所有关键场景
2. 增加错误响应结构断言（`code/message/timestamp`）
3. 输出联调契约文档，明确调用方策略（超时/重试/熔断由 `koduck-auth` 承担）

---

## 实施细节

### 测试覆盖项

- 用户不存在：
  - `GET /internal/users/by-username/{username}` -> `404`
  - `GET /internal/users/by-email/{email}` -> `404`
  - `PUT /internal/users/{userId}/last-login` -> `404 + ApiResponse`
  - `GET /internal/users/{userId}/roles` -> `404 + ApiResponse`
  - `GET /internal/users/{userId}/permissions` -> `404 + ApiResponse`
- 创建冲突：
  - username 冲突 -> `409 + ApiResponse`
  - email 冲突 -> `409 + ApiResponse`
- 关键成功路径：
  - 登录回写 -> `200`
  - 角色查询 -> `200 + List<String>`
  - 权限查询 -> `200 + List<String>`

### 可靠性策略边界

- `koduck-user` 不实现调用方重试/熔断
- `koduck-auth` 负责请求超时、有限重试与熔断控制
- `koduck-user` 负责稳定返回契约化状态码和错误体

---

## 权衡与影响

### 正向影响

- 快速识别内部 API 契约回归
- 降低 `koduck-auth` 对 `koduck-user` 行为变化的集成风险
- 错误语义可直接被调用方和测试消费

### 负向影响

- 维护一份测试 Stub 逻辑

### 缓解措施

- Stub 仅覆盖契约必要行为，避免模拟业务细节
- 契约文档与测试同时维护，减少偏移

---

## 兼容性影响

1. **API 路由兼容**: 无新增/删除路由
2. **响应语义兼容**: 强化并固化现有 `400/404/409` 语义，不改变成功响应结构
3. **调用方影响**: `koduck-auth` 可按文档固定策略处理失败类型

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-user-api.yaml](../design/koduck-user-api.yaml)
- [koduck-auth-user-internal-api-contract.md](./contracts/koduck-auth-user-internal-api-contract.md)
- [ADR-0008](./ADR-0008-internal-user-controller-implementation.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
