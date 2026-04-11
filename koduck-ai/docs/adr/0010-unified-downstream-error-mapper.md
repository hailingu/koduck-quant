# ADR-0010: 为下游依赖引入统一错误映射器

- Status: Accepted
- Date: 2026-04-11
- Issue: #736

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 7.3 节和附录 A，`koduck-ai` 必须作为唯一的对外错误码出口：

1. memory / tool / llm 的下游错误都要归一到标准错误码。
2. 北向响应不能透传下游内部实现细节。
3. 统一错误对象还要为后续 Phase 5.2/5.3 的降级与重试预算提供稳定输入。

在 Task 5.1 开始前，仓库已经有 `AppError` 和 `ErrorCode`，但映射逻辑仍分散在多个位置：

- `reliability/error.rs` 只定义了通用错误结构和基础 gRPC code 映射。
- `api/mod.rs` 里存在多处 `map_err(|e| AppError::new(...))` 的手写分支。
- `clients/capability.rs` 对 memory/tool/llm 的能力协商失败也各自拼接错误。

这种实现会带来两个问题：

1. 相同下游错误在不同调用点可能被映射成不同 code/message。
2. 429、`retry_after_ms`、`degraded`、敏感信息脱敏等规则无法在一个地方统一维护。

## Decision

本次引入 `src/reliability/error_mapper.rs` 作为统一的下游错误归一层，并保留 `error.rs` 只负责错误对象与基础枚举定义。

### 1. 错误职责分层

- `error.rs`
  - 定义 `ErrorCode`、`AppError`、HTTP/gRPC 基础映射
  - 保留错误对象的序列化和 client-safe message 规则
- `error_mapper.rs`
  - 统一处理 transport error、gRPC status、contract `ErrorDetail`
  - 负责 memory/tool/llm 维度的下游语义映射
  - 统一补齐 `request_id`、`upstream`、`retry_after_ms`、`degraded`

### 2. 明确三类下游错误入口

- `map_transport_error`
  - 处理 endpoint 非法、连接失败、DNS/网络层异常
  - 默认归一到 `UPSTREAM_UNAVAILABLE`
- `map_grpc_status`
  - 处理 southbound gRPC 调用失败
  - 复用附录 A 的 gRPC -> ErrorCode 映射，并支持从 metadata 读取 `retry-after-ms`
- `map_contract_error_detail`
  - 处理下游返回 `ok=false` 或 stream event 中携带的 `ErrorDetail`
  - 优先信任下游返回的标准 `code`，未知 code 则回退到调用方指定的 fallback

### 3. 先接入真实调用路径，再补回归测试

- LLM 非流式与流式调用切换到统一 mapper。
- capability 协商路径（memory/tool/llm）也切换到统一 mapper。
- 增加 memory/tool/llm 维度的单测，覆盖：
  - 标准错误码映射
  - 未知 code fallback
  - `retry_after_ms` 保留
  - 敏感 message 脱敏

## Consequences

### 正向影响

1. **映射规则集中化**：后续再接 memory/tool 主链路时，可以直接复用同一层，而不是在业务代码里继续散落 `map_err`。
2. **日志可聚合**：统一在 mapper 中输出 `error.code`，为按 code 聚合监控和告警提供稳定字段。
3. **安全边界更清晰**：对外 message 的脱敏规则不再依赖调用方自觉处理。

### 代价与风险

1. **短期存在双入口**：`AppError::from_grpc_status` 仍保留用于兼容已有测试与调用，但主链路已迁移到 mapper。
2. **fallback 策略需要审慎维护**：当下游返回未知 code 时，调用方需要为不同业务语义选择合理的 fallback。

### 兼容性影响

- **北向 API 结构不变**：仍返回统一 `code/message/request_id/retryable/degraded/upstream/retry_after_ms`。
- **行为更严格**：部分此前被粗暴映射成 `UPSTREAM_UNAVAILABLE` 或 `STREAM_INTERRUPTED` 的路径，现在会保留更准确的标准 code，例如 `RATE_LIMITED`、`RESOURCE_NOT_FOUND`。

## Alternatives Considered

### 1. 继续在调用点内联 `map_err`

- **拒绝理由**：无法保证 memory/tool/llm 三类依赖在 message 脱敏、retryable 和 fallback 规则上的一致性。

### 2. 把所有映射逻辑都塞进 `AppError::from_*`

- **拒绝理由**：`AppError` 应该保持为数据结构与基础行为定义，不应继续承担具体下游协议的映射职责，否则后续 HTTP/provider-native 错误接入会继续膨胀。
