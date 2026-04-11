# ADR-0014: 为 koduck-ai 建立 APISIX 网关插件基线

- Status: Accepted
- Date: 2026-04-11
- Issue: #746

## Context

根据 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md` 第 16.2 节：

1. `koduck-ai` 的网关入口需要统一接入 `limit-req / limit-count / prometheus / opentelemetry / access-log`。
2. 网关日志与 trace 需要至少收敛 `request_id / session_id / user_id / trace_id` 这些统一字段。
3. `grpc-transcode` 仅作为迁移窗口能力存在，默认应可关闭，避免长期保留兼容层。

在 Task 6.2 开始前：

- APISIX 仅在插件清单里启用了 `limit-req / limit-count / prometheus`，但没有在 AI 路由或 southbound gRPC 路由上真正绑定限流与 tracing 基线。
- APISIX ConfigMap 没有统一 access log 格式，无法稳定输出 `request_id / session_id / user_id / trace_id`。
- `opentelemetry` 与 `grpc-transcode` 还未纳入网关基础能力清单。

## Decision

本次将 Task 6.2 的范围收敛为“网关基线能力可用且默认安全”，而不是一次性引入完整迁移期兼容路线。

### 1. 在 APISIX ConfigMap 中启用插件基线

在 dev/prod 的 APISIX ConfigMap 中：

- 启用 `opentelemetry`
- 启用 `grpc-transcode`
- 保持 `limit-req / limit-count / prometheus / proxy-rewrite` 可用
- 通过 `nginx_config.http.access_log_*` 把 access log 输出到 stdout，并统一 JSON 字段

`access-log` 这里采用 APISIX/Nginx 原生 access log，而不是额外的 logger sink 插件：

- 运维侧更容易直接从容器 stdout 收集
- 不会为本次任务额外引入外部日志后端依赖

### 2. 在 route-init 中为 AI 入口与 southbound gRPC 路由绑定治理插件

对 northbound AI HTTP 路由和 southbound gRPC 路由统一挂载：

- `limit-count`
- `limit-req`
- `opentelemetry`
- `proxy-rewrite`

其中：

- northbound AI HTTP 路由按 `$consumer_name + $uri` 做限流分组
- southbound gRPC 路由按 `$uri` 做限流分组
- `proxy-rewrite` 负责补齐并透传：
  - `X-Request-Id`
  - `X-Trace-Id`
  - `traceparent`
  - `X-Session-Id`
  - `X-User-Id`

这样 APISIX access log、trace span 和上游服务日志可以围绕同一组标识串联。

### 3. 用 plugin metadata 统一 opentelemetry 公共元数据

通过 `plugin_metadata/opentelemetry` 统一设置：

- `trace_id_source=random`
- `set_ngx_var=true`
- `service.name`
- 公共 attribute/header 透传项

这样 route 级只需要保留最小 `sampler` 配置，而统一 trace 变量可直接复用到 access log 和 `proxy-rewrite`。

### 4. `grpc-transcode` 默认关闭，仅保留迁移期开关

本次将 `grpc-transcode` 纳入 APISIX 插件清单，但 route-init 默认不创建 transcode 路由：

- 通过 `ENABLE_AI_GRPC_TRANSCODE=false` 明确默认关闭
- 迁移窗口真正到来时，再基于 proto asset 和特定 URI 增量开启 transcode 路由

这满足“仅迁移窗口可选开启”的要求，同时避免在当前阶段引入未使用的兼容路由。

## Consequences

### 正向影响

1. **入口限流真正落地**：不再只是插件“可用”，而是 AI 路由和 gRPC 路由已经绑定基线策略。
2. **trace 与 access log 可对齐**：APISIX 会生成/维护统一 trace 标识，并写入日志与上游请求头。
3. **迁移开关边界清晰**：`grpc-transcode` 变成显式可选能力，而不是默认常开。

### 代价与风险

1. **session_id / user_id 仍受请求形态限制**：当前 northbound AI 请求的 `session_id` 主要存在于 body 中，网关 access log 只能稳定记录 header 层字段，未提供 header 时会为空。
2. **trace 目前以网关变量为中心**：当前仓库尚未引入独立 OTEL collector 基础设施，本次先确保 trace 标识可生成、透传和串联。
3. **prod AI/auth 资源仍依赖现有占位服务**：本次重点是网关 IaC，不扩展 prod overlay 的应用编排范围。

### 兼容性影响

- **向前兼容**：现有 northbound HTTP 路由与 southbound gRPC 路由 URI 不变。
- **行为变化**：超出网关限流阈值的请求会返回 `429`，并带统一拒绝消息。
- **迁移控制更严格**：`grpc-transcode` 只有在显式开关打开时才允许进入迁移窗口。

## Alternatives Considered

### 1. 只把插件加入 APISIX `plugins` 列表，不在 route-init 绑定

- **拒绝理由**：这只能说明插件“可加载”，不能满足“网关侧限流生效”和“指标与 trace 可串起全链路”的验收目标。

### 2. 使用 logger 类插件替代 access log

- **拒绝理由**：当前仓库没有配套的外部日志 sink 设施。直接使用 stdout access log 更贴合现有部署方式。

### 3. 立即创建 `grpc-transcode` 兼容路由

- **拒绝理由**：当前仓库尚未准备对应 proto asset 与迁移路径，直接创建只会引入未使用的兼容面。
