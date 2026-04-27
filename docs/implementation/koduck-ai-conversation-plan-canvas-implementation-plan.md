# koduck-ai 对话原生 Plan Canvas 集成实施计划

## 1. 背景与目标

`koduck-flow` 不作为独立的流程编辑、部署、运行组件接入系统，而是作为
`koduck-ai` 对话过程中的计划可视化与协作编辑层。用户在自然对话中发起任务后，
`koduck-ai` 动态创建计划，`koduck-flow` 将计划、节点状态、工具调用、产物、
memory/knowledge 修改提案可视化；用户可以在对话中修改计划、确认写入、拒绝或重跑节点。

目标是形成一个对话原生的 AI 工作流体验：

- AI 的计划创建、编辑、执行、暂停、取消、重试由 `koduck-ai` 编排。
- 计划状态、事件、产物、人工编辑痕迹由 `koduck-memory` 持久化。
- `koduck-flow` 只负责画布可视化、局部交互状态和用户编辑动作采集。
- 长期领域事实仍由 `koduck-knowledge` 管理，只有用户确认后的知识修改才写入。
- memory 与 knowledge 均支持在对话流程内通过提案方式手工编辑、确认和审计。

## 2. 核心决策

### 2.1 koduck-flow 的定位

`koduck-flow` 是 Conversation-native Plan Canvas SDK，不是独立 workflow 产品。

保留职责：

- 渲染计划画布。
- 展示节点状态、依赖关系、执行产物。
- 收集用户对节点、参数、顺序、确认动作的编辑。
- 与聊天窗口共享同一条对话事件流。

不承担职责：

- 不作为生产执行引擎。
- 不直接调用业务工具。
- 不直接写入 memory 或 knowledge。
- 不维护独立事实来源。
- 不独立部署为生产 Node 服务。

### 2.2 koduck-ai 的定位

`koduck-ai` 是计划编排与执行 owner。

职责：

- 根据用户消息动态生成 Plan。
- 调用 LLM、tool catalog、tool executor、memory client、knowledge client。
- 处理用户对计划的编辑事件。
- 决定节点是否可执行、是否需要人工确认、是否需要重新规划。
- 向前端流式发送 plan events。
- 将计划事件和快照写入 `koduck-memory`。

### 2.3 koduck-memory 的定位

`koduck-memory` 是 conversation state store。

职责：

- 保存 plan/event/artifact/proposal。
- 支持按 session 回放计划状态。
- 保存用户对 memory/knowledge 修改提案的确认、拒绝、编辑痕迹。
- 将已确认的 memory 修改应用到 memory entry/unit/fact。
- 为 `koduck-ai` 提供恢复、重放、审计查询能力。

### 2.4 koduck-knowledge 的定位

`koduck-knowledge` 继续作为长期领域知识库。

职责：

- 保存稳定、确认后的领域知识。
- 暴露查询与写入接口。
- 不保存未确认的计划过程和草稿提案。

## 3. 目标架构

```text
Chat UI
  |
  | SSE: delta / plan events / artifact events / proposal events
  v
koduck-flow Plan Canvas SDK
  |
  | 用户编辑动作：node.edit / node.retry / proposal.approve
  v
koduck-ai
  |
  +-- Plan Orchestrator
  |     - 计划生成
  |     - 计划修改
  |     - 节点调度
  |     - 暂停/恢复/取消/重试
  |
  +-- Tool Executor
  |     - market/data/strategy/backtest tools
  |     - memory tools
  |     - knowledge tools
  |
  +-- Memory Client
  |     - append plan event
  |     - load plan snapshot
  |     - save proposal
  |
  +-- Knowledge Client
        - query knowledge
        - apply approved knowledge patch

koduck-memory
  |
  +-- memory_plans
  +-- memory_plan_events
  +-- memory_plan_snapshots
  +-- memory_plan_artifacts
  +-- memory_edit_proposals

koduck-knowledge
  |
  +-- confirmed domain facts / profiles / documents
```

## 4. 领域模型

### 4.1 Plan

一次对话任务中的动态计划，生命周期绑定 `tenant_id + session_id + request_id`。

字段建议：

```text
plan_id
tenant_id
session_id
request_id
goal
status: draft | running | waiting_approval | completed | failed | cancelled
created_by
created_at
updated_at
```

### 4.2 Plan Node

计划中的一个步骤。节点既可以是工具调用，也可以是 reasoning、人工确认、
memory 修改提案或 knowledge 修改提案。

节点类型建议：

```text
llm.plan
llm.reason
tool.execute
memory.query
memory.propose_update
memory.apply_update
knowledge.query
knowledge.propose_edit
knowledge.apply_edit
human.approval
human.edit
artifact.render
```

节点状态建议：

```text
pending
running
waiting_approval
completed
failed
skipped
cancelled
```

### 4.3 Artifact

节点产物，包括工具结果、图表、分析摘要、memory patch、knowledge patch 等。

字段建议：

```text
artifact_id
tenant_id
session_id
plan_id
node_id
artifact_type
content_json
object_uri
created_at
```

### 4.4 Proposal

对 memory 或 knowledge 的修改提案。提案默认不直接应用，必须经过用户确认。

字段建议：

```text
proposal_id
tenant_id
session_id
plan_id
node_id
target_kind: memory | knowledge
operation: append | update | delete | merge
target_ref
before_json
after_json
reason
confidence
status: proposed | approved | rejected | edited | applied
created_by
reviewed_by
created_at
reviewed_at
applied_at
```

## 5. koduck-memory 数据模型

第一阶段建议采用事件溯源 + 快照模型，减少表结构对画布形态的耦合。

### 5.1 memory_plans

```sql
CREATE TABLE memory_plans (
    plan_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.2 memory_plan_events

```sql
CREATE TABLE memory_plan_events (
    event_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id),
    sequence_num BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, session_id, plan_id, sequence_num)
);
```

### 5.3 memory_plan_snapshots

```sql
CREATE TABLE memory_plan_snapshots (
    snapshot_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id),
    version BIGINT NOT NULL,
    state_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, session_id, plan_id, version)
);
```

### 5.4 memory_plan_artifacts

```sql
CREATE TABLE memory_plan_artifacts (
    artifact_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id),
    node_id TEXT,
    artifact_type TEXT NOT NULL,
    content_json JSONB,
    object_uri TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.5 memory_edit_proposals

```sql
CREATE TABLE memory_edit_proposals (
    proposal_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    plan_id UUID NOT NULL REFERENCES memory_plans(plan_id),
    node_id TEXT,
    target_kind TEXT NOT NULL,
    operation TEXT NOT NULL,
    target_ref TEXT,
    before_json JSONB,
    after_json JSONB NOT NULL,
    reason TEXT,
    confidence NUMERIC(5, 4),
    status TEXT NOT NULL,
    created_by TEXT,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ
);
```

## 6. koduck-ai API 与事件设计

### 6.1 对话请求扩展

`ChatRequest.metadata` 可扩展以下字段：

```json
{
  "planMode": "auto | collaborative | manual",
  "enablePlanCanvas": true,
  "requiresApprovalFor": ["memory_write", "knowledge_write", "trade_execute"]
}
```

默认使用 `collaborative`：

- 普通查询和分析节点可自动执行。
- memory/knowledge 写入需要用户确认。
- 交易、下单、生产变更类动作必须显式确认。

### 6.2 用户编辑事件入口

新增接口：

```text
POST /api/ai/sessions/{sessionId}/plans/{planId}/events
```

请求示例：

```json
{
  "type": "node.edit",
  "nodeId": "query_northbound_flow",
  "patch": {
    "arguments": {
      "source": "northbound",
      "lookbackDays": 20
    }
  },
  "actor": "user"
}
```

常见用户事件：

```text
plan.pause
plan.resume
plan.cancel
node.edit
node.insert
node.delete
node.retry
node.skip
proposal.approve
proposal.reject
proposal.edit_and_approve
```

### 6.3 SSE 事件扩展

现有 `delta`、`done`、`error` 保持兼容，新增计划事件：

```text
plan.created
plan.updated
plan.node.added
plan.node.updated
plan.node.started
plan.node.completed
plan.node.failed
plan.node.waiting_approval
plan.patch.proposed
plan.patch.applied
artifact.created
memory.patch.proposed
memory.patch.applied
knowledge.patch.proposed
knowledge.patch.applied
```

事件 payload 示例：

```json
{
  "planId": "8e9c3f7e-6e49-4d61-a85d-6eb9a2da56b1",
  "nodeId": "fetch_market_data",
  "status": "completed",
  "title": "拉取近期 K 线",
  "resultArtifactId": "b7a8a1d5-9a75-4be6-961a-d62f11d56c51"
}
```

## 7. 服务内模块拆分

### 7.1 koduck-ai

新增模块建议：

```text
koduck-ai/src/plan/
  mod.rs
  model.rs
  orchestrator.rs
  event.rs
  node.rs
  proposal.rs
  renderer.rs
```

职责：

- `model.rs`: Plan、PlanNode、PlanEvent、Artifact、Proposal 数据结构。
- `orchestrator.rs`: 计划生成、执行、暂停、恢复、取消、重试。
- `event.rs`: SSE 事件构造与 memory 持久化适配。
- `node.rs`: 节点类型、状态机、执行策略。
- `proposal.rs`: memory/knowledge 修改提案处理。
- `renderer.rs`: 将内部 plan state 转换为前端画布结构。

### 7.2 koduck-memory

新增模块建议：

```text
koduck-memory/src/plan/
  mod.rs
  model.rs
  repository.rs
  service.rs
  proposal.rs
```

职责：

- 保存 Plan 元数据。
- 追加 PlanEvent。
- 生成和读取 PlanSnapshot。
- 保存 Artifact。
- 保存、审核、应用 Proposal。

### 7.3 koduck-flow

调整方向：

```text
koduck-flow/src/conversation-plan/
  PlanCanvas.tsx
  PlanEventAdapter.ts
  PlanEditController.ts
  types.ts
```

职责：

- 订阅 `koduck-ai` SSE plan events。
- 根据事件更新画布状态。
- 将用户编辑动作转换为 plan event API 请求。
- 展示 proposal diff 与确认控件。

## 8. 执行阶段

### Phase 0: ADR 与边界冻结

目标：形成团队共识，避免 `koduck-flow` 再被设计成独立 workflow 产品。

任务：

- 新增 ADR：`docs/adr/0003-conversation-native-plan-canvas.md`。
- 明确 `koduck-ai`、`koduck-memory`、`koduck-flow`、`koduck-knowledge` 边界。
- 明确 memory/knowledge 写入必须走 proposal + confirmation。

验收：

- ADR 合并。
- 本文档成为后续 issue 拆分依据。

### Phase 1: koduck-memory Plan Store

目标：让计划事件可持久化、可恢复。

任务：

- 新增数据库迁移：
  - `memory_plans`
  - `memory_plan_events`
  - `memory_plan_snapshots`
  - `memory_plan_artifacts`
  - `memory_edit_proposals`
- 新增 `koduck-memory/src/plan/` 模块。
- 提供内部 API：
  - create plan
  - append event
  - list events
  - save snapshot
  - get latest snapshot
  - save artifact
  - create/review proposal
- 增加 repository 与 service 单元测试。

验收：

- 能按 `tenant_id + session_id + plan_id` 回放事件。
- 能保存和读取最新 snapshot。
- proposal 状态流转测试通过。

### Phase 2: koduck-ai Plan Orchestrator MVP

目标：在对话流中创建和执行最小计划。

任务：

- 新增 `koduck-ai/src/plan/` 模块。
- 在 chat/stream pipeline 中支持 `enablePlanCanvas`。
- 当用户请求复杂任务时创建 Plan。
- 支持最小节点类型：
  - `llm.plan`
  - `tool.execute`
  - `memory.query`
  - `knowledge.query`
  - `human.approval`
- 将 plan events 同时：
  - 发送到 SSE。
  - 写入 `koduck-memory`。
- 支持节点状态：
  - pending
  - running
  - completed
  - failed
  - waiting_approval

验收：

- 一次复杂对话能产生 `plan.created`、`plan.node.*` 事件。
- 前端即使断线，也能从 memory 恢复 plan event。
- 普通聊天在未开启 Plan Canvas 时保持兼容。

### Phase 3: koduck-flow 对话画布

目标：让计划在聊天界面中自然可见。

任务：

- 新增 Plan Canvas 组件。
- 接入 `koduck-ai` SSE plan events。
- 支持节点状态展示。
- 支持 artifact 展示。
- 支持用户编辑动作：
  - 修改节点参数。
  - 重跑节点。
  - 跳过节点。
  - 暂停/恢复计划。
- 将用户动作发送到 `koduck-ai` plan event API。

验收：

- 聊天过程中画布自动展开并更新。
- 用户修改节点参数后，`koduck-ai` 能收到并更新计划。
- 画布刷新后能从 snapshot/event 恢复状态。

### Phase 4: Memory Proposal

目标：支持对话内手工编辑 memory。

任务：

- `koduck-ai` 支持生成 `memory.patch.proposed`。
- `koduck-flow` 展示 before/after diff。
- 用户可 approve/reject/edit_and_approve。
- `koduck-memory` 记录 proposal 审核结果。
- approved proposal 应用到 memory entry/unit/fact。

验收：

- AI 不能静默写入长期 memory。
- 用户确认后 memory 修改可查询。
- 拒绝和编辑记录可审计。

### Phase 5: Knowledge Proposal

目标：支持对话内手工编辑 knowledge。

任务：

- `koduck-ai` 支持生成 `knowledge.patch.proposed`。
- `koduck-flow` 展示知识修改 diff 与来源。
- 用户确认后由 `koduck-ai` 调用 `koduck-knowledge` 写入。
- `koduck-memory` 保存 proposal 审核与应用记录。
- `koduck-knowledge` 保持长期事实 owner。

验收：

- 未确认的知识修改不会进入 `koduck-knowledge`。
- 确认后的知识修改可在 `koduck-knowledge` 查询。
- memory 中保留完整 proposal 审计链路。

### Phase 6: 高级执行控制

目标：让计划执行具备生产可用的控制能力。

任务：

- 支持 plan pause/resume/cancel。
- 支持 node retry/skip。
- 支持从指定节点重跑。
- 支持超时、幂等 key、失败恢复。
- 支持高风险节点强制人工确认。
- 支持计划快照压缩与过期策略。

验收：

- 取消后不会继续执行后续工具。
- 重试不会重复污染 memory/knowledge。
- 高风险操作必须人工确认。

## 9. 权限与安全

必须满足：

- 所有 plan API 校验 `tenant_id`、`session_id`、`user_id`。
- 用户只能编辑自己有权限访问的 plan。
- memory/knowledge 写入必须记录 actor。
- knowledge 写入必须经过 proposal approval。
- 交易、下单、生产变更类 tool 必须强制 human approval。
- plan event payload 不得包含明文密钥、token、密码。

## 10. 观测与审计

建议指标：

```text
ai_plan_created_total
ai_plan_node_completed_total
ai_plan_node_failed_total
ai_plan_waiting_approval_total
ai_plan_proposal_approved_total
ai_plan_proposal_rejected_total
ai_plan_replay_latency_ms
```

日志必须包含：

```text
request_id
session_id
tenant_id
plan_id
node_id
trace_id
event_type
```

审计要求：

- 每次用户编辑计划都写入 `memory_plan_events`。
- 每次 proposal 审核都写入 `memory_edit_proposals`。
- 每次 knowledge 应用都保留 memory proposal 反向引用。

## 11. 测试策略

### koduck-memory

- repository 测试：
  - create plan
  - append event
  - replay events
  - save/get snapshot
  - proposal 状态流转
- 幂等测试：
  - 重复 event sequence 拒绝或安全处理。
  - 重复 approval 不重复应用。

### koduck-ai

- plan orchestration 单元测试：
  - 复杂请求创建 plan。
  - 节点执行状态正确。
  - tool failed 后产生 failed event。
  - waiting approval 阻断后续高风险节点。
- stream 测试：
  - SSE 正确输出 plan events。
  - 普通 delta/done 兼容。

### koduck-flow

- 组件测试：
  - plan events 正确渲染为节点和边。
  - proposal diff 正确展示。
  - 用户编辑动作正确提交。
- E2E：
  - 对话触发计划。
  - 修改节点参数。
  - approve memory patch。
  - 刷新页面后恢复画布。

## 12. Issue 拆分建议

建议按以下 issue 创建：

1. `docs(ai): add conversation-native plan canvas ADR`
2. `feat(memory): add plan event store schema`
3. `feat(memory): implement plan repository and service`
4. `feat(ai): add plan event model and SSE event types`
5. `feat(ai): create plan orchestrator MVP`
6. `feat(ai): persist plan events to memory`
7. `feat(flow): render conversation plan canvas from SSE events`
8. `feat(flow): send user plan edit events to koduck-ai`
9. `feat(memory): add edit proposal store`
10. `feat(ai): support memory patch proposal workflow`
11. `feat(ai): support knowledge patch proposal workflow`
12. `feat(flow): add proposal diff and approval UI`
13. `test(e2e): cover conversation plan canvas happy path`

## 13. 非目标

第一阶段不做：

- 独立 workflow 部署服务。
- 面向业务用户的通用流程产品。
- 定时任务编排平台。
- 生产交易自动执行。
- 无确认的 memory/knowledge 自动写入。
- 完整 BPMN/低代码引擎。

## 14. 最小可用闭环

MVP 完成标准：

```text
用户在聊天中提出复杂任务
  -> koduck-ai 创建 plan
  -> 前端自动显示 flow 画布
  -> koduck-ai 执行查询/分析节点
  -> 节点状态实时更新
  -> AI 提出 memory 或 knowledge 修改
  -> 用户在画布中确认或编辑
  -> 确认结果写入 memory，必要时写入 knowledge
  -> 刷新页面后计划和审计可恢复
```

## 15. 总结

本方案将 `koduck-flow` 从独立 workflow 组件调整为 `koduck-ai` 的对话原生计划画布。
计划事实来源放在 `koduck-memory`，执行编排放在 `koduck-ai`，长期知识事实放在
`koduck-knowledge`。这样可以让 AI 的计划、执行、证据、记忆修改和知识沉淀都留在同一条
对话脉络中，同时避免流程组件、记忆系统和知识库职责混淆。
