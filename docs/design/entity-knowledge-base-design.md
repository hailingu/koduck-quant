# koduck-knowledge 设计（Fact-First + Contextual Reasoning）

## 1. 背景与目标

本设计用于承接 `koduck-knowledge` 独立项目的“实体知识”能力。当前阶段核心目标：

- 先落地“人和 domain 的关联”最小闭环能力。
- 强制实体标准化（Entity Linking），形成可追踪的隐式知识链/网。
- 通过“工具抽取 + LLM 校验 + 人工审核”三道闸门，保证入库质量。

## 2. 关键结论（来自讨论）

1. 该能力作为独立知识库能力建设。
2. 先排除向量数据库方案。
3. 先排除 PHP 技术栈方案。
4. 不采用“静态图谱边 + 单一 weight”作为主模型。
5. 长期策略：**存事实，不存最终关系结论**；关系强弱按查询上下文动态推理（当前阶段暂不实现）。
6. 数据存储采用**独立 PostgreSQL 库**（与业务库隔离），用于承载知识库结构化数据。

## 3. 为什么不采用静态关系边权重

单一边权无法表达时序波动，例如：

- A-B 在 1 月强关联
- 2 月弱关联
- 3 月再次强关联

因此不能仅依赖 `(A,B,weight)` 静态边模型。关系强度必须由“事实 + 时间窗 + 方面 + 当前上下文”动态计算。

## 4. 总体架构

- **Knowledge Base（主存）**：独立 PostgreSQL 库 + S3（实体资料）
- **Reasoner（查询层）**：按上下文实时筛选实体信息

## 5. 数据模型（当前范围）

### 5.1 实体基础信息表：`entity_basic_profile`

用途：先建立“人和 domain 的关联”主入口，用于实体召回、候选过滤与上下文初筛。

建议字段：

- `entity_id`（实体 ID）
- `entity_name`（实体名，原始展示名）
- `domain_class`（所属领域）
- `valid_from`（属于该 domain 的起始时间）
- `valid_to`（属于该 domain 的终止时间，可空）
- `basic_profile_entry_id`（基础信息 entry 类型 ID）
- `basic_profile_s3_uri`（基础信息内容 URI）

### 5.2 实体详情分片表：`entity_profile`

用途：承载实体多维详情（传记、荣誉、定义等）。

建议字段：

- `entity_id`
- `profile_entry_id`（entry 类型 ID）
- `profile_s3_uri`（S3 JSON）

约束建议：

- 主键使用 `(entity_id, profile_entry_id)` 复合键。

示例（姚明）：

- `(entity_id=1, profile_entry_id=1, s3://.../biographic.json)`
- `(entity_id=1, profile_entry_id=2, s3://.../honor.json)`

### 5.3 暂缓项：事实表（`fact_store`）

当前阶段先不考虑 `5.3`，不进入实现范围。

当前仅保留“人和 domain 关联”能力，后续如需事实层，再单独设计和落地。

## 6. 实体标准化（必须项）

不仅查询时要用 `entity_id`，写入阶段也必须标准化：

- 原文保留：`raw_text`
- 标准化文本：`normalized_text`（例如 `姚明 -> [姚明](entity:1)`）
- mention 明细：记录 span、surface、`entity_id`、置信度

效果：

- 同名异写归一
- 全链路可追踪
- 隐式关系链/网自然形成

## 7. 查询链路（Contextual Reasoning）

1. 用 `entity_name + domain_class + 时间窗` 查询 `entity_basic_profile` 召回候选。
2. 读取 `basic_profile_s3_uri` 做上下文过滤，确定最可信 `entity_id`。
3. 若需细节，按 `entity_id` 查询 `entity_profile`。
4. 当前阶段仅做“人和 domain”关联检索，事实关联推理暂不纳入实现范围。

## 8. 入库治理与审核闸门

### 8.1 原则

- 工具只能写“候选区”，不能直写正式知识表。
- 正式入库必须经过 LLM 判定 + 人工 review。

### 8.2 建议流程

1. `ingest_candidate`：工具抽取写入候选表。
2. `llm_verify`：校验事实一致性、实体对齐、证据可追溯性。
3. `human_review`：人工确认通过/驳回/退回。
4. `publish`：仅 `approved` 数据写入正式库。
5. `audit_log`：全链路审计（人、模型、时间、证据、版本）。

### 8.3 强约束

- 正式库禁直写（仅 publish 服务账号可写）。
- 候选记录追加式版本化，不覆盖历史。
- 每条已发布知识必须可回溯到证据 URI 与审核记录。

## 9. 现阶段实施建议（MVP）

1. 先落独立 PostgreSQL 库主模型（`entity_basic_profile` / `entity_profile`）。
2. 建立标准化写入链（mention 抽取 + entity linking + normalized_text）。
3. 上线审核闸门（candidate -> llm_verify -> human_review -> publish）。
4. 查询侧先实现“候选召回 + 上下文筛选（围绕人和 domain）”。

---

该设计遵循“事实优先、上下文推理、可审计发布”的原则，优先解决准确性与可治理性，再逐步优化性能与自动化。
