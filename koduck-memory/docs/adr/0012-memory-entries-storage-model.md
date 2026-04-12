# ADR-0012: memory_entries 存储模型设计

- Status: Accepted
- Date: 2026-04-12
- Issue: #810

## Context

Task 4.1 要求建立 `memory_entries` 存储模型，为 L0 写入和 append 语义提供数据访问能力。

在 Phase 3 完成后，`session/` 模块已有完整的 `Session` model 和 `SessionRepository` DAO。
`memory_entries` 表已通过 migration 基线（0001）建好，但 `memory/` 模块仍是 placeholder。

需要解决：
1. 如何映射 `memory_entries` 表到 Rust 结构体（含 UUID、JSONB、BIGINT sequence_num）。
2. 如何支持按 `tenant_id + session_id` 和时间范围查询。
3. 如何利用 UNIQUE 约束 `(tenant_id, session_id, sequence_num)` 保证顺序写入。

## Decision

### 模型层：`MemoryEntry` 结构体

定义 domain model 直接映射数据库列，使用 `sqlx::FromRow` 自动映射。

### Repository 层：`MemoryEntryRepository`

提供以下方法：

1. **`insert(entry)`** — 插入单条 entry，依赖 DB UNIQUE 约束 `(tenant_id, session_id, sequence_num)` 拒绝重复。
2. **`list_by_session(tenant_id, session_id, since)`** — 按 `tenant_id + session_id` 查询，`since` 为可选的时间下界，按 `created_at DESC` 排序。

### 依赖

无需新增 Cargo 依赖。`uuid`、`chrono`、`sqlx`（含 postgres/uuid/chrono feature）、`serde_json` 均已在 Task 3.1 中引入。

## Consequences

### 正向影响

1. `memory/` 模块从 placeholder 变为可工作的数据访问层。
2. 为 Task 4.2（AppendMemory）提供直接可用的 Repository。
3. UNIQUE 约束保证同一 session 下的 sequence_num 不重复。

### 权衡与代价

1. `insert` 方法不做 upsert — 重复 sequence_num 会返回 DB 错误，由上层 `AppendMemory`（Task 4.2）决定如何处理。
2. 暂不实现分页 — `list_by_session` 返回全部结果，Task 4.2 引入批量写入后按需添加。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 无 migration 变更，表结构已由 0001 基线定义。

## Alternatives Considered

### 1. 使用批量 INSERT

- 未采用理由：Task 4.1 聚焦存储模型建立，批量写入属于 Task 4.2 范围。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0011-upsert-session-meta-implementation.md](./0011-upsert-session-meta-implementation.md)
- Issue: [#810](https://github.com/hailingu/koduck-quant/issues/810)
