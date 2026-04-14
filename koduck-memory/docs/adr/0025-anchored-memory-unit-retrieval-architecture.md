# ADR-0025: Anchor-based Memory Retrieval Architecture

- Status: Draft
- Date: 2026-04-14
- Issue: TBD (must be assigned before Accepted)

## Context

### Current State

`koduck-memory` 在 V1 已经具备以下基础能力：

- 会话元数据真值与南向 `memory.v1` 契约（含 `QueryMemory`、`AppendMemory`、`SummarizeMemory`）
- L0 原始材料对象存储（`memory_entries` -> `l0_uri`）
- L1 索引表与检索策略（`memory_index_records`、`DOMAIN_FIRST`、`SUMMARY_FIRST`）

当前检索主路径仍以 `domain_class` 和可选 `session scope` 作为结构化入口：

- `DOMAIN_FIRST` 先按 `domain_class` 粗筛，再按 `session_id` 做可选范围限制
- `SUMMARY_FIRST` 仅在候选集内追加 summary 相关过滤

### Current Gaps

在上述前提下，现有实现仍未能直接表达：

- 同一条对话内容对应多个语义标签（Domain + NER + 关系）
- “记忆单元”级别的召回精度
- 显著性/关系性线索对结果排序的明确权重
- 跨会话历史回顾类请求的稳定召回能力

### Problem To Solve

因此，本 ADR 需要回答以下问题：

1. 如何在不破坏现有 `memory.v1` 契约的前提下，把检索粒度从 `session` 收紧到 `memory_unit`
2. 如何在 `domain_class` 之外，引入可解释且可索引的 `entity`、`relation` 等检索锚点，并将时间限定为排序信号
3. 如何在保持 `SUMMARY_FIRST` 负向过滤语义的前提下，避免 recent memory 因摘要未完成而不可见
4. 如何为跨会话历史回顾类请求提供更稳定的召回与汇总路径

## Decision

1. 引入 L1 记忆单元（Memory Unit）作为检索基本返回和索引承载对象
    - 不再以 `session_id` 作为默认最小召回粒度
    - 一个 `memory_unit` 对应可追溯的一组连续 `memory_entry`（可为单条或多条）

2. 采用“多锚点倒排索引”
    - `domain_class` 为粗筛锚点
    - `entities`（NER）为高精度锚点
    - `relations` 为语义关系锚点（比较、纠错、偏好等）
    - 查询侧 `intent` 仅表示当前查询的交互操作类型，不表示情绪或主体状态
    - 存储侧不持久化查询 `intent`，如需表达一段记忆本身的交互动作，应使用独立锚点类型 `discourse_action`
    - `time_bucket` 只作为辅助排序信号，不作为 V1 候选召回锚点
3. 回忆型查询支持“扩展范围召回”
    - 已冻结部分：
      - 默认仍优先使用 anchor 倒排
      - 当查询被判定为显式回忆请求且无明确 `session_id` 时，可扩大到跨 session 检索
      - 在候选量过大时，允许按时间倒序分批（batch）召回 `memory_units`
    - 待后续 contract decision 冻结的部分：
      - `koduck-memory` 如何输出 batch 级检索结果或中间摘要材料
      - 上下游如何传递交互式批次结果
      - 这些中间材料如何被上层 orchestration 消费为最终自然语言回顾回答

4. 将 `summary` 从“命中依据”降级为“候选裁剪器”
    - `DOMAIN_FIRST` 提供候选域
    - `SUMMARY_FIRST` 再按命中条件进行负向过滤
    - 若不命中 summary，优先返回空而非退化为不相关候选

5. `QueryMemory` 流程改为五步编排（可观测）
    - 解析查询 -> 多锚点召回 -> 去重合并 -> 加权重排 -> 返回命中

6. 低质量 summary 视为写入质量问题
    - 写入侧必须保证 `summary` 非空、非模板化（如 `Session 'untitled' summary`）
    - 读取侧不引入额外 heuristic 兜底语义，以保持行为可预期
    - 若 `summary` 尚未物化完成，则该 `memory_unit` 仍可通过 anchors 参与检索，但不进入 `summary gate`
    - 低质量 summary 不应进入 `summary gate`，但不自动否决该 `memory_unit` 的 anchor 可检索性

7. 保持与现有 `memory.v1` 契约兼容
    - anchor-based hit retrieval 主路径保持与现有 `memory.v1` 契约兼容
    - 不新增破坏性字段
    - 在服务内基于 `query_text`、`domain_class`、`session_id` 构建结构化 query context
    - `recall` 扩展路径所需的 batch 级中间材料传递，不属于当前 `MemoryHit` 契约覆盖范围，需后续单独冻结 contract

8. 固化 V1 查询侧 `intent` 分类，避免语义漂移
    - 主标签从封闭集合中选择：`recall`、`compare`、`disambiguate`、`correct`、`explain`、`decide`、`none`
    - 可选辅标签仅用于增强排序，不单独改变主路径
    - `none` 表示“无额外 intent-specific routing”，不表示“禁止检索 memory”

## Proposed Data Model Changes

### 1) `memory_units`（建议新增）

每条记忆单元记录索引与返回边界，替代对 `session_id` 的粗粒度候选。

- `memory_unit_id`（PK）
- `tenant_id`
- `session_id`
- `entry_range_start` / `entry_range_end`（可追溯范围）
- `memory_kind`（可空；V1 与现有分类对齐，仅使用 `summary / fact`）
- `domain_class_primary`
- `summary`（可空；当 `summary_status = ready` 时必须满足质量约束）
- `snippet`（检索展示文本；可由写入链路同步生成，或由 L0/summary 派生）
- `source_uri`（主回溯 URI；当 unit 覆盖多条 entry 时，只表示主锚点对象）
- `summary_status`（pending / ready / failed）
- `salience_score`
- `time_bucket`（如 `2026-04` 或阶段标签）
- `created_at` / `updated_at`

补充约束：

- `memory_unit` 可覆盖单条或多条连续 `memory_entry`
- 当 `memory_unit` 覆盖多条 entry 时，必须依赖 `entry_range_start / entry_range_end` 回放完整原始材料
- `source_uri` 仅作为主回溯入口，不应被理解为 unit 全部原始材料的完整枚举
- 如后续需要更精细追溯，可新增 `memory_unit_sources` 子表，但 V1 可先依赖 `entry range + source_uri` 组合表达
- `source_uri` 在单 entry 与多 entry unit 场景下都应必填，用作主回溯入口
- `summary_status = pending` 时允许 `summary = NULL`
- `summary_status = ready` 时要求 `summary` 非空且通过质量校验
- `snippet` 不是检索真值字段，允许由写入链路或读路径派生，但对外返回时必须稳定可用
- 普通会话片段不强制设置 `memory_kind`；仅当物化为现有分类时才写 `summary` 或 `fact`
- `memory_kind = NULL` 在 V1 统一表示 `generic conversation unit`，不得使用空字符串或额外枚举值表达同一语义

`domain_class_primary` 不是独立真值字段，而是 `domain` anchors 的投影字段：

- 写入时按 `weight DESC, anchor_key ASC` 选择第一条 `domain` anchor 投影得到
- 不允许脱离 `domain` anchors 单独维护
- 回填、重算、迁移时必须使用同一规则，保证 primary 投影可复现

### 2) `memory_unit_anchors`（建议新增）

- `memory_unit_id`
- `tenant_id`
- `anchor_type`（domain / entity / relation / discourse_action / fact_type）
- `anchor_key`
- `anchor_value`（如 entity 规范名）
- `weight`（0~1）
- `created_at` / `updated_at`

索引策略：

- `tenant_id + anchor_type + anchor_key`（高频检索）
- `tenant_id + memory_unit_id`
- `memory_unit_id + anchor_type`

其中查询侧 `intent` 与存储侧 `discourse_action` 需要明确区分：

- 查询侧 `intent` 不是“这个主体当时的内在心理状态”
- 查询侧 `intent` 也不是“是否真正学会/理解”的认知阶段标签
- 查询侧 `intent` 只表示当前查询在交互中的操作类型，用于弱路由和弱排序
- 存储侧 `discourse_action` 表示该段记忆本身呈现出的交互动作模式，例如 `comparison`、`correction`、`clarification`
- `fact_type` 只允许出现在 `memory_kind = fact` 的 `memory_unit` 上，作为事实类记忆的子分类

建议的查询侧 `intent_type` 取值：

- `recall`：回忆之前是否聊过某事
- `compare`：比较两个对象或概念
- `disambiguate`：做主体/概念辨析，例如“老舍还是鲁迅”
- `correct`：纠正之前的说法或理解
- `explain`：解释某个知识点或背景
- `decide`：围绕一个选项或方案做决策

如果未来确实需要表达“当时不会、后来会了”这类变化，应单独建模为 `state_transition` 或 `learning_stage`，而不是复用 `intent`。

建议的存储侧 `discourse_action` 闭集（V1）：

- `recall_prompt`
- `comparison`
- `disambiguation`
- `correction`
- `explanation`
- `decision`
- `other`

查询侧 `intent` 与存储侧 `discourse_action` 的映射关系应保持稳定：

- `recall -> recall_prompt`
- `compare -> comparison`
- `disambiguate -> disambiguation`
- `correct -> correction`
- `explain -> explanation`
- `decide -> decision`
- `none ->` 不参与 `intent_score`

### 3) `memory_index_records`（可兼容保留）

- 作为兼容层继续映射到 `memory_units` 的 `memory_unit_id`
- 先保持现有查询兼容，逐步把写入迁移到 unit+anchors

## Retrieval Pipeline

### 输入

`QueryMemoryRequest` 解析后生成内部检索上下文 `RetrieveContext`，扩展字段包括：

- `tenant_id`（强制）
- `session_id`（可选）
- `domain_classes[]`（抽取）
- `entities[]`（抽取）
- `relation_types[]`（抽取）
- `intent_type`（抽取，弱信号）
- `intent_aux[]`（可选辅标签，仅用于增强排序，不重复编码 `relation_types[]`）
- `recall_target_type`（可选，如 `general / preference / fact`）
- `top_k`（上限约束）

V1 必须包含一个 `query analyzer` 作为 `QueryMemory` 的内部子组件：

- 它属于 `QueryMemory` 服务内子流程，不上浮为外部 northbound 能力
- 输入为 `query_text`、`domain_class`、`session_id`
- 输出为结构化 query context（如 `intent_type`、`entities[]`、`relation_types[]`）
- 若 analyzer 无法稳定抽取结构化信号，则回退到原始 `domain_class + query_text` 路径

说明：
- 若 `intent_type = recall` 且无明确 `session_id`，可扩大到跨 session 检索
- 若 `intent_type = recall` 且 `recall_target_type = preference`，可优先锚定 `fact_type=preference`
- 若 `intent_type = recall` 且 `recall_target_type = fact`，可优先锚定 `memory_kind=fact`
- 若 `intent_type` 为 `compare`、`disambiguate` 或 `correct`，优先提高 `entity` 与 `relation` 锚点权重
- 若 `intent_type = none`，不单独改变检索路径，仍按已有 domain/entity/relation 解析继续执行

### Intent Classification (V1)

V1 使用显式 `intent` 枚举做弱控制与排序增强。`intent` 不等价于 `domain_class`，也不表示主体内在状态；它只表示当前查询在交互中的操作类型。

V1 classifier 必须输出一个主标签，且该主标签只能来自以下封闭集合：

- `recall`
- `compare`
- `disambiguate`
- `correct`
- `explain`
- `decide`
- `none`

V1 不允许输出开放集主标签；若分类器无法稳定归入上述集合，必须回落到 `none`。

除主标签外，classifier 可输出 0..N 个辅标签用于排序增强，但辅标签不能替代主标签，也不能单独定义新的主路由。

| intent_type | 定义 | 典型触发问法 | 路由动作 |
|---|---|---|---|
| `recall` | 请求回忆之前的讨论、事实、偏好或上下文 | “我们之前聊过什么？” “我之前说过回答风格吗？” | 优先召回既有 memory；必要时扩大到跨 session 检索 |
| `compare` | 比较两个对象、人物、概念或方案 | “老舍和鲁迅的区别是什么？” | 提高 `entity` 与 `relation=compare` 权重 |
| `disambiguate` | 在多个候选对象中做辨析 | “我们聊过老舍还是鲁迅来着？” | 提高 `entity` 与 `relation=confusion/disambiguate` 权重 |
| `correct` | 纠正之前的说法、记忆或理解 | “不对，我之前说的不是这个” | 提高 `relation=correction` 权重，并偏向最近命中 |
| `explain` | 解释知识点、背景或前文上下文 | “你解释一下刚才提到的那个背景” | 保持常规 anchor 检索，适度提高 `domain` 权重 |
| `decide` | 围绕选项、方案、偏好做取舍 | “我们之前倾向选哪种方案？” | 结合 `relation`、`fact` 与 `salience` 做排序 |
| `none` | 无法识别明确操作类型 | 普通问答/新问题 | 不额外修改检索路径 |

分类优先级（V1）：

1. 先抽取一个主 `intent`（recall/compare/disambiguate/correct/explain/decide/none）
2. 再抽取 `domain_class`、`entities`、`relations`
3. 可额外抽取辅标签 `intent_aux[]` 做排序增强
4. 若 `intent=none`，不代表跳过 memory，只表示不做额外路由增强

`intent_aux[]` 的约束：

- 仅承载未被 `relation_types[]` 结构化表达的附加路由信号
- 不应重复编码 `relation_types[]` 中已经存在的语义
- 不应单独改变主召回路径

### 候选召回

并行执行多路倒排：

1. `domain_class` -> 候选集合 A
2. `entities` -> 候选集合 B
3. `relations` -> 候选集合 C
4. `session_id`（有则）-> 候选集合 D（限定范围）

将 A/B/C/D 并集并去重，记录每条命中的来源标签，形成 `match_reasons`。

#### `recall intent` 扩展召回流程

当 `intent_type = recall` 且无明确 `session_id`，并且查询明显指向历史回顾时：

1. 在租户范围内按时间倒序分页抓取 `memory_units`（不限定 3 个月）
2. 每个 batch 可生成结构化中间摘要材料（主题/结论/偏好/待办）
3. 这些中间摘要材料是服务内或后续扩展契约使用的中间表示，不属于当前 `MemoryHit` 输出形态
4. 在当前阶段，`koduck-memory` 对外仍以检索结果为主；若要传递 batch 中间材料，需后续扩展契约
5. 命中 token/时延预算即停止，并输出可复用的中间结果边界

### 重排

使用可解释打分模型：

- `domain_score`（来自 domain_class 命中）
- `entity_score`（实体命中）
- `relation_score`（关系命中）
- `intent_score`（查询侧 `intent` 与存储侧 `discourse_action` 的弱匹配信号）
- `recency_score`（时间衰减）
- `salience_score`（记忆重要度）

`intent_score` 的计算不应重复吸收已在 `relation_score` 中体现的结构化关系信号。

建议初始权重：

- `domain 0.30`
- `entity 0.35`
- `relation 0.15`
- `intent 0.05`
- `recency 0.10`
- `salience 0.05`

### Summary Gate

`SUMMARY_FIRST` 路径对候选做摘要相关性检验：

- 命中时保留并加 `summary_hit`
- 未命中时返回空（与现有实现一致）
- 仅当 `summary_status = ready` 时才允许进入 `summary gate`
- 当 `summary_status != ready` 时，候选应继续沿 anchor 路径参与排序，不能因为摘要未就绪而被隐藏

### 输出

返回 `MemoryHit`：

- `session_id`
- `l0_uri`（取自 `source_uri`）
- `score`
- `match_reasons`
- `snippet`

必要时在编排层可按 `source_uri` 再拉取 L0 原文做二次拼接。

建议冻结一版 `match_reasons` 闭集（V1）：

- `domain_hit`
- `entity_hit`
- `relation_hit`
- `discourse_action_hit`
- `session_scope_hit`
- `summary_hit`
- `fact_hit`
- `recency_boost`

`time_bucket` 在 V1 仅用于计算 `recency_score` 或按时间顺序组织 batch，不参与独立倒排召回。

## API and Contract Alignment

本方案区分两类契约边界：

1. anchor-based hit retrieval 主路径
2. `recall` 扩展路径中的 batch 中间材料传递

其中第 1 类在当前阶段不要求立刻修改 `proto` 字段：

- `domain_class` 继续作为主要入口参数
- `query_text` 承担扩展语义输入（NER、关系、意图抽取）
- `match_reasons` 扩展为 `domain/entity/relation/discourse_action/session_scope/summary/fact` 等命中标志

第 2 类当前契约并不充分：

- 仅靠 `MemoryHit` 无法完整表达 batch 级中间摘要材料
- 若要支持多轮或分批的历史回顾交互，需要后续单独冻结 contract 扩展或新增 RPC
- 在该 contract 决策完成前，ADR 中的 `recall` 扩展路径仅作为架构方向，不视为当前 `memory.v1` 已可完整承载

在兼容阶段建议新增结构化日志字段记录：

- `retrieved_anchor_set`
- `retrieved_scores`
- `summary_filter_ratio`

用于观测与策略迭代。

## Migration Strategy

1. 先并行构建 unit/anchor 落盘任务，不影响现有 QueryMemory 读路径
2. QueryMemory 在服务内部增加 `ANCHOR_FIRST` 实验路径
3. 在 `tenant` 级指标满足覆盖率与延迟后逐步切默认策略
4. 最终将 `DOMAIN_FIRST` 内部委托到 anchor 路径，`summary_first` 保持负向过滤语义

其中 `ANCHOR_FIRST` 仅表示服务内 feature flag / rollout 开关：

- 不新增 `memory.v1` proto 枚举值
- 不作为外部可见 retrieve policy
- 由服务配置或租户级灰度控制是否启用

## Consequences

正向影响：

1. 召回粒度从会话级变为记忆单元级，降低误召回
2. 支持 `domain + entity + relation` 的多维定位，贴合“老舍/鲁迅类问法”
3. 命中可解释性增强（多 match reason）
4. 与现有 L1/L2 设计保持兼容，避免一次性破坏重写

代价：

1. 需新增索引表和异步抽取任务
2. 召回阶段从单条件查询变为多查询并集合并，需关注热点查询的 p95 延迟
3. NER/关系抽取质量决定召回上限，需持续优化抽取器
4. `recall` 扩展召回的批处理汇总增加了编排复杂度，需要更严格的预算控制

## Alternatives Considered

### 1) 继续使用 `memory_index_records` 单域字段检索

- 结论：实现快但难满足多主体、同条多标签场景的精召回。

### 2) 采用外部向量检索做主干

- 结论：可增强语义匹配，但不具备可解释“标签锚点”特性，且不符合当前 V1 可控复杂度目标。

## Verification

建议通过最小验收指标完成验证：

- `anchor_precision@k` 在 `老舍/鲁迅`、`历史 vs 文学` 查询上的提升
- `summary_filter_pass_rate` 维持可解释行为
- `p95_query_latency_ms` 与现有 `DOMAIN_FIRST` 对比不恶化超过约定阈值
- 回退能力：`summary` 未命中可稳定返回空集合
- `recall_expanded_success_rate`：`我们之前聊过什么` 类请求不再退化为“无跨会话记忆”
- `recall_batch_completion_ratio`：在预算内完成批处理并输出可用回顾

## References

- 设计基线：[koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 既有索引 ADR：[0015-memory-index-records.md](./0015-memory-index-records.md)
- 既有检索 ADR：[0016-domain-first-implementation.md](./0016-domain-first-implementation.md)、[0017-summary-first-implementation.md](./0017-summary-first-implementation.md)
- `koduck-ai` 对接协议：[../implementation/koduck-ai-rust-grpc-tasks.md](../implementation/koduck-ai-rust-grpc-tasks.md)
