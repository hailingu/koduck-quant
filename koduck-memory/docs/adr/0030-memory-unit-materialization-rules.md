# ADR-0030: `memory_entry -> memory_unit` Materialization Rules

- Status: Accepted
- Date: 2026-04-14
- Issue: #853

## Context

Task 2.1 已经为 `memory_units` / `memory_unit_anchors` 建立了 typed model 与 repository，
但当前 `koduck-memory` 的实际写入链路仍停留在：

- `AppendMemory` 只写 `memory_entries`
- `SummaryTaskRunner` 只写 `memory_summaries` / `memory_facts` / `memory_index_records`

这意味着 anchor-based retrieval 所需的 `memory_unit` 真实物化还没有发生，尤其缺少：

1. 单条 entry 到 generic conversation unit 的同步物化
2. 多条连续 entry 聚合到 summary / fact unit 的稳定规则
3. 一致的 `snippet` 生成策略

Task 2.2 明确要求我们把这些规则落成可复现实现。

## Decision

### 1. 引入统一的 `MemoryUnitMaterializer`

在 `memory_unit/` 模块中新增 `materializer.rs`，统一承接三类物化：

- `materialize_appended_entries`
- `upsert_summary_unit`
- `replace_fact_units`

这样可以把 `memory_kind` 的写入时机和 anchor 附着逻辑集中在一个位置，而不是分散在
`AppendMemory` 与 `SummaryTaskRunner` 的不同分支里。

### 2. 单条 entry 直接形成 generic conversation unit

`AppendMemory` 成功提交 `memory_entries` 后，按每条 entry 同步创建一个 `memory_unit`：

- `memory_unit_id = entry_id`
- `entry_range_start = entry_range_end = sequence_num`
- `memory_kind = NULL`（映射为 generic conversation unit）
- `summary_status = raw`
- `source_uri = l0_uri`
- `time_bucket = message_ts(%Y-%m)`

这为后续 recall / anchor path 提供最细粒度的基线单元。

### 3. 多条连续 entry 聚合形成 summary unit

`SummaryTaskRunner` 在刷新 summary projection 时，同步 upsert 一个 session-scoped summary unit：

- `memory_unit_id = session_id`
- `memory_kind = summary`
- `summary_status = ready`
- `summary = stored_summary.summary`
- `source_uri = memory-summary://...`
- `entry_range = [first_sequence_num, last_sequence_num]`

同时写入一个 `domain` anchor，让 `domain_class_primary` 继续通过既有 trigger 投影得到。

### 4. 多条连续 entry 聚合形成 fact units

`SummaryTaskRunner` 在事实提取完成后，删除旧的 fact units，并为本轮 facts 逐条创建新的 fact unit：

- `memory_unit_id = fact.id`
- `memory_kind = fact`
- `summary_status = not_applicable`
- `source_uri = memory-fact://...`
- `entry_range = [first_sequence_num, last_sequence_num]`

并补齐两个 anchors：

- `domain`
- `fact_type`

这样既保持 `fact_type` 约束成立，也让后续 `recall_target_type = fact/preference` 有稳定锚点可用。

## Consequences

正面影响：

1. `memory_unit` 从 schema 基线升级为真实写入产物，后续 retrieval 主路径可以直接复用。
2. 单 entry 与多 entry 的物化边界在代码中清晰可复现。
3. `memory_unit` 只保留追溯与检索所需最小字段，避免重复存储展示性文本。

代价与权衡：

1. `AppendMemory` 在提交后增加了一步同步 materialization，会多一次数据库写入。
2. summary / facts 的物化仍然依赖异步任务完成，因此 generic units 会先于 summary/fact units 可见。
3. 当前 generic units 还未附着 domain/entity anchors；更丰富的 anchor 填充留给后续 Phase 3/4。

## Compatibility Impact

1. 不修改 `memory.v1` 契约。
2. 不移除 `memory_index_records`，继续保持旧读路径可用。
3. 新增的 `memory_unit` 写入不会破坏现有 summary/fact/index 逻辑，只是补充并行物化产物。

## Alternatives Considered

### Alternative A: 只在异步 summary 完成后再创建所有 memory units

未采用。这样会让最近对话片段在 summary 未完成前完全不可见，不符合 ADR-0025 对 recent memory 的要求。

### Alternative B: 继续只维护 `memory_index_records`

未采用。Task 2.2 的目标就是把检索基线从 session/index 粒度推进到 `memory_unit` 粒度。

### Alternative C: 为 generic units 立即补全所有 anchors

未采用。当前还没有 query analyzer / anchor extraction 组件，先把 unit 物化基线做稳，再在后续阶段补 anchor 丰富化。
