# ADR-0028: `memory_unit` Projection And Traceback Rules

- Status: Accepted
- Date: 2026-04-14
- Issue: #849

## Context

经过 Task 1.1 和 Task 1.2，`koduck-memory` 已经有了 `memory_units` 与 `memory_unit_anchors`
两层 schema 基线，但仍有两个关键点只存在于 ADR-0025 的描述中，还没有落成统一实现入口：

1. `domain_class_primary` 虽然被定义为 `domain` anchors 的投影字段，但还没有单一算法来源。
2. `source_uri + entry_range_start/end` 的回溯语义虽然在文档中说明了，但 schema 侧仍缺少足够明确的约束与注释。

Task 1.3 的验收进一步要求：

- `domain_class_primary` 的投影规则可复现
- 回填、重算、迁移使用同一算法
- 单 entry 与多 entry 场景的回溯规则无歧义

如果继续只靠文档约定，后续 repository、批量回填、修复脚本和迁移任务很容易各自实现一套排序逻辑，导致
`domain_class_primary` 出现漂移。

## Decision

### 1. 用数据库函数冻结 `domain_class_primary` 投影算法

新增两个 schema 级函数：

- `compute_memory_unit_domain_class_primary(tenant_id, memory_unit_id)`
- `sync_memory_unit_domain_class_primary(tenant_id, memory_unit_id)`

其中核心算法固定为：

- 仅从 `anchor_type = domain` 的 anchors 中取值
- 排序规则固定为 `weight DESC, anchor_key ASC`
- 选择第一条 `anchor_key` 作为 `memory_units.domain_class_primary`

这样后续无论是写入触发、回填脚本还是迁移重算，都可以调用同一个入口，不再重复编码排序规则。

### 2. 用触发器把 `domain` anchors 的变化同步回 `memory_units`

在 `memory_unit_anchors` 上新增 `AFTER INSERT OR UPDATE OR DELETE` 触发器：

- `domain` anchor 新增或更新后，刷新对应 `memory_unit` 的投影
- 原本是 `domain` 但更新成其他类型时，刷新旧 `memory_unit` 的投影
- `domain` anchor 删除后，重新计算剩余 domain anchors 的投影

这让 `domain_class_primary` 保持为投影字段，而不是又变成一个需要人工同步维护的独立真值。

### 3. 强化 `source_uri + entry range` 的 schema 语义

新增 `source_uri` 非空白约束，并更新注释：

- `source_uri` 在单 entry 与多 entry 场景下都必须存在
- 对于单 entry unit，可以直接以 `source_uri` 作为主回溯入口
- 对于多 entry unit，`source_uri` 只表示主入口，完整回放必须结合 `entry_range_start/end`

同时补充 `entry_range_start/end` 注释，明确单 entry 与多 entry 场景的差异。

## Consequences

正面影响：

1. `domain_class_primary` 的投影规则从 ADR 描述升级为 schema 级统一实现，后续回填与重算不需要再各写一套逻辑。
2. `memory_unit_anchors` 的 domain 变化会自动刷新投影字段，减少漂移风险。
3. `source_uri + entry range` 的回溯边界在 schema 注释和约束层都更清晰，单条与多条 entry 的语义更容易被后续实现复用。

代价与权衡：

1. 新增触发器会让 anchor 变更路径多一次投影刷新，但换来了一致性和更低的实现分叉风险。
2. 当前仍未引入完整的回放子表（如 `memory_unit_sources`），因此多源精细追溯仍留给后续阶段。
3. `sync_memory_unit_domain_class_primary()` 目前通过一次 update 触发投影刷新，保持简单实现；更复杂的批量重算优化留给后续需要时再做。

## Compatibility Impact

1. 不修改 `memory.v1` 契约，也不切换现有 northbound/southbound 行为。
2. 不新增 `time` 倒排锚点，继续与 ADR-0025 保持一致。
3. 本次 migration 只强化已有 `memory_units` / `memory_unit_anchors` 的语义，不破坏现有表结构主键与索引。

## Alternatives Considered

### Alternative A: 只在 ADR 中声明排序规则，不在数据库内实现

未采用。这样回填、重算、写入链路和临时脚本仍然可能各自实现不同排序，无法满足“使用同一算法”的验收要求。

### Alternative B: 在 repository 层实现投影刷新，而不是数据库触发器

未采用。repository 方案只能覆盖应用主路径，批量 SQL 回填或运维修复脚本仍可能绕过，难以保证 schema 语义一致。

### Alternative C: 现在就引入 `memory_unit_sources` 子表

未采用。Task 1.3 目标是冻结回溯规则而不是扩展更多数据模型；V1 仍保持 `source_uri + entry range` 的最小表达。
