# ADR-0032: `QueryMemory` Internal Query Analyzer

- Status: Accepted
- Date: 2026-04-14
- Issue: #857

## Context

在 Task 2.x 完成之后，`koduck-memory` 已经具备了：

- `memory_units` / `memory_unit_anchors` 的物化基线
- `memory_index_records` 的兼容层
- `DOMAIN_FIRST` / `SUMMARY_FIRST` 的现有读路径

但 `QueryMemory` 当前仍然只是直接拼装一个很薄的 `RetrieveContext`，并没有一个被显式命名和测试的
`query analyzer` 子组件。这会带来三个问题：

1. `domain_class`、`intent`、`entity`、`relation` 的提取步骤仍是隐含的
2. 后续 Task 3.2 / 4.x 难以在统一入口上继续扩展
3. analyzer 失败时缺少明确、可验证的回退语义

Task 3.1 要求把 analyzer 收口成 `QueryMemory` 的内部组件。

## Decision

### 1. 在 `retrieve/` 模块下新增 `query_analyzer.rs`

引入内部组件：

- `QueryAnalyzer`
- `QueryAnalysis`

输入固定为：

- `query_text`
- `domain_class`
- `session_id`

输出固定为：

- `domain_classes[]`
- `entities[]`
- `relation_types[]`
- `intent_type`
- `intent_aux[]`
- `recall_target_type`

### 2. 使用启发式规则冻结 V1 analyzer 输出骨架

V1 不依赖额外模型调用，而是先用稳定的启发式规则完成：

- `domain_class` 归一化
- `intent_type` 粗分类
- `entities` 的轻量提取
- `relation_types` 的关键词识别
- `recall_target_type` 的偏好/事实/通用识别
- `intent_aux[]` 的有限增强标签

这保证 Task 3.1 能先把 analyzer 组件边界收稳，再在后续任务中继续丰富语义。

### 3. 把 analyzer 作为 `QueryMemory` 的显式前置步骤

`QueryMemory` 在分派给 `DOMAIN_FIRST` / `SUMMARY_FIRST` 之前：

1. 先调用 `QueryAnalyzer::analyze(...)`
2. 再把分析结果灌入扩展后的 `RetrieveContext`
3. 现有 retriever 暂时仍主要使用 `domain_class` / `query_text` / `session_id`

这样 analyzer 不再是“未来要加的概念”，而是已经进入真实主路径的内部步骤。

### 4. analyzer 失败时显式回退

若 analyzer 返回错误：

- 记录结构化 warning
- 回退到 `QueryAnalysis::fallback(...)`
- 保留原始 `domain_class + query_text + session_id` 路径

这保证 analyzer 不会因为局部解析失败而阻塞主检索请求。

## Consequences

正面影响：

1. `QueryMemory` 拥有了明确的 analyzer 子流程和结构化上下文载体。
2. 后续 Task 3.2 / 4.x 可以在同一入口上继续演进，而不必重构主 RPC。
3. analyzer 的失败语义被代码和测试显式冻结。

代价与权衡：

1. V1 analyzer 仍是启发式实现，召回语义增强有限。
2. 当前 retriever 还没有完全消费 `entities[]` / `relation_types[]` / `intent_aux[]`，这些字段先作为稳定中间表示存在。

## Compatibility Impact

1. 不修改 `memory.v1` 对外契约。
2. 不改变 `DOMAIN_FIRST` / `SUMMARY_FIRST` 的现有外部开关语义。
3. analyzer 失败时回退到旧路径，因此不会破坏现有查询请求。

## Alternatives Considered

### Alternative A: 继续把 analyzer 保持为隐含步骤

未采用。这样后续 intent / anchor path 的扩展入口仍然模糊。

### Alternative B: 直接接入外部 LLM/分类服务

未采用。Task 3.1 的目标是先建立内部组件边界，不是引入新的外部依赖。

### Alternative C: 先不扩展 `RetrieveContext`，只在 `QueryMemory` 局部使用 analyzer 结果

未采用。这样 analyzer 输出无法成为后续检索管线的稳定中间表示。
