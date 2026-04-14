# ADR-0026: `memory_units` Migration Baseline

- Status: Accepted
- Date: 2026-04-14
- Issue: #845

## Context

ADR-0025 已经冻结 anchor-based retrieval 的核心方向：`koduck-memory` 需要把检索粒度从 `session`
收紧到 `memory_unit`，同时保持现有 `memory.v1` 契约、`memory_index_records` 兼容读路径和
`DOMAIN_FIRST` / `SUMMARY_FIRST` 的既有语义不被立即破坏。

Task 1.1 的目标不是一次性完成整条新检索链路，而是先建立一个可执行、可回滚的 migration 基线，
把 `memory_units` 的字段语义、状态约束和兼容边界冻结下来，供后续 repository、写入链路和 anchor
表在同一语义上演进。

当前约束与风险：

1. 现有 `koduck-memory` 使用 `sqlx` 在启动期自动执行 `migrations/`，因此 schema 变更必须能在容器构建
   与服务启动流程中稳定编译。
2. Phase 1 仅引入 `memory_units`，不能提前把 `memory_index_records` 或现有摘要/事实表替换掉。
3. Task 1.1 明确要求：
   - `memory_kind = NULL` 表示 generic conversation unit
   - V1 仅允许已物化类型 `summary` / `fact`
   - `summary_status` 必须是闭集，并且 `ready` 时要求 `summary` 非空
   - migration 需要可回滚

## Decision

### 1. 使用可逆 SQL migration 引入 `memory_units`

在 `koduck-memory/migrations/` 中新增成对的：

- `0005_memory_units.up.sql`
- `0005_memory_units.down.sql`

这样继续沿用现有 `sqlx` migration 机制，同时把 Task 1.1 的“可回滚”要求落到文件层，而不是只写在文档里。

### 2. 冻结 `memory_units` 字段与约束

表结构固定为：

- `memory_unit_id`
- `tenant_id`
- `session_id`
- `entry_range_start`
- `entry_range_end`
- `memory_kind`
- `domain_class_primary`
- `summary`
- `snippet`
- `source_uri`
- `summary_status`
- `salience_score`
- `time_bucket`
- `created_at`
- `updated_at`

约束策略：

1. `memory_kind` 允许为 `NULL`，并通过 schema 约束限定非空值只能是 `summary` 或 `fact`。
2. `summary_status` 通过 check constraint 固定为 `pending | ready | failed`。
3. 仅当 `summary_status = ready` 时，`summary` 必须为非空白文本。
4. `entry_range_end >= entry_range_start`，保证单 entry 与多 entry unit 的边界表达一致。
5. `salience_score` 若出现，则约束在 `0..1`。

### 3. 用 schema comment 明确字段语义

Task 1.1 要求把关键语义冻结在 schema 中，因此对以下字段补充注释：

- `memory_kind`：`NULL` 即 generic conversation unit
- `domain_class_primary`：投影字段，不是独立真值
- `source_uri`：主回溯入口，多 entry 场景仍需结合 `entry_range`
- `summary_status`：闭集定义与 `ready` 语义
- `time_bucket`：仅作排序信号

### 4. 保持对现有读写路径的兼容姿态

本次 migration 不：

- 修改 `memory.v1` proto
- 删除或重命名 `memory_index_records`
- 给现有 repository / RPC handler 引入强制读写切换

`memory_units` 在 Phase 1 只作为后续演进的 schema 基线存在，兼容迁移仍由后续 Task 2.x / 4.x 承担。

## Consequences

正面影响：

1. `memory_unit` 语义在数据库层被提前冻结，后续 repository 与物化逻辑可以围绕同一套边界实现。
2. `summary_status` 和 `memory_kind` 的约束不再只存在于 ADR 文本，减少实现漂移。
3. 可逆 migration 让 dev / canary 环境在验证失败时可以明确回滚。

代价与权衡：

1. 先引入表结构但暂不切流，短期内会出现新旧结构并存。
2. `domain_class_primary` 暂保留为可空字段，允许后续 anchor 物化逐步接管；这会把部分完整性检查延后到写入链路阶段。
3. 当前不引入外键，延续 `koduck-memory` 现有 migration 风格，换取部署灵活性，但也意味着关联完整性主要依赖应用层。

## Compatibility Impact

1. 对现有 `memory.v1` southbound 契约无 breaking change。
2. 对现有 `memory_index_records` / `memory_summaries` / `memory_facts` 表无破坏性修改。
3. 容器构建与启动期 migration 会新增 `memory_units` 表；若需要回退，可使用对应 `.down.sql`。

## Alternatives Considered

### Alternative A: 直接在 `memory_index_records` 上扩字段

未采用。`memory_index_records` 当前仍承担兼容检索职责，直接扩成 `memory_unit` 真值表会把兼容层与新模型耦合在一起，
增加 Phase 2 之后迁移的复杂度。

### Alternative B: 只写 ADR，不加数据库约束

未采用。Task 1.1 明确要求 schema 注释与约束表达，单纯依赖应用层约定容易在后续 repository 与回填流程中发生漂移。

### Alternative C: 在 Phase 1 同时引入 `memory_unit_anchors`

未采用。Task 1.1 的目标是先冻结 `memory_units` 数据模型基线；anchor 倒排索引在 Task 1.2 单独实现，边界更清晰。
