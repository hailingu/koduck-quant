# ADR-0008: InternalUserController 实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #693, koduck-user/docs/design/koduck-auth-user-service-design.md 4.2/5.1 节, koduck-user/docs/design/koduck-user-api.yaml, ADR-0006

---

## 背景与问题陈述

Phase 5 Task 5.1 需要在 `koduck-user` 实现供 `koduck-auth` 调用的内部 API。
当前 `UserService` 已具备内部业务能力，但缺少对外 `InternalUserController` 路由层，导致服务间契约无法联调。

---

## 决策驱动因素

1. **契约一致性**: 路径、方法、响应语义必须与 `koduck-user-api.yaml` 完全对齐
2. **调用可审计**: 记录 `X-Consumer-Username`，满足内部链路最小审计
3. **错误语义清晰**: 查询不存在返回 404，校验失败返回 400，冲突由业务异常返回 409
4. **最小侵入**: 在复用现有 `UserService` 的基础上补齐 Controller，不引入额外通信层

---

## 考虑的选项

### 选项 1: 新增 `InternalUserController`（选定）

**描述**: 在 `controller/user` 新增独立内部 Controller，暴露 `/internal/users/*` 路由

**优点**:
- 与设计文档 4.2/5.1 结构一致
- 内外 API 分层清晰（`/api/v1/*` 与 `/internal/*`）
- 便于后续给内部接口单独施加认证策略（APISIX key-auth）

**缺点**:
- 新增一个 Controller 类和对应测试，维护面略增

### 选项 2: 在现有 `UserController` 中混合实现内部路由

**优点**:
- 类数量更少

**缺点**:
- 公网接口和内部接口耦合，职责边界不清
- 不符合设计文档中 `InternalUserController` 的拆分意图

---

## 决策结果

采用 **选项 1**，新增 `InternalUserController` 并实现 6 个内部 API：

- `GET /internal/users/by-username/{username}`
- `GET /internal/users/by-email/{email}`
- `POST /internal/users`
- `PUT /internal/users/{userId}/last-login`
- `GET /internal/users/{userId}/roles`
- `GET /internal/users/{userId}/permissions`

并在每个接口记录调用审计日志（`action/target/consumer`）。

---

## 实施细节

### 路由与响应

1. 查询类接口使用 `Optional -> 200/404` 映射（`findByUsername/findByEmail`）
2. 创建接口使用 `@Valid CreateUserRequest`，成功返回 `200 + UserDetailsResponse`
3. 最后登录回写接口使用 `@Valid LastLoginUpdateRequest`，成功返回 `200`
4. 角色/权限接口返回 `List<String>`

### 审计日志

- Header: `X-Consumer-Username`（可空）
- 记录格式: `internal-api action={} target={} consumer={}`
- Header 缺失时使用 `consumer=unknown`

### 业务一致性补强

为满足内部接口 404 语义，在 `UserServiceImpl` 中对以下方法增加用户存在性校验：

- `updateLastLogin`
- `getUserRoles`
- `getUserPermissions`

以上方法在用户不存在时统一抛出 `UserNotFoundException`，由全局异常处理为 `404`。

---

## 权衡与影响

### 正向影响

- 对齐 `koduck-auth` 联调所需内部契约
- 提供最小可审计能力，便于排查服务间调用来源
- 错误语义统一，降低调用方歧义

### 负向影响

- 每次内部调用都会增加一条 info 日志
- `getUserRoles/getUserPermissions/updateLastLogin` 增加一次存在性查询

### 缓解措施

- 审计日志保持最小字段，不记录敏感 payload
- 如后续出现性能瓶颈，可将存在性校验改为基于更新行数/缓存策略优化

---

## 兼容性影响

1. **API 兼容性**: 新增 `/internal/users/*` 路由，不影响既有 `/api/v1/*` 对外接口
2. **行为变化**: `updateLastLogin/getUserRoles/getUserPermissions` 在用户不存在时由“可能静默返回空”改为明确 404
3. **调用方影响**: `koduck-auth` 需按契约处理 404/409/400

---

## 验证与测试

- 新增 `InternalUserControllerTest`（WebMvc）
- 覆盖场景：
  - 200：按用户名/邮箱查询、创建用户、更新登录时间、获取角色、获取权限
  - 404：用户名不存在
  - 400：创建用户请求校验失败

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-user-api.yaml](../design/koduck-user-api.yaml)
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md) Task 5.1
- [ADR-0006](./ADR-0006-user-service-implementation.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
