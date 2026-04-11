# ADR-0023: APISIX 在 JWT 验签后统一透传 `X-Tenant-Id`

## 状态

已接受

## 背景

在 Task 4.x 中，`koduck-auth` 已经把 `tenant_id` 写入 JWT claims、introspection 和内部契约；`koduck-user` 也已经支持从 `X-Tenant-Id` 读取租户上下文。

当前缺口在网关层：

1. APISIX 受保护路由只透传了 `X-User-Id`、`X-Username`、`X-Roles`，没有透传 `X-Tenant-Id`。
2. dev 环境实际生效的 `apisix-route-init.yaml` 与用户路由初始化脚本 `scripts/apisix-route-init-user.sh` 都没有覆盖 `tenant_id` 透传。
3. 这会导致下游服务虽然具备租户能力，但主路径仍拿不到统一的租户 header。

## 决策

在 APISIX 的 `jwt-auth` 保护路由上，统一通过 `proxy-rewrite` 注入以下身份 header：

- `X-User-Id = $jwt_claim_user_id`
- `X-Username = $jwt_claim_username`
- `X-Roles = $jwt_claim_roles`
- `X-Tenant-Id = $jwt_claim_tenant_id`

本次同时更新两类配置来源：

1. `k8s/overlays/dev/apisix-route-init.yaml`
2. `scripts/apisix-route-init-user.sh`

并同步修正文档中的 APISIX 配置示例，保证“集群生效配置”和“脚本/文档基线”一致。

## 权衡

### 收益

- 下游服务可以继续只信任 APISIX 注入的 header，不需要自行解析 JWT。
- `tenant_id` 与 `user_id / username / roles` 一起在同一层被注入，身份上下文来源统一。
- dev 环境配置、脚本、文档三者对齐，降低后续联调歧义。

### 代价

- 路由配置的 `proxy-rewrite` 内容更长，维护时需要同步考虑四个身份 header。
- APISIX claim 变量命名需要和 JWT claims 字段保持一致，后续若改 claim 名称，网关配置也要同步更新。

## 兼容性影响

1. 对现有下游服务是向后兼容的增强：新增 `X-Tenant-Id`，不改变已有 `X-User-Id / X-Username / X-Roles`。
2. 缺失 `tenant_id` claim 的旧 token 将无法满足新的完整透传预期，因此应与 Task 4.x 之后的 token 发行逻辑配套使用。
3. 后续 Task 5.2 可以直接基于该 header 做网关到服务的联调验证，而无需再回头改 APISIX 基线配置。
