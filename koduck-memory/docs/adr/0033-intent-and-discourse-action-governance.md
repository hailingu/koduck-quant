# ADR-0033: Freeze Query Intent and Storage Discourse Action Semantics

- Status: Accepted
- Date: 2026-04-14
- Issue: #859

## Context

Task 3.1 已经把 `QueryMemory` 的 `query analyzer` 建立为显式内部组件，但 Task 3.2 仍有三个缺口：

1. 查询侧 `intent_type` 仍主要以散落字符串参与判断，闭集边界没有独立固化。
2. 存储侧 `discourse_action` 虽然在 anchor schema 中保留了类型位，但写路径没有稳定地产出这类锚点。
3. `intent_aux[]` 的“只做弱增强、不重复表达 `relation_types[]`、不单独改变主召回路径”还没有被代码层显式冻结。

如果继续维持这种状态，后续 Task 4.x 的 `intent_score` 和 anchor-first 重排会缺少稳定、可测试的语义基线。

## Decision

### 1. 把查询侧 `intent_type` 与存储侧 `discourse_action` 分成两个独立闭集

在 `retrieve/semantics.rs` 中新增共享语义层，显式冻结：

- 查询侧 `QueryIntentType`
  - `recall`
  - `compare`
  - `disambiguate`
  - `correct`
  - `explain`
  - `decide`
  - `none`
- 存储侧 `DiscourseAction`
  - `recall_prompt`
  - `comparison`
  - `disambiguation`
  - `correction`
  - `explanation`
  - `decision`
  - `other`

两者保持独立命名，避免把查询意图和记忆本身的话语动作混成一套标签。

### 2. 固化 `intent -> discourse_action` 的稳定映射

新增单一映射函数：

- `recall -> recall_prompt`
- `compare -> comparison`
- `disambiguate -> disambiguation`
- `correct -> correction`
- `explain -> explanation`
- `decide -> decision`
- `none -> None`

当前阶段这套映射先作为后续 `intent_score` 的稳定基线，不提前在重排器中做隐式扩散。

### 3. 在 materializer 写路径中落 `discourse_action` anchors

`MemoryUnitMaterializer` 在以下写路径中统一追加 `discourse_action` anchors：

- 追加消息产生的 generic conversation unit
- session summary unit
- fact units

写入规则：

1. 先用闭集启发式规则从源文本推断 `discourse_action`
2. 若没有命中任何显式动作，则落 `other`
3. 不复用查询侧 `intent_type` 直接写库，保持 storage 语义独立

这样可以保证未来无论是 entry 级还是 summary/fact 级命中，都有稳定的 storage-side `discourse_action` 可用于解释性打分。

### 4. 显式收紧 `intent_aux[]` 的边界

`intent_aux[]` 继续仅保留少量弱增强标签，例如：

- `cross_session_scope`
- `recent_bias`
- `decision_context`

并在 analyzer 中统一做归一化：

1. 去重
2. 移除与 `relation_types[]` 重复的语义值
3. 保持其只作为排序增强信号，不承担主召回入口职责

## Consequences

正面影响：

1. 查询侧与存储侧的语义边界被显式代码结构冻结。
2. `memory_units` 写路径现在能稳定产出 `discourse_action` anchors。
3. 后续实现 `intent_score` 时，不需要再回头补“语义来源到底是什么”的基础治理工作。

代价与权衡：

1. V1 的 `discourse_action` 仍然基于启发式关键词，不等于完整语义理解。
2. 对 summary/fact unit 的默认兜底会写入 `other`，这会让部分记录先拥有保守而非高精度的 storage 标签。

## Compatibility Impact

1. 不修改对外 gRPC 契约。
2. 不改变现有 `DOMAIN_FIRST` / `SUMMARY_FIRST` 的外部行为开关。
3. 只新增内部语义类型和写路径 anchor，不破坏已有 `memory_units` / `memory_unit_anchors` schema 契约。

## Alternatives Considered

### Alternative A: 继续只在 query analyzer 中维护 intent 字符串

未采用。这样 storage-side `discourse_action` 仍没有真正进入写路径，Task 3.2 无法闭环。

### Alternative B: 直接把查询侧 `intent_type` 原样持久化到 anchor

未采用。这会重新混淆“查询操作类型”和“记忆内容的话语动作模式”。

### Alternative C: 等 Task 4.x 做重排时再补 discourse_action

未采用。那样会把基础语义治理和排序实现耦合在一起，回归面更大，也更难验证。
