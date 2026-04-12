# ADR-0013: AppendMemory 实现

- Status: Accepted
- Date: 2026-04-12
- Issue: #812

## Context

Task 4.2 要求实现 `AppendMemory` gRPC handler，支持批量追加记忆条目，包含幂等去重和顺序控制。

在 Task 4.1 完成后，`memory/` 模块已有 `MemoryEntryRepository`，支持单条插入和按 session 查询。
`memory_idempotency_keys` 表已通过 migration 基线（0001）建好，但尚未使用。

需要解决：
1. 如何基于 `idempotency_key`（来自 `RequestMeta`）实现请求级幂等。
2. 如何为同一 session 的条目分配递增的 `sequence_num`。
3. 如何在并发写入场景下利用 DB UNIQUE 约束保证顺序语义。
4. 如何将主写路径与索引/摘要解耦。

## Decision

### 幂等机制：`memory_idempotency_keys` 表

1. 收到 `AppendMemory` 请求后，先尝试 INSERT `memory_idempotency_keys`，以 `idempotency_key` 为主键。
2. INSERT 成功 → 首次请求，继续写入。
3. INSERT 失败（主键冲突）→ 重复请求，查询已写入条数直接返回。

### 顺序控制：max(sequence_num) + 偏移

1. 在事务中查询当前 session 的 `max(sequence_num)`（不存在则为 0）。
2. 新条目的 sequence_num = max_seq + 1, max_seq + 2, ... max_seq + N。
3. 利用 UNIQUE 约束 `(tenant_id, session_id, sequence_num)` 拒绝并发冲突。

### L0 URI 占位

Task 4.3 负责 L0 对象存储写入。本阶段 `l0_uri` 使用占位值 `l0://pending/{entry_id}`，
标记该条目的原始材料尚未写入对象存储。

### 解耦策略

`AppendMemory` 仅写入 `memory_entries`，不触发索引或摘要生成。
后续 Task 5.x / 7.x 独立实现索引与摘要路径。

## Consequences

### 正向影响

1. `AppendMemory` 从 stub 变为可工作的 RPC。
2. 幂等保证客户端重试不会产生重复数据。
3. sequence_num 递增 + UNIQUE 约束保证顺序语义。

### 权衡与代价

1. 使用 `SELECT max(sequence_num) + FOR UPDATE` 锁行而非乐观锁 — 在同一 session 高并发场景下会串行化，但符合设计文档对顺序语义的严格保证。
2. `l0_uri` 占位值将在 Task 4.3 完成后被替换。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 无 migration 变更，`memory_idempotency_keys` 表已由 0001 基线定义。

## Alternatives Considered

### 1. 客户端自分配 sequence_num

- 未采用理由：需要信任客户端，无法防止并发冲突或重复 sequence_num。

### 2. 乐观锁 + 重试

- 未采用理由：增加实现复杂度，且同一 session 的写入频率不高，悲观锁足够。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0012-memory-entries-storage-model.md](./0012-memory-entries-storage-model.md)
- Issue: [#812](https://github.com/hailingu/koduck-quant/issues/812)
