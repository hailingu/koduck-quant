# ADR-0015: memory_index_records L1 索引存储模型

- Status: Accepted
- Date: 2026-04-12
- Issue: #817

## Context

Task 5.1 要求建立 `memory_index_records` 表和相关的 L1 索引存储模型，为 QueryMemory 提供可直接消费的结构化索引数据。

在 Phase 4（L0 写入与 append 语义）完成后，`memory/` 模块已有完整的 `MemoryEntryRepository`，支持记忆条目的写入和查询。
`memory_index_records` 表已通过 migration 基线（0001）建好，但 `index/` 模块仍是 placeholder。

需要解决：
1. 如何映射 `memory_index_records` 表到 Rust 结构体（含 UUID、TEXT summary/snippet、NUMERIC score_hint）。
2. 如何支持按 `tenant_id + domain_class` 和 `tenant_id + session_id` 的高效查询。
3. 如何建立 L1 索引与 L0 原始材料的关联（通过 `source_uri` 字段）。

## Decision

### 模型层：`MemoryIndexRecord` 结构体

定义 domain model 直接映射数据库列，使用 `sqlx::FromRow` 自动映射。

### Repository 层：`MemoryIndexRepository`

提供以下方法：

1. **`insert(record)`** — 插入单条 index record，用于 L1 索引生成。
2. **`list_by_domain(tenant_id, domain_class, limit)`** — 按 `tenant_id + domain_class` 查询，支持 DOMAIN_FIRST 策略。
3. **`list_by_session(tenant_id, session_id, limit)`** — 按 `tenant_id + session_id` 查询，支持 session 范围限制。
4. **`list_by_query(tenant_id, domain_class, query_text, limit)`** — 结合 domain_class 和 summary 全文搜索，支持 SUMMARY_FIRST 策略。

### L1 与 L0 关联

通过 `source_uri` 字段建立关联：
- `source_uri` 存储指向 L0 对象的 URI（如 `s3://bucket/tenants/{tenant_id}/sessions/{session_id}/entries/{sequence_num}-{entry_id}.json`）
- 使 L1 索引可追溯到原始 L0 材料

### 依赖

无需新增 Cargo 依赖。`uuid`、`chrono`、`sqlx`（含 postgres/uuid/chrono feature）均已在前序任务中引入。

## Consequences

### 正向影响

1. `index/` 模块从 placeholder 变为可工作的数据访问层。
2. 为 Task 5.2（DOMAIN_FIRST）和 Task 5.3（SUMMARY_FIRST）提供直接可用的 Repository。
3. 高频查询索引支持 QueryMemory 的性能需求。

### 权衡与代价

1. `insert` 方法不做幂等校验 — L1 索引生成可能重复，由上层异步任务去重。
2. 全文搜索依赖 PostgreSQL GIN 索引，复杂查询可能需要专门的搜索引擎。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 无 migration 变更，表结构已由 0001 基线定义。

## Alternatives Considered

### 1. 使用单独的全文检索引擎（如 Elasticsearch）

- 未采用理由：V1 设计明确不引入额外依赖，使用 PostgreSQL GIN 索引足够支持基础需求。

### 2. 将 L1 索引存储在对象存储

- 未采用理由：L1 需要支持高频查询和复杂过滤，PostgreSQL 更适合此场景。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0014-l0-object-storage-implementation.md](./0014-l0-object-storage-implementation.md)
- Issue: [#817](https://github.com/hailingu/koduck-quant/issues/817)
