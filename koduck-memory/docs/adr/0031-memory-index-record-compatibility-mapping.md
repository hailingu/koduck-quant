# ADR-0031: `memory_index_records` Compatibility Mapping

- Status: Accepted
- Date: 2026-04-14
- Issue: #855

## Context

经过 Task 2.2，`memory_units` 已经成为真实写入产物，但 `koduck-memory` 当前的检索主路径
`DOMAIN_FIRST` / `SUMMARY_FIRST` 仍直接读取 `memory_index_records`。

这意味着在切换查询侧主路径之前，我们必须同时满足两件事：

1. 继续保留 `memory_index_records`，避免破坏现有读链路
2. 给旧索引记录补上与 `memory_units` 的稳定映射关系，避免新旧结构并存时语义漂移

Task 2.3 要求兼容写入，而不是一次性切换全部读路径。

## Decision

### 1. 保留 `memory_index_records` 作为兼容层

当前阶段不删除 `memory_index_records`，`DOMAIN_FIRST` / `SUMMARY_FIRST` 继续读它。
新架构中的 `memory_units` / `memory_unit_anchors` 先作为写入真值与后续检索迁移基础。

### 2. 为 `memory_index_records` 增加显式 `memory_unit_id`

在 `memory_index_records` 上新增可空列：

- `memory_unit_id UUID NULL`

该字段用于表达兼容层到新结构的一跳映射，避免仅靠 `source_uri` 或隐式规则反推。

### 3. V1 稳定映射规则

V1 先冻结以下兼容规则：

1. `memory_kind = summary` 的 `memory_index_record` 必须指向 session-scoped summary unit
   - `memory_index_records.memory_unit_id = memory_units.memory_unit_id = session_id`
2. 现有 `DOMAIN_FIRST` / `SUMMARY_FIRST` 查询逻辑不要求立即改读 `memory_units`
3. generic conversation units 与 fact units 在 V1 不要求都镜像到 `memory_index_records`
4. 如仍存在遗留 entry-backed index record，可继续依赖旧字段；后续是否补齐 `memory_unit_id` 由迁移阶段再收口

### 4. 在兼容写路径中同步写入该映射

`SummaryTaskRunner::refresh_summary_index()` 在写入 summary index record 时，必须同步写入：

- `memory_unit_id = stored.session_id`

这样旧索引记录与新的 summary unit 保持稳定一一对应。

## Consequences

正面影响：

1. 旧检索路径无需改动即可继续工作。
2. 新旧结构之间不再只有文档约定，而是有 schema 级关联字段。
3. 后续将 `DOMAIN_FIRST` / `SUMMARY_FIRST` 渐进切到 `memory_units` 时，可以平滑比对结果。

代价与权衡：

1. `memory_index_records` 会继续存在一段时间，短期内存在双写维护成本。
2. 当前只为 summary compatibility path 补显式映射；generic / fact 的全面兼容映射留待后续阶段。

## Compatibility Impact

1. 不修改 `memory.v1` 外部契约。
2. 不改变 `DOMAIN_FIRST` / `SUMMARY_FIRST` 的对外行为。
3. 新增列为向后兼容扩展；旧数据允许 `memory_unit_id = NULL`。

## Alternatives Considered

### Alternative A: 直接删除 `memory_index_records`

未采用。当前读路径仍依赖该表，直接删除会导致检索行为回退。

### Alternative B: 只在 ADR 中定义映射规则，不落 schema 字段

未采用。仅靠 `source_uri` / `session_id` / `memory_kind` 的组合反推，容易在迁移期产生歧义。

### Alternative C: 立即把所有 generic / fact units 都镜像写入 `memory_index_records`

未采用。Task 2.3 的目标是兼容写入，不要求一次性把全部新结构投影回旧索引表。
