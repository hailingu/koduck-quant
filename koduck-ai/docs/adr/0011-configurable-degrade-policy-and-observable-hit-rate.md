# ADR-0011: 为 koduck-ai 引入可配置降级策略与命中率观测

- Status: Accepted
- Date: 2026-04-11
- Issue: #740

## Context

根据 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md` 第 7.3 节，`koduck-ai` 需要承担降级决策责任：

1. 是否允许降级必须由服务配置控制。
2. 触发条件至少覆盖上游超时、预算耗尽、熔断打开。
3. 一旦返回降级结果，北向响应必须显式标记 `degraded=true`，不能伪装成完整成功。

在 Task 5.2 开始前，仓库只有 `llm.stub_enabled` 这一条手工兜底路径：

- 非流式接口会返回 `degraded=true` 的 stub 响应。
- 流式接口会返回 stub 事件，但没有统一的降级策略层和命中观测。
- 失败后的降级入口分散在调用点，无法按路由灰度开关，也无法统计 hit rate。

这会导致两个问题：

1. chat 与 chat_stream 的降级语义不一致，客户端很难区分“完整成功”和“降级成功”。
2. 没有稳定的观测面，无法回答“当前降级是否生效、命中率多少、主要由什么原因触发”。

## Decision

本次引入 `src/reliability/degrade.rs` 作为统一降级策略与观测入口，并把它挂到 `AppState` 上，供 HTTP 请求路径和 metrics 端点共享。

### 1. 配置分层

新增 `reliability.degrade` 配置段，包含：

- `enabled`：降级总开关
- `chat_enabled`：非流式路由开关
- `chat_stream_enabled`：流式路由开关
- `upstream_timeout_enabled`
- `budget_exhausted_enabled`
- `circuit_open_enabled`

默认值采用安全灰度策略：总开关和路由开关默认关闭，只有显式配置后才会生效。

### 2. 降级原因标准化

降级策略层显式定义三种触发原因：

- `upstream_timeout`
- `budget_exhausted`
- `circuit_open`

当前运行时先把已有错误语义映射到上述原因：

- `UPSTREAM_UNAVAILABLE` / `STREAM_TIMEOUT` -> `upstream_timeout`
- `RATE_LIMITED` -> `budget_exhausted`
- `SERVER_BUSY` -> `circuit_open`

后续 Task 5.3 和熔断实现可以继续复用这些标准原因，而不需要重写路由侧逻辑。

### 3. 北向降级语义统一

- chat 路由：当命中降级策略时返回 stub 成功响应，并强制 `degraded=true`
- chat_stream 路由：返回带 `degraded=true` 与 `degrade_reason` 的 SSE payload，保证客户端能区分降级成功和完整成功

### 4. 命中率观测

策略层内置按路由请求数、降级命中数和按原因计数，并通过 metrics 路由暴露快照：

- `/metrics`
- `/metrics/degrade`

在尚未接入 Prometheus 之前，先确保 hit rate 已可读取与验证。

## Consequences

### 正向影响

1. **灰度控制更清晰**：是否降级、哪些路由允许降级、哪些原因触发降级都可以配置化。
2. **客户端语义更稳定**：降级成功不再混同于完整成功。
3. **为后续 Phase 5.3 打基础**：重试预算耗尽后可以直接复用同一个降级入口。
4. **可观测性前移**：即使 Prometheus 尚未接入，也能先通过 metrics 快照看 hit rate。

### 代价与风险

1. **stub 仍是当前降级载体**：短期内降级成功返回的是受控 stub，而不是更丰富的部分结果。
2. **原因映射存在阶段性近似**：在真正的熔断器与重试预算落地前，`RATE_LIMITED` / `SERVER_BUSY` 会作为预算耗尽与熔断打开的代理信号。

### 兼容性影响

- **配置向后兼容**：新增配置段都有默认值，老配置文件不需要立即修改。
- **northbound 响应更显式**：降级成功路径会新增 `degraded=true` / `degrade_reason` 信息，属于增强而不是破坏性变更。

## Alternatives Considered

### 1. 继续复用 `llm.stub_enabled`

- **拒绝理由**：只能实现人工兜底，无法表达“哪些错误允许自动降级”，也无法按路由灰度。

### 2. 只打日志，不暴露 metrics 快照

- **拒绝理由**：日志能看到单次命中，但无法直接给出 route 维度的 hit rate，不利于验收和后续运维观察。
