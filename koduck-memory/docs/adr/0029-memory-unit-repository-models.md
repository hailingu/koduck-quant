# ADR-0029: `memory_unit` Repository Models

- Status: Accepted
- Date: 2026-04-14
- Issue: #851

## Context

经过 Task 1.1 ~ Task 1.3，`koduck-memory` 已经具备 `memory_units`、`memory_unit_anchors` 以及相关的
schema 约束与投影规则，但服务内仍缺少对应的 typed model / repository。这会带来两个直接问题：

1. 后续 Task 2.2、Task 2.3 无法基于统一的领域模型推进写入链路与兼容映射。
2. `memory_kind = NULL`、`summary_status + summary` 这类关键语义如果继续以裸字符串传播，容易在不同调用点发生漂移。

Task 2.1 明确要求：

- 为 `memory_units` 建立 model / repository
- 为 `memory_unit_anchors` 建立 model / repository
- 在 repository 层静态表达 `summary_status` 与 `summary` 的组合约束
- 统一把 `memory_kind = NULL` 解释为 generic conversation unit

## Decision

### 1. 新增两个领域模块

在 `koduck-memory/src/` 下新增：

- `memory_unit/`
- `memory_anchor/`

沿用现有 `session`、`memory`、`summary`、`facts` 模块的组织方式，每个模块包含：

- `model.rs`
- `repository.rs`
- `mod.rs`

### 2. 用 Rust 类型固定关键语义

`memory_unit::model` 中引入：

- `MemoryUnitKind`
  - `GenericConversation`
  - `Summary`
  - `Fact`
- `MemoryUnitSummaryState`
- `SummaryPayload`

其中：

- 数据库中的 `memory_kind = NULL` 统一映射到 `MemoryUnitKind::GenericConversation`
- `summary_status = ready` 时必须带非空 summary
- `summary_status = pending` 时不允许携带 summary payload

这使 repository 的输入和输出都不再直接暴露“可随意拼接”的状态组合。

### 3. Repository 返回 typed model，而不是裸字符串行结构

repository 内部仍允许通过 `MemoryUnitRow` / `MemoryUnitAnchorRow` 承接 SQL 返回值，
但对外统一返回转换后的 typed model：

- `MemoryUnit`
- `MemoryUnitAnchor`

这样把数据库兼容细节留在仓储内部，把领域语义放到模块边界。

### 4. 最小可用 repository 接口

本次只提供 Task 2.1 所需的最小接口：

- `MemoryUnitRepository`
  - `insert`
  - `get_by_id`
  - `list_by_session`
- `MemoryUnitAnchorRepository`
  - `insert`
  - `list_by_memory_unit`
  - `list_by_anchor`

这足够支持后续物化与检索主路径接入，同时保持当前变更范围聚焦。

## Consequences

正面影响：

1. `memory_kind` 与 `summary_status` 的核心语义第一次在 Rust 层形成统一的领域抽象。
2. 后续物化链路可以直接复用 builder 和 repository，不必重复做字符串校验。
3. `generic conversation unit` 的语义不再依赖调用者记住“NULL 的特殊含义”。

代价与权衡：

1. repository 需要在内部维护一层 row struct 到 typed model 的转换。
2. 当前 `summary_status = failed` 仍允许带可选 summary，保持与 schema 一致，没有额外缩紧业务策略。
3. 这一步只完成最小 CRUD，没有立刻接入现有 capability/service 主链路。

## Compatibility Impact

1. 不修改 `memory.v1` 契约。
2. 不替换现有 `memory_entries` / `memory_index_records` / `memory_summaries` / `memory_facts` 路径。
3. 只新增内部 Rust 模块，对已有 northbound/southbound 行为无 breaking change。

## Alternatives Considered

### Alternative A: 继续用裸字符串字段，不新增枚举

未采用。这样无法满足 Task 2.1 对“静态表达字段语义”的要求，也会让后续写入链路继续承担重复校验。

### Alternative B: 直接在现有 `memory` 或 `index` 模块里混放 `memory_unit` 代码

未采用。`memory_unit` 与 `memory_entries`、`memory_index_records` 语义不同，混放会模糊边界。

### Alternative C: 一次性把 repository 接入 capability/service 主链路

未采用。Task 2.1 目标是先补齐模型与仓储基线；真正的物化与兼容写入留给 Task 2.2 / 2.3。
