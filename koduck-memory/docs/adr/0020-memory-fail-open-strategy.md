# ADR-0020: Koduck AI Memory Fail-Open 策略落地

- Status: Accepted
- Date: 2026-04-12
- Issue: #827

## Context

Task 6.1 (#825) 完成后，`koduck-ai` 已经通过 APISIX gRPC route 接入了 `koduck-memory` 的
`GetSession`、`UpsertSessionMeta`、`QueryMemory`、`AppendMemory` 四个 RPC。

但当前实现中，memory 服务故障会直接阻断主 chat 流程：

1. `prepare_memory_context()` 中的 `get_session`、`upsert_session_meta`、`query_memory`
   任一失败都会返回错误响应，用户无法得到回答。
2. 同步 chat 模式下 `append_chat_turn` 失败也会阻断已生成的回答返回给用户。
3. 缺少 memory 失败的结构化指标，运维无法从 `/metrics` 端点观测 fail-open 事件。

设计文档 §7 明确要求 fail-open 原则：memory 故障不应阻塞主 chat。

## Decision

我们决定在 `koduck-ai` 的 `reliability` 模块中新增 `MemoryFailOpenTracker`，
并改造所有 memory 调用点为 fail-open 模式：

1. **新增 `MemoryFailOpenTracker`**（`reliability/memory_fail_open.rs`）：
   - 使用 `AtomicU64` 计数器跟踪四种操作的失败次数。
   - 暴露 `snapshot()` 方法供 `/metrics` 端点消费。
   - 提供 `log_fail_open()` 方法同时记录指标和结构化 `warn!` 日志。
   - 无配置开关 — fail-open 是无条件原则，不是可选功能。

2. **`prepare_memory_context()` 改为 fail-open**：
   - `get_session` 失败（非 `ResourceNotFound`）：记录指标，视为新会话继续。
   - `upsert_session_meta` 失败：记录指标，跳过 session 元数据更新继续。
   - `query_memory` 失败：记录指标，以空 hits 继续主 chat。
   - 函数返回类型从 `Result<MemoryContextSnapshot, AppError>` 改为 `MemoryContextSnapshot`。

3. **同步 chat `append_chat_turn` 改为 fail-open**：
   - 回答已生成后 append 失败，仅记录指标和日志，不阻断响应返回。

4. **Stub stream `append_chat_turn` 改为 fail-open**：
   - 与同步 chat 相同策略，stub stream 继续推送。

5. **`/metrics` 端点新增 `memory_fail_open` 字段**：
   - 返回四种操作的累计失败次数 JSON。

## Consequences

正面影响：

1. koduck-memory 任何故障都不会阻断用户对话，用户体验显著提升。
2. 每次 fail-open 事件都有结构化日志（`request_id`、`session_id`、`operation`、`error.code`），
   方便排障和告警。
3. `/metrics` 端点提供累计计数，可接入 Grafana 面板和告警规则。

代价与约束：

1. `append_memory` 失败意味着对话 turn 不会被持久化。这是 fail-open 的固有代价，
   可通过后续补偿机制（重试队列）缓解。
2. 没有引入 circuit breaker — 每次 request 仍会尝试 gRPC 调用并在超时后降级。
   如果 memory 服务完全宕机，每个请求会增加最多 3 秒的连接超时延迟。
   Circuit breaker 可在后续版本中按需引入。
3. fail-open 是无条件的，没有配置开关。如果未来需要强制 fail-close（例如调试场景），
   需要额外扩展。

## Compatibility Impact

1. 不修改 `memory.v1` protobuf 契约，不引入 breaking change。
2. `koduck-ai` 的 northbound HTTP API 完全兼容 — 用户看到的响应格式不变。
3. `/metrics` 端点新增 `memory_fail_open` 字段，属于向后兼容增强。
4. 日志中新增 `memory_fail_open.operation` 字段，不影响现有日志解析。

## Alternatives Considered

### Alternative A: 仅对 `QueryMemory` 做 fail-open，其余保持 fail-close

未采用。
设计文档 §7 明确要求所有 memory 操作都要 fail-open。
`GetSession` / `UpsertSessionMeta` 失败阻断 chat 同样不可接受。

### Alternative B: 引入 circuit breaker 跳过已知的不可用 memory 服务

未采用（本次）。
Circuit breaker 是有价值的增强，但增加复杂度且不属于 Task 6.2 的范围。
当前 3 秒连接超时在 dev 环境下可接受，circuit breaker 可作为后续优化。

### Alternative C: fail-open 通过配置开关控制

未采用。
设计文档将 fail-open 定义为原则而非功能。无条件 fail-open 更简单、更安全，
避免因配置错误导致意外的 fail-close 行为。
