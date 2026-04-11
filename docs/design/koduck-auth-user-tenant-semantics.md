# Koduck Auth / User Tenant 语义设计草案（V1）

## 1. 目标

本文档定义 `koduck-auth` 与 `koduck-user` 引入 `tenant` 语义的统一设计，
用于为后续 `koduck-ai`、`koduck-memory-service` 以及其他业务服务提供一致的多租户身份与隔离基础。

当前目标不是立即实现复杂的租户管理平台，而是先解决以下核心问题：

- 用户身份不再只是 `user_id`
- JWT 能表达租户归属
- 网关可透传租户上下文
- `koduck-user` 和 `koduck-auth` 数据模型支持租户内唯一
- 内部接口与 southbound / east-west 调用能带上 `tenant_id`

---

## 2. 现状评估

当前仓库状态中，`koduck-auth` 与 `koduck-user` 还没有真正支持 `tenant` 语义：

- 用户表没有 `tenant_id`
- JWT claims 没有 `tenant_id`
- introspection 结果没有 `tenant_id`
- APISIX 透传 header 没有 `X-Tenant-Id`
- `koduck-user` 的 `UserContext` 只感知 `X-User-Id / X-Username / X-Roles`
- 用户名、邮箱、角色名当前是全局唯一，而不是租户内唯一

这意味着当前系统仍然是“单租户身份模型”。

---

## 3. 设计目标

V1 需要达成以下能力：

1. 用户身份升级为 `(tenant_id, user_id)` 组合语义
2. JWT access token 和 introspection 结果显式包含 `tenant_id`
3. 网关在验签后向下游注入 `X-Tenant-Id`
4. `koduck-user` 内部接口按 `tenant_id` 做隔离
5. 用户、角色、权限的唯一性调整为“租户内唯一”
6. 为未来 `koduck-ai` / `memory` / `tool` 服务透传租户上下文提供统一来源

---

## 4. 核心设计结论

1. V1 引入显式的 `tenant_id`，不使用“从 email 域名推断租户”或“从 role 推断租户”的隐式方案。
2. `tenant_id` 必须进入 JWT claims、introspection、网关透传 header、内部 DTO 和数据库表。
3. 用户唯一性从全局唯一调整为租户内唯一：
   - `unique (tenant_id, username)`
   - `unique (tenant_id, email)`
4. 角色与权限同样采用租户内作用域，避免全局共享角色名污染。
5. 下游业务服务默认只相信网关注入的 `X-Tenant-Id`，不自行猜测租户。
6. V1 不引入复杂的 tenant hierarchy、tenant admin console 或跨租户共享资源模型。

---

## 5. 术语定义

- `tenant_id`
  - 租户的稳定唯一标识，建议使用字符串或 UUID
- `user_id`
  - 用户在系统中的内部主键
- `tenant-scoped identity`
  - `(tenant_id, user_id)` 共同定义的身份
- `tenant-local uniqueness`
  - 某个字段只要求在租户内唯一，而不是全局唯一

---

## 6. 架构影响

### 6.1 `koduck-auth`

负责：

- 登录时确定用户所属 `tenant_id`
- 生成包含 `tenant_id` 的 JWT
- introspection / gRPC ValidateToken 返回 `tenant_id`
- 在 token refresh / revoke / audit 中保留租户维度

### 6.2 `koduck-user`

负责：

- 用户真值中的 `tenant_id`
- 按租户隔离用户、角色、权限查询
- 内部 API 按 `tenant_id` 限定作用域

### 6.3 APISIX

负责：

- JWT 验签
- 将 `tenant_id` 注入 `X-Tenant-Id`
- 与 `X-User-Id / X-Username / X-Roles` 一起透传

### 6.4 下游业务服务

负责：

- 从 header 或认证上下文读取 `tenant_id`
- 默认按当前租户隔离数据访问

---

## 7. JWT 与认证设计

### 7.1 Claims 扩展

当前 `koduck-auth` claims 建议增加：

- `tenant_id`

目标 claims 形态：

```json
{
  "sub": "123",
  "username": "demo",
  "email": "demo@example.com",
  "roles": ["USER"],
  "tenant_id": "tenant_demo",
  "type": "access",
  "exp": 1712812800,
  "iat": 1712809200,
  "jti": "uuid",
  "iss": "koduck-auth",
  "aud": "koduck"
}
```

### 7.2 Token Introspection / ValidateToken

以下返回结构需要扩展 `tenant_id`：

- HTTP introspection response
- gRPC `ValidateTokenResponse`
- gRPC `GetUserResponse`
- `TokenIntrospectionResult`

### 7.3 网关透传 Header

APISIX 成功验签后需要向下游统一注入：

- `X-User-Id`
- `X-Username`
- `X-Roles`
- `X-Tenant-Id`

下游服务不得自行从 JWT 原文二次解析 `tenant_id` 作为主路径逻辑。

---

## 8. 数据模型设计

### 8.1 新增 `tenants` 表

建议新增：

```sql
CREATE TABLE tenants (
    id              VARCHAR(128) PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    status          VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

V1 也可先不做复杂 tenant profile，只保留最小真值。

### 8.2 `users` 表

建议增加：

- `tenant_id VARCHAR(128) NOT NULL`

唯一约束调整为：

- `unique (tenant_id, username)`
- `unique (tenant_id, email)`

不再使用全局：

- `unique (username)`
- `unique (email)`

### 8.3 `roles`

建议增加：

- `tenant_id VARCHAR(128) NOT NULL`

唯一约束调整为：

- `unique (tenant_id, name)`

### 8.4 `permissions`

有两种可选方向：

1. 全局权限字典
   - `permissions` 仍然全局
   - 角色是租户内的
2. 租户内权限字典
   - `permissions` 也带 `tenant_id`

V1 更推荐：

- `permissions` 保持全局
- `roles` 租户内定义
- `role_permissions` 通过角色实现租户隔离

这样迁移成本更低。

### 8.5 关系表

以下表需要具备租户语义：

- `user_roles`
- `role_permissions`
- `user_credentials`
- `refresh_tokens`
- `password_reset_tokens`
- `audit_logs`

处理方式有两种：

1. 显式增加 `tenant_id`
2. 依赖 join 回源到 `users/roles`

V1 推荐：

- 安全域表显式增加 `tenant_id`
- 审计与 token 表直接按 `tenant_id` 查询，避免运行时额外 join

---

## 9. 唯一性与查询规则

### 9.1 用户

- 登录输入若仍允许仅输入 `username` / `email`，则必须同时确定 `tenant_id`
- 不允许在不知道租户的情况下按全局用户名登录

V1 可选方案：

1. 登录请求显式带 `tenant_id`
2. 网关或客户端已选定当前 tenant

### 9.2 角色

- 角色名租户内唯一
- 例如 `ADMIN` 可以在多个 tenant 中重复存在

### 9.3 内部查询

所有内部 API 默认都要在 `tenant_id` 作用域内执行：

- `findByUsername(tenantId, username)`
- `findByEmail(tenantId, email)`
- `getUserRoles(tenantId, userId)`
- `getUserPermissions(tenantId, userId)`

---

## 10. 接口契约调整

### 10.1 `koduck-auth` gRPC

建议在以下响应中增加 `tenant_id`：

- `ValidateTokenResponse`
- `GetUserResponse.UserInfo`
- `GenerateTokenPairRequest`
- `IntrospectTokenResponse`

### 10.2 `koduck-user` 内部 HTTP API

建议所有 internal API 增加租户上下文来源：

- Header: `X-Tenant-Id`

或在请求 DTO 中显式带 `tenant_id`。  
V1 更推荐用 header，与网关透传保持一致。

### 10.3 `UserContext`

`koduck-user` 的 `UserContext` 需要扩展：

- `getTenantId()`
- `HEADER_TENANT_ID = "X-Tenant-Id"`

---

## 11. 迁移策略

### 11.1 数据迁移

建议采用分阶段迁移：

1. 新增 `tenant_id` 列，允许临时默认值
2. 为存量数据回填默认 tenant，例如 `default`
3. 调整唯一约束为租户内唯一
4. 上线 JWT claims / header / internal API 的 `tenant_id`
5. 最后移除对“无 tenant 数据”的兼容分支

### 11.2 兼容策略

过渡期内可采用：

- 存量用户统一落到 `tenant_id = default`
- JWT 中暂时总是发出 `tenant_id = default`

这样可以先把语义和链路打通，再逐步演进为真正多租户。

---

## 12. 安全与隔离要求

1. 租户隔离优先于角色判断。
2. 即使是管理员，也默认只在本租户内生效。
3. 不允许跨租户默认查询。
4. 审计日志必须带 `tenant_id`。
5. refresh token、password reset token、audit log 都应具备租户维度。

---

## 13. 对后续服务的意义

引入 tenant 语义后，以下服务可统一复用：

- `koduck-ai`
- `koduck-memory-service`
- `koduck-tool-service`
- 未来任何 northbound / southbound 业务服务

复用方式：

- 统一读取 `X-Tenant-Id`
- 统一在 JWT / introspection 中获取 `tenant_id`
- 统一以 `(tenant_id, user_id)` 作为身份主键语义

---

## 14. 验收标准

满足以下条件可视为 `koduck-auth` / `koduck-user` 已具备 tenant 基础语义：

- JWT claims 包含 `tenant_id`
- APISIX 可透传 `X-Tenant-Id`
- `koduck-user` 能读取 `X-Tenant-Id`
- 数据库主表具备 `tenant_id`
- 用户与角色唯一约束已切换为租户内唯一
- internal API / gRPC 返回结构包含 `tenant_id`
- 认证、自省、角色查询、权限查询都不会跨租户串读
