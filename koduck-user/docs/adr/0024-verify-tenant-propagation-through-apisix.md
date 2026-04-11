# ADR-0024: 通过 APISIX 联调验证租户透传闭环

## 状态

已接受

## 背景

Task 5.1 已经让 APISIX 在 JWT 验签后注入 `X-Tenant-Id`，但仓库里还缺少一条真正可执行的联调闭环来证明：

1. `koduck-auth` 登录签发的 JWT claim 中 `tenant_id` 与 APISIX 注入的 `X-Tenant-Id` 不冲突。
2. `koduck-user` 公开 API 能通过 APISIX 的 JWT 路由正确消费身份与租户上下文。
3. `koduck-user` 反向调用 `koduck-auth` 的 introspection 结果也能消费 `tenant_id`。
4. APISIX 公开路由必须能验签 `koduck-auth` 当前签发的 RS256 token，而不是只接受 APISIX 自己生成的 HS256 consumer token。

此外，dev 环境的 APISIX 初始化 job 只有通配 `/api/*` 路由，没有显式的 `/api/v1/users/*` 路由，无法稳定验证 `koduck-auth -> APISIX -> koduck-user` 这条链路。

## 决策

本次采用以下方案：

1. 在 `k8s/overlays/dev/apisix-route-init.yaml` 中新增 `user-service` 路由：
   - `uri = /api/v1/users/*`
   - `priority = 90`
   - `jwt-auth + proxy-rewrite(headers.set)`
   - 同时透传 `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`
2. 扩展 `scripts/e2e-koduck-user-apisix.sh`，让它覆盖以下联调步骤：
   - 登录并显式传入 `tenant_id`
   - 解码 JWT claim，校验 `tenant_id`
   - 调用 `/oauth/introspect`，校验返回的 `tenant_id / sub / username` 与 claim 一致
   - 调用 `/api/v1/users/me`，校验 APISIX 透传身份后 `koduck-user` 返回的用户与 claim 一致
   - 调用 `/internal/users/by-username/{username}`，验证正确租户可见、错误租户不可见
3. 扩展 `koduck-user` 的 `TokenIntrospectionResponse`，显式消费 `tenant_id`
4. 让 `koduck-auth` 生成的 JWT 固定带上 APISIX consumer `key = koduck_user`，并让 dev APISIX consumer 使用 `RS256 + public/private key` 对齐当前签发链路，以兼容现有 OIDC/JWKS 模型。

## 权衡

### 收益

- Task 5.2 不再停留在手工命令或静态文档，而是沉淀为可重复执行的联调脚本。
- 公开 API、internal API、introspection 三条路径都能覆盖到租户一致性。
- `koduck-user` 客户端 DTO 与 `koduck-auth` 的对内契约重新对齐。
- APISIX 公开 JWT 路由与 `koduck-auth` 的 RS256 发 token 模型真正对齐，不再依赖不兼容的 HS256 consumer token 约定。

### 代价

- dev APISIX 初始化 job 中的显式路由更多，维护时需要同时考虑优先级和通配路由的关系。
- e2e 脚本依赖 `jq` 与 `base64` 解码 JWT payload，执行环境要求略高于最小 curl smoke test。
- APISIX 初始化 job 需要读取 `dev-koduck-auth-jwt-keys` 中的公钥，增加了一个跨服务 secret 依赖。

## 兼容性影响

1. 新增 `/api/v1/users/*` 显式 APISIX 路由属于网关增强，不影响已有 `/api/*` 通配路由的其余行为。
2. `TokenIntrospectionResponse` 新增 `tenantId` 字段属于向后兼容扩展。
3. `koduck-auth` JWT claims 新增固定 `key` 字段，属于对 APISIX 验签链路的向后兼容扩展。
4. Task 6.x 后续可以直接复用这条脚本作为多租户回归基线，而无需重新搭联调链路。
