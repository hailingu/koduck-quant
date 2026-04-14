# ADR-0025 Anchor-based Memory Retrieval 实施任务清单

> 对应 ADR： [0025-anchored-memory-unit-retrieval-architecture.md](../../koduck-memory/docs/adr/0025-anchored-memory-unit-retrieval-architecture.md)
>
> 状态：规划中
> 创建日期：2026-04-14

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
| ---- | ---- | ---- | ------ |
| Phase 1 | 数据模型与迁移基线 | - | P0 |
| Phase 2 | Repository 与写入链路扩展 | Phase 1 | P0 |
| Phase 3 | Query Analyzer 与检索上下文 | Phase 1 | P0 |
| Phase 4 | Anchor-based 检索主路径 | Phase 2, Phase 3 | P0 |
| Phase 5 | Summary Gate 与排序收口 | Phase 4 | P1 |
| Phase 6 | 兼容迁移与灰度切换 | Phase 4, Phase 5 | P1 |
| Phase 7 | Recall 扩展契约决策 | Phase 4 | P2 |

## 范围边界

本任务清单覆盖：

- `memory_unit` 与 `memory_unit_anchors` 的数据模型落地
- `domain/entity/relation/discourse_action/fact_type` 的锚点检索主路径
- `query analyzer` 的服务内实现
- `SUMMARY_FIRST` 与 `summary_status` 的兼容收口
- `DOMAIN_FIRST -> anchor path` 的内部迁移

本任务清单不直接覆盖：

- `recall` 扩展路径的交互式 batch 中间材料传递契约
- 新增 northbound API 或修改现有 `memory.v1` proto
- 上层 orchestration 如何消费 recall 扩展结果生成最终自然语言回答

## Phase 1：数据模型与迁移基线

目标：建立 `memory_unit` 级别的最小可持久化模型，并冻结字段语义。

任务：

1. 新增 `memory_units` 表 migration。
2. 新增 `memory_unit_anchors` 表 migration。
3. 明确 `memory_kind` 语义：
   - `NULL` 表示 `generic conversation unit`
   - 仅允许 `summary`、`fact` 两个已物化类型
4. 明确 `summary_status` 语义：
   - `pending`
   - `ready`
   - `failed`
5. 将 `domain_class_primary` 固化为投影字段，选择规则固定为：
   - `weight DESC, anchor_key ASC`
6. 为 `memory_unit_anchors` 建立索引：
   - `tenant_id + anchor_type + anchor_key`
   - `tenant_id + memory_unit_id`
   - `memory_unit_id + anchor_type`
7. 明确 `fact_type` 约束：
   - 仅允许出现在 `memory_kind = fact` 的 unit 上

交付物：

- migration SQL
- 表结构注释
- 字段语义说明补充到 repository model 注释中

## Phase 2：Repository 与写入链路扩展

目标：让现有写入链路能够物化 `memory_unit` 与 anchors，但不破坏现有读路径。

任务：

1. 新增 `memory_units` repository。
2. 新增 `memory_unit_anchors` repository。
3. 在写入链路中建立 `memory_entry -> memory_unit` 的映射规则：
   - 单条 entry 形成 unit
   - 多条连续 entry 聚合形成 unit
4. 规范 `source_uri` 与 `entry_range_start/end`：
   - `source_uri` 始终作为主回溯入口
   - 多 entry unit 通过 `entry range` 回放完整原始材料
5. 建立 `snippet` 生成规则：
   - 可由写入链路同步生成
   - 或由 L0 / summary 派生
   - 对外返回时必须稳定可用
6. 保留 `memory_index_records` 兼容写入，避免一次性切读路径。

交付物：

- repository model / repository implementation
- 写入链路物化逻辑
- `memory_index_records` 到 `memory_units` 的关联字段设计

## Phase 3：Query Analyzer 与检索上下文

目标：把 `QueryMemory` 的“解析”从隐含逻辑收口成可维护的内部组件。

任务：

1. 新增 `query analyzer` 内部组件。
2. 输入固定为：
   - `query_text`
   - `domain_class`
   - `session_id`
3. 输出冻结为结构化 `RetrieveContext` 扩展字段：
   - `domain_classes[]`
   - `entities[]`
   - `relation_types[]`
   - `intent_type`
   - `intent_aux[]`
   - `recall_target_type`
4. 固化 `intent_type` 主标签闭集：
   - `recall`
   - `compare`
   - `disambiguate`
   - `correct`
   - `explain`
   - `decide`
   - `none`
5. 固化 `discourse_action` 闭集与映射规则。
6. 明确回退策略：
   - analyzer 无法稳定抽取时，退回 `domain_class + query_text` 路径
7. 明确 `intent_aux[]` 约束：
   - 不重复表达 `relation_types[]`
   - 不改变主召回路径

交付物：

- analyzer 模块
- query context 类型定义
- 分类与映射规则测试用例设计说明

## Phase 4：Anchor-based 检索主路径

目标：把检索主路径从 `session/domain` 粗粒度升级到 `memory_unit + anchors`。

任务：

1. 实现 `ANCHOR_FIRST` 服务内检索路径。
2. 并行召回候选：
   - `domain`
   - `entity`
   - `relation`
   - `session scope`
3. 合并候选并生成 `match_reasons`。
4. 冻结 `match_reasons` 闭集：
   - `domain_hit`
   - `entity_hit`
   - `relation_hit`
   - `discourse_action_hit`
   - `session_scope_hit`
   - `summary_hit`
   - `fact_hit`
   - `recency_boost`
5. 保留 `DOMAIN_FIRST` 行为语义，但内部允许委托到 anchor 路径。
6. 明确 `time_bucket` 仅用于排序，不参与独立倒排召回。

交付物：

- anchor-based retriever
- `match_reasons` 生成逻辑
- 兼容现有 `QueryMemory` handler 的读路径接入

## Phase 5：Summary Gate 与排序收口

目标：在不牺牲 recent memory 可见性的前提下，保留 `SUMMARY_FIRST` 的负向过滤语义。

任务：

1. 将 `summary gate` 限制为：
   - 仅当 `summary_status = ready` 时生效
2. 明确 `summary_status != ready` 的处理：
   - 候选继续沿 anchor 路径参与排序
   - 不能因为摘要未就绪而隐藏
3. 实现可解释排序：
   - `domain_score`
   - `entity_score`
   - `relation_score`
   - `intent_score`
   - `recency_score`
   - `salience_score`
4. 确保 `intent_score` 不重复吸收 `relation_score` 已表达的信号。
5. 固化初始排序权重并记录到配置或常量定义中。

交付物：

- summary gate 实现
- rerank 实现
- 排序权重配置入口

## Phase 6：兼容迁移与灰度切换

目标：在不破坏现网语义的前提下，把默认读路径迁到 anchors。

任务：

1. 增加服务内 `ANCHOR_FIRST` feature flag。
2. 支持租户级灰度控制。
3. 保持 `memory.v1` `RetrievePolicy` 不变，不新增 proto 枚举值。
4. 建立兼容迁移顺序：
   - 先写新表
   - 再双读/灰度读
   - 最后将 `DOMAIN_FIRST` 内部委托到 anchor path
5. 增加观测字段：
   - `retrieved_anchor_set`
   - `retrieved_scores`
   - `summary_filter_ratio`
6. 建立基础指标：
   - `anchor_precision@k`
   - `p95_query_latency_ms`
   - `recall_expanded_success_rate`
   - `recall_batch_completion_ratio`

交付物：

- feature flag / rollout 配置
- 灰度切换说明
- 观测指标与日志埋点

## Phase 7：Recall 扩展契约决策

目标：把当前 ADR 中尚未冻结的 recall 扩展路径，单独收口为后续契约决策。

当前未冻结项：

1. batch 级中间摘要材料的返回形态
2. 多轮/分批历史回顾交互的 southbound 契约
3. 是否新增 RPC，还是扩展现有 `QueryMemoryResponse`
4. 上层 orchestration 如何消费 recall 扩展材料

建议动作：

1. 新建 follow-up ADR，专门收口 recall 扩展 contract。
2. 在该 ADR 冻结前，不将 recall 扩展交互式能力纳入当前 P0 交付范围。

## 建议实施顺序

1. 先完成 Phase 1、Phase 2，确保模型和写入链路稳定。
2. 再完成 Phase 3、Phase 4，建立最小 anchor-based retrieval 主路径。
3. 然后完成 Phase 5，把 `SUMMARY_FIRST` 与排序行为收口。
4. 最后进入 Phase 6 灰度切换。
5. Phase 7 单独走后续 ADR，不阻塞主路径落地。

## 验收标准

主路径验收：

1. `QueryMemory` 在不改 `memory.v1` proto 的前提下，可通过 anchor path 返回 `MemoryHit`。
2. recent memory 在 `summary_status = pending` 时仍可被 anchors 命中。
3. `domain_class_primary` 投影规则在回填、重算、迁移中保持一致。
4. `match_reasons` 与闭集定义一致，不出现开放集漂移。

兼容性验收：

1. `DOMAIN_FIRST` 对外语义不回退。
2. `SUMMARY_FIRST` 仍保持负向过滤特征。
3. `ANCHOR_FIRST` 仅作为服务内部 feature flag，不暴露到 `memory.v1` 契约。

范围验收：

1. 当前阶段不要求 `QueryMemory` 直接返回 batch 级中间摘要材料。
2. recall 扩展交互能力必须等待 follow-up contract ADR 冻结。
