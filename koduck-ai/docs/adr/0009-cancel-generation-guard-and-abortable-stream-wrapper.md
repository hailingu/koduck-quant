# ADR-0009: 为流式请求引入 generation 防护与可中断执行包装

- Status: Accepted
- Date: 2026-04-11
- Issue: #734

## Context

根据 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md` 第 7.2 节，`koduck-ai` 的流式可靠性不仅需要 SSE 断点续流和背压控制，还需要满足两项约束：

1. cancel/interrupt 必须能阻止旧请求继续写入流状态。
2. 生命周期要统一收敛到 `AbortSignal + timeout + cleanup` 封装，避免中断逻辑散落在 handler 中。

Task 4.1 和 4.2 已经完成了 SSE 事件模型、串行队列、背压和优雅停机，但仍存在两个缺口：

1. 同一 `session_id` 上发起新请求时，旧请求对应的 producer 任务仍可能继续读取上游并尝试写入旧 session。
2. 旧 producer 的完成事件、超时 cleanup 和新请求启动之间缺少统一的“当前代际”判定，容易把中断、超时、done/error 的时序散落到多个调用点。

## Decision

本次在 `koduck-ai` 中引入一层显式的“请求代际控制”：

### 1. 为每个流式 session 建立 generation 控制器

- 新增 `src/orchestrator/cancel.rs`，提供 `RequestGenerationController` 和 `RequestGenerationGuard`。
- 每个 `StreamSession` 在创建时初始化 generation 控制器，并为当前请求绑定 `request_id + generation`。
- 当 `StreamRegistry::create_or_replace` 用同一个 `session_id` 替换旧 session 时，旧 session 会先执行 `supersede(new_request_id)`：
  - 推进 generation
  - 触发 abort signal
  - 发送一次终止错误事件并释放活跃 stream lease

### 2. 所有 producer 通过统一 abortable wrapper 执行

- 新增 `run_abortable_with_cleanup`，将 producer future 包装为：
  - 正常完成
  - 被新请求 supersede
  - 超过 `stream.max_duration_ms`
- 无论是 stub producer 还是 gRPC upstream producer，都通过同一套 wrapper 收敛到 `cleanup(reason)`，避免在 API 层分散实现超时和中断分支。

### 3. 写路径增加当前代际校验

- `StreamSession` 新增 `enqueue_event_if_current` 和 `force_shutdown_if_current`。
- producer 只能在 guard 仍是“当前 request_id + generation”时写入事件或发送终止事件。
- 被 supersede 的旧 guard 再尝试写入时会直接返回 `StreamInterrupted`，从而避免旧请求完成事件污染新请求状态。

## Consequences

### 正向影响

1. **并发中断安全**：同一会话上的新请求会明确废弃旧 generation，旧 producer 即使晚到也无法覆盖新请求状态。
2. **资源回收更可控**：supersede、timeout、done/error 都走统一 cleanup 入口，减少 stream lease、上游 future 未释放的风险。
3. **后续扩展更直接**：真正的 chat orchestrator 接入后，可以直接复用同一个 abortable wrapper，而不需要重新发明取消协议。

### 代价与风险

1. **状态模型更复杂**：在 `StreamSession` 之外又增加了一层 generation 状态，需要通过单测保证替换与 cleanup 的时序正确。
2. **日志与排障需要关注 generation**：排查流式问题时，除了 `request_id/session_id`，还需要结合 generation 理解是否发生 supersede。

### 兼容性影响

- **北向 API 兼容**：SSE 事件字段和接口路径不变，客户端无须修改协议。
- **行为变化**：同一 `session_id` 上的新流式请求会更积极地中断旧请求，旧请求会收到终止错误或被直接阻止继续写入。
- **配置复用**：复用现有 `stream.max_duration_ms` 作为 abortable wrapper 的超时上限，不新增配置项。

## Alternatives Considered

### 1. 只在 `StreamRegistry` 替换时调用旧 session `force_shutdown`

- **拒绝理由**：虽然能让旧 session 进入 completed 状态，但 producer 仍可能继续占用上游资源；同时取消、超时、cleanup 仍然散落在多个调用点，无法形成统一语义。

### 2. 只比较 `request_id`，不引入 generation

- **拒绝理由**：仅靠 `request_id` 不能准确表达“当前代际是否已经被 supersede”，也无法为未来的多次中断/重试保留单调递增的时序标识。
