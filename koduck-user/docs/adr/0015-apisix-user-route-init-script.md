# ADR-0015: Task 7.2 APISIX 用户路由初始化脚本

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #703, docs/implementation/koduck-user-service-tasks.md Task 7.2, ADR-0014

---

## 背景与问题陈述

Task 7.2 要求落地 `scripts/apisix-route-init-user.sh`，用于将 `koduck-user` 的公开与内部路由注册到 APISIX，并满足以下约束：

1. 固化关键协议配置：
   - 公开路由 `uri=/api/v1/users/*`、`priority=90`
   - 内部路由 `uri=/internal/users/*`、`priority=100`
   - 公开路由启用 `jwt-auth` 且通过 `proxy-rewrite` 注入 `X-User-Id`、`X-Username`、`X-Roles`
   - 内部路由启用 `key-auth` 且通过 `proxy-rewrite` 注入 `X-Consumer-Username` 并清理 `apikey`
2. 注册服务调用 Consumer 与 key。
3. 脚本必须可幂等重放，并在失败时快速回滚。
4. 路由写入后可通过 APISIX Admin API 验证关键配置。

---

## 决策驱动因素

1. **可重复执行**: 支持环境重建、灰度发布与故障恢复时反复执行。
2. **可回滚**: 初始化中任一步骤失败时，尽量恢复到执行前状态。
3. **可验证**: 写入后应立即校验 Admin API 中的生效配置。
4. **低耦合**: 以脚本方式实现，不强绑定 K8s Job 执行环境。

---

## 考虑的选项

### 选项 1：仅使用 `PUT` 覆盖，不做备份和校验

**优点**:
- 实现最简单

**缺点**:
- 失败时无法恢复原配置
- 无法证明写入结果与预期一致

### 选项 2：`PUT` + 预备份 + 失败自动回滚 + 写后校验（选定）

**优点**:
- 满足幂等、回滚、可验证三项核心验收
- 便于在不同环境重放

**缺点**:
- 脚本复杂度提升
- 依赖 `jq` 处理 JSON

### 选项 3：改为声明式 APISIX CRD（K8s 原生管理）

**优点**:
- 配置版本化更自然

**缺点**:
- 当前任务明确要求脚本实现
- 引入新的运维模型，超出 Task 7.2 范围

---

## 决策结果

采用 **选项 2**，在 `scripts/apisix-route-init-user.sh` 中实现：

1. 对 `consumers/koduck-user-consumer`、`routes/user-service`、`routes/user-internal` 先做备份。
2. 使用固定 ID 执行 `PUT`，确保幂等覆盖写入。
3. 任一步骤失败时，按备份自动恢复（原来不存在的实体则删除）。
4. 写入后通过 Admin API 读取并与预期 JSON 对比，确认关键字段与插件配置完全一致。

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `scripts/apisix-route-init-user.sh` | 新增 APISIX 初始化脚本（幂等、备份、回滚、校验） |

### 核心实现点

1. 环境变量契约：
   - 必填：`ADMIN_KEY`、`INTERNAL_API_KEY_USER`
   - 可选：`APISIX_ADMIN_URL`、`USER_SERVICE_UPSTREAM`、`ROLLBACK_ON_ERROR` 等
2. 固化路由配置：
   - 公开路由 `priority=90`，启用 `jwt-auth` + 用户身份头透传
   - 内部路由 `priority=100`，启用 `key-auth` + `X-Consumer-Username` 注入与 `apikey` 清理
3. 回滚策略：
   - 备份存在则恢复原 `value`
   - 备份缺失（原本不存在）则删除新建实体
4. 写后验证：
   - 对两个关键路由执行 GET，校验 `uri/priority/plugins/proxy-rewrite/upstream`

---

## 权衡与影响

### 正向影响

- 脚本可以安全重放，降低环境漂移风险。
- 失败自动回滚，减少误配置窗口。
- 运维排障时可通过 Admin API 校验快速定位问题。

### 负向影响

- 依赖 `jq` 与 `curl`，执行环境有最小工具要求。
- 脚本逻辑更复杂，维护成本高于单纯 `curl PUT`。

### 缓解措施

- 在脚本启动阶段显式检查依赖并给出错误提示。
- 保持路由/Consumer ID 与字段命名稳定，避免不必要变更。

---

## 兼容性影响

1. **对外 API 兼容性**: 保持 `/api/v1/users/*` 路由，不影响既有调用路径。
2. **内部 API 兼容性**: 保持 `/internal/users/*` 路由，未携带合法 key 的请求仍由 APISIX 返回 401。
3. **权限语义**: 业务 403 仍由后端权限模型决定，与 Task 6.2 保持一致。
4. **运维兼容性**: 支持重复执行与失败重放，适配 dev/prod 多环境。

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 8.3 节
- [koduck-user-jwt-design.md](../../../docs/design/koduck-user-jwt-design.md) 7.2 节
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md)
- [ADR-0014](./0014-auth-and-permission-boundaries.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
