# Koduck Auth / User Tenant 契约影响清单（Task 1.2）

> 基线设计：
> [`/Users/guhailin/Git/koduck-quant/docs/design/koduck-auth-user-tenant-semantics.md`](/Users/guhailin/Git/koduck-quant/docs/design/koduck-auth-user-tenant-semantics.md)
>
> 任务来源：
> [`/Users/guhailin/Git/koduck-quant/docs/implementation/koduck-auth-user-tenant-semantics-tasks.md`](/Users/guhailin/Git/koduck-quant/docs/implementation/koduck-auth-user-tenant-semantics-tasks.md)

## 1. 目标

本清单用于固定 Task 1.2 的盘点结果：

1. 哪些 JWT / OIDC / introspection 契约必须增加 `tenant_id`
2. 哪些 internal HTTP API 通过 `X-Tenant-Id` 传递租户上下文，哪些 DTO 需要显式增加字段
3. 哪些 gRPC message 需要显式增加 `tenant_id`，哪些保持不变

本文档只定义 **影响边界**，不在本任务中直接修改运行时代码或 proto。

---

## 2. 盘点原则

1. **JWT 是租户身份源之一**：凡是直接暴露 JWT claims 或其投影结果的契约，都必须能表达 `tenant_id`。
2. **internal HTTP 优先使用 header**：`koduck-auth -> koduck-user` 的内部 HTTP 调用统一使用 `X-Tenant-Id` 作为请求上下文，避免在每个 body DTO 中重复携带租户字段。
3. **gRPC 显式字段优先**：当前 gRPC 契约没有统一 header 约定，因此请求/响应消息中凡是需要表达身份作用域，都要显式带 `tenant_id`。
4. **返回身份就返回租户**：任何回传用户身份、token 校验结果或 introspection 结果的响应，都不应只返回裸 `user_id`。
5. **边界收敛**：Task 1.2 只盘点 Auth/User 当前主链路，不扩展到 APISIX 配置细节或下游业务服务自定义协议。

---

## 3. JWT / OIDC / Introspection 影响清单

| 契约面 | 当前位置 | 需要的 `tenant_id` 变更 | 说明 |
|------|------|------|------|
| JWT Claims | `koduck-auth/src/model/token.rs` `Claims` | 新增 `tenant_id: String` | access / refresh token 都需要保留租户语义，避免 refresh / validate 链路丢失 tenant |
| JWT 生成器 | `koduck-auth/src/jwt/generator.rs` | 生成 access / refresh token 时写入 `tenant_id` | `tenant_id` 来源于用户真值，不在生成器内部推断 |
| JWT 校验器 / claims 解析 | `koduck-auth/src/jwt/validator.rs`、`try_extract_claims_without_verification` | 校验后可读出 `tenant_id` | 后续 revoke / refresh / introspection 需要使用 |
| OIDC discovery | `koduck-auth/src/http/handler/oidc.rs` `claims_supported` | 增加 `"tenant_id"` | discovery 需要对外声明 claim 能力 |
| HTTP introspection 结果 | `koduck-auth/src/model/token.rs` `TokenIntrospectionResult` | 新增 `tenant_id` | `/oauth/introspect` 的 JSON 响应直接来自该模型 |
| 对内 token validate 响应 | `koduck-auth/docs/design/koduck-auth-api.yaml` `TokenValidationResult`、`koduck-user/src/main/java/com/koduck/client/dto/TokenIntrospectionResponse.java` | 新增 `tenantId` / `tenant_id` | `koduck-user` 反向调用 `koduck-auth` 自省时也要拿到租户 |

### 3.1 JWT 边界说明

1. `tenant_id` 是 JWT claims 的一部分，不是 OIDC `scope` 的替代物。
2. `tenant_id` 不通过 `roles`、`aud`、`iss` 或 `sub` 派生。
3. `TokenPair` 本身不额外增加顶层 `tenant_id` 字段；V1 以 token claims 为准。

---

## 4. Internal HTTP API 影响清单

### 4.1 请求上下文

以下 `koduck-auth -> koduck-user` 内部接口统一要求增加请求头：

- `X-Tenant-Id`

适用路径：

- `GET /internal/users/by-username/{username}`
- `GET /internal/users/by-email/{email}`
- `POST /internal/users`
- `PUT /internal/users/{userId}/last-login`
- `GET /internal/users/{userId}/roles`
- `GET /internal/users/{userId}/permissions`

### 4.2 DTO 盘点

| DTO / 契约 | 当前位置 | 变更类型 | 结论 |
|------|------|------|------|
| `UserDetailsResponse` | `koduck-user/src/main/java/com/koduck/dto/user/user/UserDetailsResponse.java` | 返回 DTO 新增字段 | 需要新增 `tenantId`，因为它承担身份回传语义 |
| `InternalUserDetails` | `koduck-auth/src/service/auth_service.rs` | auth 侧客户端 DTO 新增字段 | 需要新增 `tenant_id` / `tenantId` 映射，与 `UserDetailsResponse` 对齐 |
| `CreateUserRequest` | `koduck-user/src/main/java/com/koduck/dto/user/user/CreateUserRequest.java` | 请求体是否加字段 | **不新增**；租户由 `X-Tenant-Id` header 提供 |
| `InternalCreateUserRequest` | `koduck-auth/src/service/auth_service.rs` | auth 侧请求 DTO 是否加字段 | **不新增**；请求头负责传递租户上下文 |
| `LastLoginUpdateRequest` | `koduck-user/src/main/java/com/koduck/dto/user/user/LastLoginUpdateRequest.java` | 请求体是否加字段 | **不新增**；租户由 `X-Tenant-Id` header 提供 |
| `LastLoginUpdatePayload` | `koduck-auth/src/service/auth_service.rs` | auth 侧请求 DTO 是否加字段 | **不新增**；请求头负责传递租户上下文 |
| `koduck-auth ↔ koduck-user` internal contract 文档 | `koduck-user/docs/contracts/koduck-auth-user-internal-api-contract.md` | 契约文档调整 | 需要把 `X-Tenant-Id` 列为必需 header，并说明 body DTO 不重复携带 `tenant_id` |

### 4.3 Internal API 边界说明

1. internal HTTP 不采用“header + body 双写 `tenant_id`”。
2. 对于 `findByUsername / findByEmail` 这类会跨租户歧义的接口，`X-Tenant-Id` 是必需上下文，不允许省略。
3. 返回 `UserDetailsResponse` 时显式返回 `tenantId`，用于调用方校验 header 与用户真值一致。

---

## 5. gRPC 影响清单

| Message | 当前文件 | 变更结论 | 说明 |
|------|------|------|------|
| `ValidateCredentialsRequest` | `koduck-auth/proto/koduck/auth/v1/auth.proto` | 新增 `tenant_id` | 登录输入 username/email 时必须同时确定租户 |
| `ValidateCredentialsResponse` | 同上 | 通过 `UserInfo.tenant_id` 回传 | 不单独增加顶层字段，避免重复 |
| `ValidateTokenResponse` | 同上 | 新增 `tenant_id` | token 校验结果不能只返回裸 `user_id` |
| `GetUserRequest` | 同上 | 新增 `tenant_id` | 尤其 username/email 查询必须带租户作用域；按 `user_id` 查询也统一保留该字段 |
| `GetUserResponse` | 同上 | 通过 `UserInfo.tenant_id` 回传 | 下游拿到用户信息时应同时拿到 tenant |
| `GetUserRolesRequest` | 同上 | 新增 `tenant_id` | `(tenant_id, user_id)` 才是完整身份 |
| `GetUserRolesResponse` | 同上 | 新增 `tenant_id` | 便于调用方与日志链路保持一致 |
| `RevokeTokenRequest` | 同上 | 新增 `tenant_id` | 防止吊销和审计链路只按 `user_id` 解释 |
| `LogoutRequest` | 同上 | 新增 `tenant_id` | 与 refresh token 吊销链路保持一致 |
| `IntrospectTokenResponse` | 同上 | 新增 `tenant_id` | introspection 是 JWT claims 的投影结果，必须返回 tenant |
| `RefreshTokenRequest` | 同上 | **不新增** | V1 依赖 refresh token 自身 claims 保持租户一致 |
| `RefreshTokenResponse` | 同上 | **不新增** | 返回 token pair 即可，租户仍以 claims 为准 |
| `GenerateTokenPairRequest` | 同上 | 新增 `tenant_id` | 内部直接生成 token 时必须显式给出租户 |
| `GenerateTokenPairResponse` | 同上 | **不新增** | 返回 token pair 即可，不重复回传 tenant 顶层字段 |
| `UserInfo` | 同上 | 新增 `tenant_id` | 作为多个响应复用的嵌套身份模型 |

### 5.1 gRPC 边界说明

1. 由于当前 gRPC 设计没有统一 metadata 约定，`tenant_id` 不能只放在 metadata 而不进 message。
2. 需要唯一定位用户的 request，一律显式带 `tenant_id`。
3. `UserInfo` 是复用型身份载体，后续凡返回用户信息的 response 都应通过它承载 `tenant_id`。
4. `RefreshTokenRequest/Response` 和 `GenerateTokenPairResponse` 不重复暴露 `tenant_id` 顶层字段，以免形成“token claims 与响应字段双真值”。

---

## 6. 不在 Task 1.2 直接修改的内容

以下内容属于后续阶段，不在本任务中直接实现：

1. proto / OpenAPI / Java DTO / Rust model 的实际字段变更
2. APISIX 路由或插件的 header 注入实现
3. 数据库 schema 迁移与存量数据回填
4. 下游服务（`koduck-ai`、`memory` 等）的消费改造

---

## 7. 结论

Task 1.2 的契约边界已经明确：

1. **JWT / introspection** 必须把 `tenant_id` 当作一等身份字段。
2. **internal HTTP** 统一用 `X-Tenant-Id` 传请求上下文，只有身份回传 DTO 才新增字段。
3. **gRPC** 因无统一 header 语义，凡是涉及用户身份、token 校验、token 生成、角色权限查询的 message，都要显式纳入 `tenant_id` 或通过 `UserInfo` 回传。
