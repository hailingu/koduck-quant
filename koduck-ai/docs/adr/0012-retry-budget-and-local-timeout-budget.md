# ADR-0012: 为 koduck-ai 引入重试预算与本地超时预算

- Status: Accepted
- Date: 2026-04-11
- Issue: #742

## Context

根据 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md` 第 6.4.5、7.3.4 和附录 A：

1. `koduck-ai` 需要统一维护最大重试次数、总超时预算和可重试错误白名单。
2. `429` 场景必须优先遵循 `retry_after_ms`。
3. APISIX 的网关重试不能替代服务内业务语义重试预算，避免叠加形成重试风暴。

在 Task 5.3 开始前，`koduck-ai` 还没有真正的重试预算实现：

- LLM 同步请求和建流请求遇到 retryable 错误时会直接失败。
- 没有总预算约束，也没有 `deadline_ms` 下发给下游。
- `retry_after_ms` 已能在错误映射层保留，但不会被真正消费。

这意味着：

1. `retryable=true` 只是一个标签，尚未转化为稳定行为。
2. APISIX 后续接入轻重试后，如果服务端再随意重试，容易形成叠加风暴。

## Decision

本次引入 `src/reliability/retry_budget.rs` 作为统一重试预算层，并仅在 LLM 的“初始请求 / 建流请求”阶段启用，避免对已建立的流重复发起重连。

### 1. 配置项

新增 `reliability.retry` 配置段，包含：

- `enabled`
- `max_retries`
- `total_timeout_ms`
- `base_backoff_ms`
- `max_backoff_ms`
- `retryable_codes`

默认白名单与附录 A 一致，覆盖：

- `RATE_LIMITED`
- `SERVER_BUSY`
- `UPSTREAM_UNAVAILABLE`
- `STREAM_TIMEOUT`
- `STREAM_INTERRUPTED`

### 2. 重试决策规则

- 只有 `retryable=true` 且命中白名单的错误允许进入预算计算。
- 达到 `max_retries` 后立刻快速失败，不再继续重试。
- 当剩余总预算不足以覆盖下一次等待时，直接返回“预算耗尽”错误，避免无意义等待。
- 对 `RATE_LIMITED` 优先采用 `retry_after_ms`；其他错误采用 capped exponential backoff。

### 3. 本地 deadline 与下游契约联动

每次真正发往 LLM adapter 的调用都会：

- 以 `min(剩余总预算, llm.timeout_ms)` 作为本次调用 deadline
- 把该值写入 southbound `deadline_ms`
- 同时用本地 timeout 包裹建连 + RPC 调用

这样可以同时约束：

1. 单次调用不能无限等待。
2. 多次重试也不能突破整条请求的总预算。

### 4. 与 APISIX 解耦

- 服务端重试只作用于业务语义明确的 southbound LLM 初始调用。
- 已建立的流中途中断仍保持现有错误/降级语义，不在流中途自动重建。
- 后续 APISIX 侧即便接入轻重试，也不会和流中途重试叠加。

## Consequences

### 正向影响

1. **重试行为可预期**：retryable 错误不再“有标签、没行为”。
2. **预算耗尽后快速失败**：避免在无剩余预算时继续等待。
3. **429 行为更正确**：能真正遵守下游给出的 `retry_after_ms`。
4. **为 Phase 6 打基础**：后续 APISIX 轻重试接入时，服务内语义边界更清晰。

### 代价与风险

1. **当前覆盖范围有限**：本次优先接入 LLM 初始调用，memory/tool 主链路后续可复用同一层继续接入。
2. **默认预算需要压测校准**：`max_retries`、`base_backoff_ms` 和 `total_timeout_ms` 仍需要结合真实链路延迟校准。

### 兼容性影响

- **向后兼容**：新增配置项均有默认值，旧配置文件无需立即修改。
- **北向语义更稳定**：预算耗尽时会快速返回统一错误对象，而不是由每个调用点自行决定。

## Alternatives Considered

### 1. 继续在调用点手写重试循环

- **拒绝理由**：容易让 `retry_after_ms`、白名单和预算耗尽规则在不同调用点出现漂移。

### 2. 完全依赖 APISIX 网关重试

- **拒绝理由**：网关无法理解业务语义白名单，也无法代替服务侧统一管理总预算与 southbound `deadline_ms`。
