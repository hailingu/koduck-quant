# ADR-0025 Anchor-based Memory Retrieval 实施任务清单

> 本文档基于 `koduck-memory/docs/adr/0025-anchored-memory-unit-retrieval-architecture.md` 拆分，提供 step-by-step 可执行任务。
>
> **状态**: 待执行
> **创建日期**: 2026-04-14
> **对应 ADR**: [0025-anchored-memory-unit-retrieval-architecture.md](../../koduck-memory/docs/adr/0025-anchored-memory-unit-retrieval-architecture.md)

## 与 ADR-0025 任务映射

本任务清单只覆盖已经可以进入实现阶段的部分；`recall` 扩展路径中的 batch 中间材料传递与交互式契约，不纳入当前 P0 范围。

| 主题 | 在本任务清单中的落点 | 当前要求 |
|------|------|------|
| `memory_unit` 数据模型 | Phase 1 / Phase 2 | 从 `session` 粒度收紧到 `memory_unit`，保留 `memory_kind` 并冻结字段语义 |
| 多锚点倒排索引 | Phase 1 / Phase 4 | 支持 `domain/entity/relation/discourse_action/fact_type` |
| `query analyzer` | Phase 3 | 作为 `QueryMemory` 必需内部组件输出结构化 query context |
| `SUMMARY_FIRST` 收口 | Phase 5 | 仅当 `summary_status = ready` 时进入 `summary gate` |
| `DOMAIN_FIRST` 兼容迁移 | Phase 4 / Phase 6 | 对外语义保持不变，内部逐步委托到 anchor path |
| 时间维度 | Phase 4 / Phase 5 | `time_bucket` 仅参与排序，不进入 V1 候选召回 |
| `recall` 扩展路径 | Phase 7 | 只冻结检索方向，不冻结 batch 材料传递契约 |

其中 `koduck-memory` 现有的 session 真值、L0 存储、`memory_index_records`、`DOMAIN_FIRST` / `SUMMARY_FIRST` 基线能力，仍以既有实现和文档为准。本清单只维护 ADR-0025 新增或收口的实现责任。

---

## 执行阶段概览

| 阶段 | 名称 | 预计工作量 | 依赖 | 优先级 |
|------|------|------------|------|--------|
| Phase 1 | 数据模型与 migration 基线 | 1-2 天 | - | P0 |
| Phase 2 | Repository 与写入链路扩展 | 2-3 天 | Phase 1 | P0 |
| Phase 3 | Query Analyzer 与检索上下文 | 1-2 天 | Phase 1 | P0 |
| Phase 4 | Anchor-based 检索主路径 | 2-3 天 | Phase 2, Phase 3 | P0 |
| Phase 5 | Summary Gate 与排序收口 | 1-2 天 | Phase 4 | P1 |
| Phase 6 | 兼容迁移、灰度与观测 | 1-2 天 | Phase 4, Phase 5 | P1 |
| Phase 7 | Recall 扩展契约决策 | 1-2 天 | Phase 4 | P2 |

---

## 阶段性构建与部署验证

除纯文档决策阶段外，Phase 1 到 Phase 6 的每个阶段完成后，都应执行一次最小构建验证；在影响运行时行为的阶段完成后，还应执行 `koduck-dev` 环境的 rollout 验证。

**阶段性验证命令:**
```bash
docker build -t koduck-memory:dev ./koduck-memory
kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev
kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s
```

**执行要求:**
1. Phase 1 到 Phase 6 至少完成 `docker build` 验证，确保 migration、Rust 编译与依赖关系未被破坏。
2. Phase 3 到 Phase 6 额外完成 `koduck-dev` rollout，验证 QueryMemory 主链路相关改动可在 dev 环境启动。
3. 若阶段改动只涉及文档或 follow-up ADR，不要求执行 rollout。

---

## Phase 1: 数据模型与 migration 基线

### Task 1.1: 建立 `memory_units` migration
**文件:**
- `koduck-memory/migrations/*.sql`

**详细要求:**
1. 新增 `memory_units` 表
2. 冻结字段语义：
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
3. 保留 `memory_kind` 字段
4. 明确 `memory_kind = NULL` 表示 `generic conversation unit`
5. V1 仅允许已物化类型：
   - `summary`
   - `fact`

**验收标准:**
- [x] migration 可执行且可回滚
- [x] `memory_kind = NULL` 的语义在 schema 注释中明确
- [x] `summary_status` 取值约束明确
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

### Task 1.2: 建立 `memory_unit_anchors` migration
**文件:**
- `koduck-memory/migrations/*.sql`

**详细要求:**
1. 新增 `memory_unit_anchors` 表
2. 冻结 `anchor_type` 闭集：
   - `domain`
   - `entity`
   - `relation`
   - `discourse_action`
   - `fact_type`
3. 建立索引：
   - `tenant_id + anchor_type + anchor_key`
   - `tenant_id + memory_unit_id`
   - `memory_unit_id + anchor_type`
4. 明确约束：
   - `fact_type` 只允许出现在 `memory_kind = fact` 的 unit 上

**验收标准:**
- [x] 锚点表可支持按 `tenant + anchor` 高频检索
- [x] `fact_type` 约束在 schema 或写入层可被验证
- [x] 不包含 `time` 倒排锚点
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

### Task 1.3: 冻结投影与回溯规则
**详细要求:**
1. 明确 `domain_class_primary` 为投影字段，不是独立真值
2. 投影算法固定为：
   - `weight DESC, anchor_key ASC`
3. 明确 `source_uri` 与 `entry_range_start/end` 的组合语义：
   - `source_uri` 始终是主回溯入口
   - 多条 entry 的完整回放依赖 `entry range`

**验收标准:**
- [x] `domain_class_primary` 的投影规则可复现
- [x] 回填、重算、迁移使用同一算法
- [x] 单 entry 与多 entry 场景的回溯规则无歧义
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

## Phase 2: Repository 与写入链路扩展

### Task 2.1: 新增 `memory_units` / `memory_unit_anchors` repository
**文件:**
- `koduck-memory/src/...`

**详细要求:**
1. 为 `memory_units` 建立 model / repository
2. 为 `memory_unit_anchors` 建立 model / repository
3. 对 repository 层字段约束做静态表达：
   - `summary_status = pending` 时允许 `summary = NULL`
   - `summary_status = ready` 时要求 `summary` 非空
   - `memory_kind = NULL` 统一解释为 `generic conversation unit`

**验收标准:**
- [x] repository 层字段语义与 ADR 一致
- [x] 不出现额外的 `memory_kind` 枚举漂移
- [x] `summary_status` 与 `summary` 的组合约束清晰
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

### Task 2.2: 建立 `memory_entry -> memory_unit` 物化规则
**详细要求:**
1. 支持单条 entry 直接形成 unit
2. 支持多条连续 entry 聚合形成 unit
3. 明确普通会话片段与物化类型的关系：
   - 普通片段可不设置 `memory_kind`
   - 物化摘要设置 `memory_kind = summary`
   - 物化事实设置 `memory_kind = fact`
4. 建立 `snippet` 生成规则：
   - 可同步生成
   - 或由 L0 / summary 派生

**验收标准:**
- [x] 单 entry / 多 entry 物化规则可复现
- [x] `memory_kind` 的写入时机一致
- [x] `snippet` 对外返回稳定可用
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

### Task 2.3: 保持 `memory_index_records` 兼容写入
**详细要求:**
1. 现阶段不删除 `memory_index_records`
2. 建立 `memory_index_records -> memory_units` 的关联字段或映射规则
3. 确保新写入链路不破坏旧读路径

**验收标准:**
- [x] 现有 `DOMAIN_FIRST` / `SUMMARY_FIRST` 路径可继续工作
- [x] 新老结构之间有稳定映射关系
- [x] 不要求一次性切换全部读路径
- [x] `docker build -t koduck-memory:dev ./koduck-memory` 成功

---

## Phase 3: Query Analyzer 与检索上下文

### Task 3.1: 新增 `query analyzer` 内部组件
**文件:**
- `koduck-memory/src/...`

**详细要求:**
1. 将 `query analyzer` 明确实现为 `QueryMemory` 的内部子组件
2. 输入固定为：
   - `query_text`
   - `domain_class`
   - `session_id`
3. 输出结构化 query context：
   - `domain_classes[]`
   - `entities[]`
   - `relation_types[]`
   - `intent_type`
   - `intent_aux[]`
   - `recall_target_type`

**验收标准:**
- [ ] `query analyzer` 不再是隐含步骤
- [ ] 输出字段与 ADR 定义一致
- [ ] analyzer 失败时存在明确回退路径
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev` 后可成功完成 rollout

---

### Task 3.2: 冻结查询侧 `intent` 与存储侧 `discourse_action`
**详细要求:**
1. 冻结查询侧 `intent_type` 主标签闭集：
   - `recall`
   - `compare`
   - `disambiguate`
   - `correct`
   - `explain`
   - `decide`
   - `none`
2. 冻结存储侧 `discourse_action` 闭集：
   - `recall_prompt`
   - `comparison`
   - `disambiguation`
   - `correction`
   - `explanation`
   - `decision`
   - `other`
3. 固化两者映射关系
4. 明确 `intent_aux[]` 的边界：
   - 不重复表达 `relation_types[]`
   - 不单独改变主召回路径

**验收标准:**
- [ ] 查询侧与存储侧语义不再混用
- [ ] `intent_score` 具备稳定映射基础
- [ ] `intent_aux[]` 不造成重复加权
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

## Phase 4: Anchor-based 检索主路径

### Task 4.1: 实现 `ANCHOR_FIRST` 服务内检索路径
**详细要求:**
1. 新增 `ANCHOR_FIRST` 服务内实现
2. 候选召回通道固定为：
   - `domain`
   - `entity`
   - `relation`
   - `session scope`
3. `time_bucket` 不进入倒排召回
4. 候选集合合并、去重并保留来源

**验收标准:**
- [ ] 支持 `memory_unit` 粒度召回
- [ ] 时间维度仅参与排序，不作为候选入口
- [ ] `ANCHOR_FIRST` 不暴露为外部 retrieve policy
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

### Task 4.2: 冻结 `match_reasons` 与输出行为
**详细要求:**
1. 冻结 `match_reasons` 闭集：
   - `domain_hit`
   - `entity_hit`
   - `relation_hit`
   - `discourse_action_hit`
   - `session_scope_hit`
   - `summary_hit`
   - `fact_hit`
   - `recency_boost`
2. `QueryMemory` 主路径继续返回 `MemoryHit`
3. `MemoryHit` 主路径不承载 recall 扩展的 batch 中间材料

**验收标准:**
- [ ] `match_reasons` 不出现开放集漂移
- [ ] 输出形态与当前 `memory.v1` 主路径兼容
- [ ] 不将 batch 中间材料塞入 `MemoryHit`
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

## Phase 5: Summary Gate 与排序收口

### Task 5.1: 收口 `SUMMARY_FIRST` 与 `summary_status`
**详细要求:**
1. `summary gate` 仅在 `summary_status = ready` 时生效
2. 当 `summary_status != ready` 时：
   - 继续沿 anchor 路径参与排序
   - 不因摘要未完成而隐藏 recent memory
3. 低质量 `summary` 不进入 `summary gate`

**验收标准:**
- [ ] recent memory 在 `pending` 状态仍可被命中
- [ ] `SUMMARY_FIRST` 仍保留负向过滤语义
- [ ] 低质量 summary 不会污染检索结果
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

### Task 5.2: 固化可解释排序
**详细要求:**
1. 实现排序信号：
   - `domain_score`
   - `entity_score`
   - `relation_score`
   - `intent_score`
   - `recency_score`
   - `salience_score`
2. 明确 `intent_score` 不重复吸收 `relation_score` 已表达的结构化关系
3. 冻结初始权重：
   - `domain 0.30`
   - `entity 0.35`
   - `relation 0.15`
   - `intent 0.05`
   - `recency 0.10`
   - `salience 0.05`

**验收标准:**
- [ ] 排序实现与 ADR 权重一致
- [ ] `intent_score` 不与 `relation_score` 双重加权
- [ ] `time_bucket` 仅通过 `recency_score` 参与排序
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

## Phase 6: 兼容迁移、灰度与观测

### Task 6.1: 建立 `DOMAIN_FIRST -> anchor path` 内部迁移
**详细要求:**
1. 保持对外 `RetrievePolicy` 不变
2. 内部允许 `DOMAIN_FIRST` 委托到 anchor path
3. 增加服务内 `ANCHOR_FIRST` feature flag
4. 支持租户级灰度

**验收标准:**
- [ ] `memory.v1` proto 不新增 retrieve policy 枚举值
- [ ] `ANCHOR_FIRST` 仅作为服务内 feature flag
- [ ] 对外 `DOMAIN_FIRST` 语义不回退
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

### Task 6.2: 增加观测与灰度指标
**详细要求:**
1. 增加结构化日志字段：
   - `retrieved_anchor_set`
   - `retrieved_scores`
   - `summary_filter_ratio`
2. 增加基础指标：
   - `anchor_precision@k`
   - `p95_query_latency_ms`
   - `recall_expanded_success_rate`
   - `recall_batch_completion_ratio`

**验收标准:**
- [ ] 能观测 anchor path 的召回来源与排序结果
- [ ] 能对比旧路径和新路径的延迟与命中质量
- [ ] recall 扩展相关指标只作为方向性观测，不作为当前契约验收前提
- [ ] `docker build -t koduck-memory:dev ./koduck-memory` 成功
- [ ] `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s` 成功

---

## Phase 7: Recall 扩展契约决策

### Task 7.1: 单独冻结 recall 扩展 contract
**详细要求:**
1. 明确 batch 级中间摘要材料的返回形态
2. 明确多轮/分批历史回顾交互的 southbound 契约
3. 决策以下问题：
   - 扩展现有 `QueryMemoryResponse`
   - 或新增 RPC
4. 明确上层 orchestration 如何消费 recall 扩展材料

**验收标准:**
- [ ] 新增 follow-up ADR
- [ ] 当前 ADR-0025 中未冻结部分被单独收口
- [ ] recall 扩展交互能力不再依赖隐式约定

---

## 建议实施顺序

1. 先完成 Phase 1、Phase 2，冻结模型与写入链路。
2. 再完成 Phase 3、Phase 4，打通最小可用 anchor-based retrieval 主路径。
3. 然后完成 Phase 5，收口 `SUMMARY_FIRST` 与排序语义。
4. 最后进入 Phase 6 做灰度与观测。
5. Phase 7 单独推进，不阻塞当前主路径落地。

## 总体验收标准

### 主路径验收

- [ ] `QueryMemory` 在不修改当前 `memory.v1` 主路径契约的前提下，可通过 anchor path 返回 `MemoryHit`
- [ ] recent memory 在 `summary_status = pending` 时仍可通过 anchors 被命中
- [ ] `domain_class_primary` 投影规则在回填、重算、迁移中保持一致
- [ ] `match_reasons` 与闭集定义一致，不出现开放集漂移

### 兼容性验收

- [ ] `DOMAIN_FIRST` 对外语义不回退
- [ ] `SUMMARY_FIRST` 仍保持负向过滤特征
- [ ] `ANCHOR_FIRST` 不暴露到 `memory.v1` 契约

### 范围验收

- [ ] 当前阶段不要求 `QueryMemory` 直接返回 batch 级中间摘要材料
- [ ] recall 扩展交互能力必须等待 follow-up contract ADR 冻结
