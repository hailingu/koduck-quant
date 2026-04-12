# ADR-0022: 异步任务重试与失败补偿

- Status: Accepted
- Date: 2026-04-12
- Issue: #835

## Context

Task 7.1 和 Task 7.2 已经让 `SummaryTaskRunner` 具备了异步摘要物化和 facts 提炼能力。
但当前实现存在两个可靠性缺陷：

1. **无重试**：后台 `tokio::spawn` 任务失败后仅记录 `tracing::warn`，不会重试。
   数据库暂时不可用或对象存储抖动时，summary / facts / index record 会直接丢失。

2. **无失败记录**：失败信息只存在于日志流中，没有持久化。
   运维无法事后排查哪些 session 的摘要或 facts 最终未成功写入，
   也无法做手动补偿或告警。

同时，设计文档明确要求：
- 失败应支持重试与补偿
- 主链路延迟不因后台任务上升

## Decision

我们决定在 `reliability` 模块中实现"指数退避重试 + 持久化失败记录"机制：

1. **新增 `memory_task_attempts` 表**：
   - 记录每次任务尝试的 `task_type / tenant_id / session_id / attempt / status / error_message`
   - `status` 取值：`running` / `succeeded` / `failed`
   - 失败记录可通过查询发现并触发手动补偿

2. **新增 `TaskAttemptRepository`**：
   - `insert_attempt`：在每次重试前写入 `running` 记录
   - `mark_succeeded`：任务成功时更新状态
   - `mark_failed`：最终失败时更新状态和错误信息

3. **重试策略**：
   - 最大重试次数：默认 3 次（可配置 `RETRY__MAX_ATTEMPTS`）
   - 退避策略：指数退避 `initial_delay * 2^(attempt-1)`，默认初始 500ms（可配置 `RETRY__INITIAL_DELAY_MS`）
   - 每次重试前写入 `memory_task_attempts` 记录

4. **重试包装器**：
   - 在 `reliability` 模块中实现 `with_retry` 函数
   - 将后台任务拆为三个独立阶段并分别重试：
     - `summary_materialize`
     - `summary_index_refresh`
     - `summary_facts_extract`
   - 主链路仍然只做 `tokio::spawn` 投递，阶段重试全部发生在后台

5. **Metrics**：
   - `koduck_memory_task_retry_total{task_type,tenant}` — 重试次数计数器
   - `koduck_memory_task_failure_total{task_type,tenant}` — 最终失败计数器

## Consequences

正面影响：

1. 暂时性故障（数据库抖动、对象存储超时）可自动恢复，减少数据丢失。
2. summary、facts、index refresh 各自拥有独立失败记录，补偿时不需要整体重跑整条流水线。
3. 最终失败的记录可被查询，支持事后补偿和告警。
4. 主链路 `SummarizeMemory` RPC 仍然只做任务投递，重试全部在后台完成，不影响响应延迟。
5. Metrics 让运维能监控重试率和失败率。

代价与权衡：

1. `memory_task_attempts` 会随任务量增长，需要考虑 retention 策略（当前不在本任务范围内）。
2. 重试增加了后台任务的总执行时间，但不影响主链路延迟。
3. 指数退避的上限是 `initial_delay * 2^(max_attempts-1)`，默认为 500ms * 4 = 2s，对后台任务来说可接受。

## Compatibility Impact

1. 不修改 `memory.v1` protobuf，不增加 breaking change。
2. `SummarizeMemoryResponse` 仍然只返回 accepted 语义，调用方无感知。
3. 新增 `memory_task_attempts` 表通过独立 migration（0002）引入，不影响现有表结构。
4. 新增配置项全部有默认值，不需要修改现有部署配置。

## Alternatives Considered

### Alternative A: 引入外部任务队列（如 Redis Streams、PostgreSQL LISTEN/NOTIFY）

未采用。
这是更完整的长期方向，但会把 Task 7.3 扩大为任务系统建设。
当前先用进程内重试完成最小闭环，后续可升级为外部队列。

### Alternative B: 只重试不记录失败

未采用。
只重试不记录意味着最终失败后无法发现和补偿，不符合设计文档对"补偿与失败记录"的要求。

### Alternative C: 在 `AppendMemory` 主路径中同步重试

未采用。
这会直接违背"主链路延迟不因后台任务上升"的验收标准。
