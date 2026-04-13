# ADR-0024: Task 4.1 在线程化 JWT claims 时保留 tenant 上下文

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #776, `../implementation/koduck-auth-rust-grpc-tasks.md` 多租户身份任务映射, ADR-0022, ADR-0023

---

## 背景与问题陈述

Task 2.2 已经让 `koduck-auth` 的安全域表具备 `tenant_id`，但 Task 4.1 开始前，认证链路里仍有两个关键缺口：

1. JWT `Claims` 不包含 `tenant_id`
2. refresh token 刷新时仍通过默认租户包装方法查找与吊销 token

这意味着即使数据库已经具备租户字段，`access token -> refresh token -> validate` 这条主链路仍无法稳定传播租户上下文。

另外，`koduck-auth` 本地遗留的 `users / roles` 表仍是旧单租户 schema，refresh 链路如果继续依赖本地表，就无法用 `(tenant_id, user_id)` 作为完整身份语义。

---

## 决策驱动因素

1. **身份语义一致性**: JWT 必须显式携带 `tenant_id`，与根设计文档冻结的 `(tenant_id, user_id)` 语义保持一致。
2. **refresh 链路正确性**: 刷新 token 时，查找、吊销与重签发都必须在租户作用域内完成。
3. **避免错误真值**: `koduck-auth` 不能根据邮箱、角色或本地遗留表推断租户，仍应回到 `koduck-user` 的用户真值。
4. **任务边界控制**: 本任务聚焦 claims 与 refresh / validate 内部链路，不提前扩散到 Task 4.2 的 gRPC / introspection 对外契约变更。

---

## 考虑的选项

### 选项 1：只给 JWT claims 增加 `tenant_id`，其余逻辑继续使用 default tenant

**优点**:
- 改动最小

**缺点**:
- refresh token 查询与吊销仍可能串租户
- 不能满足“refresh / validate 链路不丢失 tenant”的验收标准

### 选项 2：claims 写入 `tenant_id`，refresh 链路按租户查询 token，并通过 `koduck-user` internal API 取用户真值（选定）

**优点**:
- `tenant_id` 从签发到刷新都可贯通
- 不需要在本任务里补 `koduck-auth` 遗留用户表的 schema
- 真值仍来自 `koduck-user`

**缺点**:
- 需要在 `koduck-user` internal API 追加按 `userId` 查询用户详情的最小入口

### 选项 3：直接在本任务中把 gRPC / introspection 返回结构一起改掉

**优点**:
- 一次性对外暴露完整 tenant 信息

**缺点**:
- 会与 Task 4.2 职责重叠
- 契约面扩张过大，不利于拆分验收

---

## 决策结果

采用 **选项 2**：

1. `Claims` 增加 `tenant_id`
2. access token 和 refresh token 在签发时都写入 `tenant_id`
3. refresh token 刷新时先从 token payload 中解析 `tenant_id`
4. `refresh_tokens` 的查找与吊销统一切到 tenant-aware 仓储方法
5. `koduck-auth` 在 refresh 时不再依赖本地遗留 `users` 表取用户真值，而是通过 `koduck-user` internal API 按 `(tenant_id, user_id)` 获取用户详情与角色
6. `koduck-user` internal API 的 `UserDetailsResponse` 增加 `tenantId`，并补充 `GET /internal/users/{userId}` 供 refresh 链路使用
7. `TokenIntrospectionResult`、gRPC `ValidateTokenResponse`、`GetUserResponse` 等对外契约字段仍留到 Task 4.2 再统一暴露

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-auth/src/model/token.rs` | 为 JWT claims 增加 `tenant_id` |
| `koduck-auth/src/jwt/generator.rs` | access / refresh token 签发时写入 `tenant_id` |
| `koduck-auth/src/service/auth_service.rs` | refresh / logout / internal user-service 调用全部切换到 tenant-aware 链路 |
| `koduck-auth/src/grpc/token_service.rs` | 适配新的 JWT 生成函数签名，仍保留 default tenant 兼容 |
| `koduck-user/src/main/java/com/koduck/dto/user/user/UserDetailsResponse.java` | internal API 响应回传 `tenantId` |
| `koduck-user/src/main/java/com/koduck/controller/user/InternalUserController.java` | 新增 `GET /internal/users/{userId}` |
| `koduck-user/src/main/java/com/koduck/service/UserService.java` | 增加 `findById` internal 方法 |
| `koduck-user/src/main/java/com/koduck/service/impl/UserServiceImpl.java` | 以租户作用域实现 `findById` 并回填 `tenantId` |

### validate 链路边界

本任务中的“token 校验时解析 `tenant_id`”指：

1. JWT validator / claims 结构能够成功反序列化 `tenant_id`
2. refresh 链路与 logout 逻辑可以从 token payload 中恢复租户上下文

不包括：

1. gRPC `ValidateTokenResponse` 对外新增 `tenant_id`
2. OIDC introspection 响应对外新增 `tenant_id`

这两项留到 Task 4.2。

---

## 权衡与影响

### 正向影响

- access token 与 refresh token 具备显式租户语义。
- refresh token 查询、吊销、重签发都能在 tenant scope 内完成。
- `koduck-auth` 不再依赖本地遗留用户表为 refresh 兜真值。

### 负向影响

- `koduck-auth` 对 `koduck-user` internal API 的依赖更强。
- `koduck-user` internal API 新增了一个按 `userId` 查询的端点。

### 缓解措施

- 新端点仍复用现有 `X-Consumer-Username` 与 `X-Tenant-Id` 约束，不引入额外认证模型。
- 对外 gRPC / introspection 契约不在本任务内扩张，降低变更面。

---

## 兼容性影响

1. **JWT 兼容性**: 新签发 token 会比旧 token 多一个 `tenant_id` claim；旧 refresh token 仍可通过 payload 解析失败路径返回未授权。
2. **internal API 兼容性**: `UserDetailsResponse` 增加 `tenantId` 属于向后兼容扩展；新增 `GET /internal/users/{userId}` 不影响旧调用方。
3. **运行时兼容性**: 仍保留 `default` tenant 兼容路径，供未显式带租户的链路继续工作。

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)
- [koduck-auth-rust-grpc-tasks.md](../implementation/koduck-auth-rust-grpc-tasks.md)
- [ADR-0022](./0022-inventory-tenant-id-contract-impacts.md)
- [ADR-0023](./0023-add-tenant-id-to-security-domain-tables.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
