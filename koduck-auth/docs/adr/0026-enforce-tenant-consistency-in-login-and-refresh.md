# ADR-0026: 在登录与 Refresh 流程中强制租户一致性

## 状态

已接受

## 背景

Task 4.1 与 Task 4.2 已经把 `tenant_id` 带入 JWT claims、introspection、gRPC 契约以及 `koduck-auth -> koduck-user` 的内部查询链路，但登录入口本身仍然存在两个缺口：

1. 登录请求没有显式提供租户上下文时，`koduck-auth` 仍可能沿用默认租户，无法满足多租户登录的确定性要求。
2. `audit_logs` 表虽然已经有 `tenant_id` 列，但登录与 refresh 成功链路并没有把租户写入审计记录，排障时缺少租户维度。

根据 `docs/design/koduck-auth-user-tenant-semantics.md`，V1 的约束是：

- 登录输入如果仍允许 `username` / `email`，则必须同时确定 `tenant_id`
- refresh token 续签必须保持租户一致
- 审计日志必须带 `tenant_id`

## 决策

本次在 `koduck-auth` 中采用以下方案：

1. 登录请求支持显式 `tenant_id`，同时兼容从 `X-Tenant-Id` 读取租户上下文。
2. 当登录请求既没有 body `tenant_id`，也没有 `X-Tenant-Id` 时，直接返回校验错误，不再静默回退到 `default`。
3. 登录成功后，`koduck-auth` 会校验“请求租户”和“用户真值租户”一致，再签发 token。
4. refresh 流程继续以 refresh token 记录中的 `tenant_id` 为准，并在续签前显式校验“token 租户”和“用户真值租户”一致。
5. 新增认证审计写入仓储，对 `LOGIN_SUCCESS` 和 `REFRESH_TOKEN_SUCCESS` 记录显式写入 `tenant_id`。

## 权衡

### 收益

- 登录入口不再依赖默认租户，避免多租户下的串租户认证。
- refresh 链路除了依赖 header / token 查询，还多了一层应用侧一致性校验。
- 审计日志具备租户维度，后续可直接按 `tenant_id` 排查认证问题。

### 代价

- 客户端或网关在登录场景下必须提供租户上下文，旧的“只传用户名密码”调用将收到 400。
- `koduck-auth` 多维护了一层审计仓储，认证主链路会多一次 best-effort 数据库写入。

## 兼容性影响

1. 登录 API 向后新增了可选字段 `tenant_id`，同时要求调用方通过 body 或 `X-Tenant-Id` 至少提供一种租户上下文。
2. 旧客户端如果没有租户选择能力，需要在接入前补齐租户输入或通过网关注入 `X-Tenant-Id`。
3. refresh API 的输入结构不变，但成功后的审计记录现在会携带 `tenant_id`。
