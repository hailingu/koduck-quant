# ADR-0027: `memory_unit_anchors` Migration Baseline

- Status: Accepted
- Date: 2026-04-14
- Issue: #847

## Context

ADR-0025 在 Task 1.2 中要求为 `memory_unit` 建立多锚点倒排索引基线，以承载 V1 的
`domain / entity / relation / discourse_action / fact_type` 检索入口。上一轮 Task 1.1 已经引入
`memory_units` 基表，但 anchor 索引层仍未物化，因此当前 schema 还无法稳定表达：

1. 一个 `memory_unit` 对应多个语义锚点
2. `tenant + anchor` 的高频倒排检索路径
3. `fact_type` 只能附着在 `memory_kind = fact` 的 `memory_unit` 上

同时，Task 1.2 明确要求：

- anchor 闭集必须冻结
- 三组索引必须落地
- V1 不引入 `time` 倒排锚点
- `fact_type` 约束需要在 schema 或写入层可验证

## Decision

### 1. 使用可逆 migration 引入 `memory_unit_anchors`

在 `koduck-memory/migrations/` 中新增：

- `0006_memory_unit_anchors.up.sql`
- `0006_memory_unit_anchors.down.sql`

继续沿用 `sqlx` 的 migration 机制，并保持与 `0005_memory_units` 相同的可回滚策略。

### 2. 冻结 anchor 结构与 V1 闭集

`memory_unit_anchors` 表固定包含：

- `id`
- `memory_unit_id`
- `tenant_id`
- `anchor_type`
- `anchor_key`
- `anchor_value`
- `weight`
- `created_at`
- `updated_at`

其中 `anchor_type` 通过 check constraint 固定为：

- `domain`
- `entity`
- `relation`
- `discourse_action`
- `fact_type`

明确不加入 `time`、`time_bucket` 等时间倒排锚点。时间在 ADR-0025 中仍只作为排序信号存在。

### 3. 索引直接对齐 Task 1.2 的检索要求

新增三组索引：

1. `tenant_id + anchor_type + anchor_key`
2. `tenant_id + memory_unit_id`
3. `memory_unit_id + anchor_type`

这样既覆盖高频的 tenant-scoped 倒排查询，也保留从 unit 反查 anchor 集合的能力。

### 4. 用触发器在 schema 层校验 `fact_type`

由于 PostgreSQL 的普通 check constraint 无法直接跨表读取 `memory_units.memory_kind`，
本次采用轻量 trigger function：

- 当 `anchor_type != fact_type` 时直接放行
- 当 `anchor_type = fact_type` 时，查询对应 `memory_units`
- 只有目标 unit 存在且 `memory_kind = fact` 时允许写入

这让 Task 1.2 的“schema 或写入层可验证”更偏向 schema 侧完成，同时保留明确的 rollback 边界。

## Consequences

正面影响：

1. `memory_unit` 的多锚点倒排索引基线在数据库层落地，后续 Query Analyzer 与 retrieval path 可以复用统一结构。
2. `fact_type` 的跨表约束不会只停留在应用层约定，减少数据漂移风险。
3. 通过 comment 明确 V1 不包含时间锚点，避免后续实现误把时间当倒排入口。

代价与权衡：

1. 引入 trigger 比纯 check constraint 略复杂，但这是当前最直接的数据库层校验方式。
2. 仍然没有添加外键，保持与 `koduck-memory` 既有 migration 风格一致；关联完整性因此主要由 trigger 和应用层共同保障。
3. 当前只冻结 anchor schema，不涉及 `domain_class_primary` 的投影算法，该决策留给 Task 1.3。

## Compatibility Impact

1. 不修改 `memory.v1` 契约，不引入 northbound/southbound breaking change。
2. 不替换现有 `memory_index_records` 读路径，只新增 anchor 索引表为后续迁移做准备。
3. 若回退，需要先删除 trigger 与 function，再删除 `memory_unit_anchors` 表，对应 `.down.sql` 已覆盖。

## Alternatives Considered

### Alternative A: 把 `fact_type` 约束完全放到 repository 写入层

未采用。Task 1.2 允许写入层验证，但只放在应用层容易导致后续批量回填或脚本写入绕过约束。

### Alternative B: 增加跨表外键并把 tenant 一致性一并强约束

未采用。当前 `koduck-memory` migration 尚未建立统一外键风格；本轮优先保持现有 schema 风格一致，降低迁移风险。

### Alternative C: 直接把 `time_bucket` 作为一种 `anchor_type`

未采用。ADR-0025 已明确 V1 时间维度只参与排序，不进入候选召回倒排路径。
