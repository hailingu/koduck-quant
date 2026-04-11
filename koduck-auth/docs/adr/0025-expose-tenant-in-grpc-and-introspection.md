# ADR-0025: Task 4.2 在 gRPC 与 introspection 契约中显式回传 tenant_id

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-11
- **作者**: @hailingu
- **相关**: #778, docs/implementation/koduck-auth-user-tenant-semantics-tasks.md Task 4.2, ADR-0022, ADR-0024

---

## 背景与问题陈述

Task 4.1 已经让 `koduck-auth` 在 JWT claims 与 refresh 主链路内部保留 `tenant_id`，但对下游暴露的契约仍存在缺口：

1. gRPC `ValidateTokenResponse` 没有 `tenant_id`
2. gRPC `GetUserResponse.UserInfo` 没有 `tenant_id`
3. introspection 结果 `TokenIntrospectionResult` / `IntrospectTokenResponse` 没有 `tenant_id`
4. OIDC discovery `claims_supported` 没有声明 `tenant_id`

这会导致下游虽然可以拿到 token 或 `user_id`，却仍然需要自行二次解析 JWT 才能恢复完整身份主键 `(tenant_id, user_id)`。

---

## 决策驱动因素

1. **契约完整性**: 下游服务应通过稳定响应契约直接拿到 `tenant_id`。
2. **避免重复解析**: 设计文档已经明确，下游不应把“再解析 JWT 原文”作为主路径。
3. **真值一致性**: 对外返回的 `tenant_id` 必须来自 claims 或 `koduck-user` 真值，而不是 auth 本地遗留表的推断结果。
4. **兼容演进**: 尽量用向后兼容的字段扩展完成契约升级，降低对既有调用方的破坏。

---

## 考虑的选项

### 选项 1：只更新 introspection，不改 gRPC

**优点**:
- 改动更小

**缺点**:
- gRPC 下游仍然拿不到完整身份主键
- 与 Task 1.2 的契约清单不一致

### 选项 2：只在响应中增加 `tenant_id`，请求继续保持原样（选定）

**优点**:
- 满足 Task 4.2 的核心目标
- 大多数变化是向后兼容的新增字段
- 下游读取路径最短

**缺点**:
- `GetUserRequest` 若按用户名或邮箱查询，若不显式带 tenant scope，仍只能走 default 兼容路径

### 选项 3：一次性把所有 gRPC request/response 都改成强制 tenant-aware

**优点**:
- 理论上更彻底

**缺点**:
- 与 Task 4.3、Task 5.x 的边界混叠
- 一次性扩大变更面

---

## 决策结果

采用 **选项 2**：

1. `TokenIntrospectionResult` 增加 `tenant_id`
2. gRPC `ValidateTokenResponse` 增加 `tenant_id`
3. gRPC `UserInfo` 增加 `tenant_id`，从而让 `GetUserResponse` 能返回租户信息
4. gRPC `IntrospectTokenResponse` 增加 `tenant_id`
5. OIDC discovery `claims_supported` 增加 `tenant_id`
6. `GetUserRequest` 增加可选 `tenant_id` 字段，用于用户名/邮箱查询时显式限定 tenant scope；缺失时保持 `default` 兼容
7. `GetUser` 的读取路径切到 `koduck-user` internal API，避免依赖 `koduck-auth` 本地遗留表去拼装租户信息

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-auth/proto/koduck/auth/v1/auth.proto` | 为 `ValidateTokenResponse`、`IntrospectTokenResponse`、`UserInfo` 增加 `tenant_id`，并为 `GetUserRequest` 增加可选 `tenant_id` |
| `koduck-auth/src/model/token.rs` | 为 `TokenIntrospectionResult` 增加 `tenant_id` |
| `koduck-auth/src/model/user.rs` | 为内部 `UserInfo` 模型增加 `tenant_id` |
| `koduck-auth/src/grpc/auth_service.rs` | gRPC `ValidateToken` / `GetUser` 回传 `tenant_id`，并将 `GetUser` 读取路径切到 tenant-aware internal API |
| `koduck-auth/src/grpc/token_service.rs` | introspection 响应回传 `tenant_id` |
| `koduck-auth/src/grpc/converter.rs` | proto 与内部模型互转时保留 `tenant_id` |
| `koduck-auth/src/http/handler/oidc.rs` | OIDC discovery 声明 `tenant_id` claim 已支持 |

### 下游消费约定

1. 优先使用 `ValidateTokenResponse.tenant_id`
2. 获取用户详情时优先使用 `GetUserResponse.user.tenant_id`
3. 若走 RFC 7662 introspection，则读取 `tenant_id`
4. 不再要求下游把解析原始 JWT 当作主路径

---

## 权衡与影响

### 正向影响

- gRPC 与 introspection 现在都能直接返回完整身份主键的一半 `tenant_id`。
- 下游服务不再依赖 JWT 二次解析。
- `GetUser` 响应的租户值来自 `koduck-user` 真值，不依赖 auth 本地遗留表。

### 负向影响

- proto 契约发生了字段扩展，需要下游重新生成 stub 才能直接使用新字段。
- `GetUser` 增加了对 `koduck-user` internal API 的依赖。

### 缓解措施

- 所有新增字段都采用追加字段号的方式，保持 protobuf 向后兼容。
- `GetUserRequest.tenant_id` 仍保留 `default` 兼容路径，降低旧调用方破坏性。

---

## 兼容性影响

1. **protobuf 兼容性**: 追加字段属于向后兼容扩展；旧客户端仍可继续反序列化旧字段集合。
2. **HTTP introspection 兼容性**: JSON 响应新增 `tenant_id` 字段，不影响旧消费者。
3. **运行时兼容性**: `GetUserRequest.tenant_id` 缺失时继续回落到 `default` tenant。

---

## 相关文档

- [koduck-auth-user-tenant-semantics.md](../../../docs/design/koduck-auth-user-tenant-semantics.md)
- [koduck-auth-user-tenant-semantics-tasks.md](../../../docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)
- [ADR-0022](./0022-inventory-tenant-id-contract-impacts.md)
- [ADR-0024](./0024-thread-tenant-through-jwt-refresh-chain.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-11 | 初始版本 | @hailingu |
