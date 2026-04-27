# koduck-ai 对话原生 Plan Canvas 实施任务清单

> 本文档基于
> [koduck-ai-conversation-plan-canvas-implementation-plan.md](./koduck-ai-conversation-plan-canvas-implementation-plan.md)
> 拆分，提供可直接创建 Issue、分支和验收的任务列表。
>
> **状态**: 待执行
> **创建日期**: 2026-04-26
> **对应实施计划**:
> [koduck-ai-conversation-plan-canvas-implementation-plan.md](./koduck-ai-conversation-plan-canvas-implementation-plan.md)

## 执行阶段概览

| 阶段 | 名称 | 主要落点 | 依赖 | 优先级 |
|------|------|----------|------|--------|
| Phase 0 | ADR 与边界冻结 | `docs/adr/`, `docs/implementation/` | - | P0 |
| Phase 1 | koduck-memory Plan Store | `koduck-memory` | Phase 0 | P0 |
| Phase 2 | koduck-ai Plan Orchestrator MVP | `koduck-ai` | Phase 1 | P0 |
| Phase 3 | koduck-flow 对话画布 | `koduck-flow` | Phase 2 | P0 |
| Phase 4 | Memory Proposal | `koduck-ai`, `koduck-memory`, `koduck-flow` | Phase 1, 2, 3 | P1 |
| Phase 5 | Knowledge Proposal | `koduck-ai`, `koduck-memory`, `koduck-flow`, `koduck-knowledge` | Phase 4 | P1 |
| Phase 6 | 高级执行控制与治理 | `koduck-ai`, `koduck-memory`, `koduck-flow` | Phase 2-5 | P1 |

## Phase 0: ADR 与边界冻结

目标：冻结 Conversation-native Plan Canvas 的系统边界，避免 `koduck-flow` 被实现成独立 workflow 产品。

### Task 0.1: 新增对话原生 Plan Canvas ADR

**建议 Issue:** `docs(ai): add conversation-native plan canvas ADR`

**文件:**

- `docs/adr/0003-conversation-native-plan-canvas.md`
- `docs/implementation/koduck-ai-conversation-plan-canvas-implementation-plan.md`

**详细要求:**

1. 说明 `koduck-flow` 是 Plan Canvas SDK，不是独立执行引擎。
2. 明确 `koduck-ai` 是计划编排与执行 owner。
3. 明确 `koduck-memory` 是 plan/event/artifact/proposal 的 conversation state store。
4. 明确 `koduck-knowledge` 只保存用户确认后的长期领域知识。
5. 明确 memory/knowledge 写入必须经过 proposal + confirmation。

**验收标准:**

- [ ] ADR 已合并并可从实施计划引用。
- [ ] ADR 覆盖职责边界、写入确认、安全约束与非目标。
- [ ] 后续 Issue 拆分以该 ADR 和实施计划为依据。

## Phase 1: koduck-memory Plan Store

目标：让计划事件可持久化、可恢复、可审计。

### Task 1.1: 新增 Plan Store 数据库迁移

**建议 Issue:** `feat(memory): add plan event store schema`

**文件:**

- `koduck-memory/migrations/*.sql`

**详细要求:**

1. 新增 `memory_plans`。
2. 新增 `memory_plan_events`，支持 `tenant_id + session_id + plan_id + sequence_num` 唯一约束。
3. 新增 `memory_plan_snapshots`，支持按版本读取快照。
4. 新增 `memory_plan_artifacts`。
5. 新增 `memory_edit_proposals`。
6. 为常用查询建立索引：`tenant_id/session_id/plan_id`、`created_at`、proposal `status`。

**验收标准:**

- [ ] migration 可在空库成功执行。
- [ ] 重复 event sequence 被唯一约束拦截。
- [ ] schema 字段覆盖实施计划第 5 节定义。

### Task 1.2: 实现 Plan Repository

**建议 Issue:** `feat(memory): implement plan repository and service`

**文件:**

- `koduck-memory/src/plan/model.*`
- `koduck-memory/src/plan/repository.*`

**详细要求:**

1. 实现 Plan、PlanEvent、PlanSnapshot、PlanArtifact、EditProposal 模型。
2. 实现 `create_plan`。
3. 实现 `append_event`。
4. 实现 `list_events`，支持按 sequence 顺序回放。
5. 实现 `save_snapshot` 与 `get_latest_snapshot`。
6. 实现 `save_artifact`。
7. 实现 `create_proposal` 与 `review_proposal` 的基础持久化。

**验收标准:**

- [ ] 能按 `tenant_id + session_id + plan_id` 回放事件。
- [ ] 能保存和读取最新 snapshot。
- [ ] artifact 可按 `plan_id/node_id` 关联查询。
- [ ] repository 测试覆盖成功与唯一约束失败路径。

### Task 1.3: 实现 Plan Service 与内部 API

**建议 Issue:** `feat(memory): expose plan store internal api`

**文件:**

- `koduck-memory/src/plan/service.*`
- `koduck-memory/src/plan/proposal.*`
- `koduck-memory/proto/**` 或现有内部 API 契约文件

**详细要求:**

1. 封装 repository，提供 create plan / append event / replay events API。
2. 提供 save snapshot / get latest snapshot API。
3. 提供 save artifact API。
4. 提供 create/review proposal API。
5. 所有写入 API 校验 `tenant_id`、`session_id`、`request_id` 与 `idempotency_key`。

**验收标准:**

- [ ] 内部 API 可被 `koduck-ai` client 调用。
- [ ] proposal 状态流转测试通过。
- [ ] 重复 approval 不会重复应用。

## Phase 2: koduck-ai Plan Orchestrator MVP

目标：在 chat/stream 主链路中创建、执行和持久化最小计划。

### Task 2.1: 定义 Plan 领域模型与 SSE 事件类型

**建议 Issue:** `feat(ai): add plan event model and SSE event types`

**文件:**

- `koduck-ai/src/plan/model.*`
- `koduck-ai/src/plan/event.*`
- `koduck-ai/src/plan/node.*`
- `koduck-ai/src/plan/proposal.*`
- `koduck-ai/src/plan/renderer.*`

**详细要求:**

1. 定义 Plan、PlanNode、PlanEvent、Artifact、Proposal。
2. 支持节点类型：`llm.plan`、`tool.execute`、`memory.query`、`knowledge.query`、`human.approval`。
3. 支持节点状态：`pending`、`running`、`completed`、`failed`、`waiting_approval`。
4. 定义 SSE plan events：`plan.created`、`plan.node.*`、`artifact.created`、`memory.patch.*`、`knowledge.patch.*`。
5. 保持现有 `delta`、`done`、`error` 兼容。

**验收标准:**

- [ ] plan event 可序列化为 SSE payload。
- [ ] 普通聊天事件格式不变。
- [ ] 模型字段覆盖 plan 文档第 4 节和第 6.3 节。

### Task 2.2: 实现 Plan Orchestrator MVP

**建议 Issue:** `feat(ai): create plan orchestrator MVP`

**文件:**

- `koduck-ai/src/plan/orchestrator.*`
- `koduck-ai/src/orchestrator/**`

**详细要求:**

1. 在 chat/stream pipeline 中识别 `enablePlanCanvas`。
2. `planMode` 默认使用 `collaborative`。
3. 对复杂任务创建 Plan。
4. 按节点依赖执行最小计划。
5. 高风险或写入类节点进入 `waiting_approval`。
6. 节点失败时产生 `plan.node.failed`。

**验收标准:**

- [ ] 一次复杂对话能产生 `plan.created` 与 `plan.node.*` 事件。
- [ ] 普通聊天在未开启 Plan Canvas 时保持兼容。
- [ ] `waiting_approval` 会阻断后续依赖节点。

### Task 2.3: 持久化 Plan Events 到 koduck-memory

**建议 Issue:** `feat(ai): persist plan events to memory`

**文件:**

- `koduck-ai/src/plan/event.*`
- `koduck-ai/src/clients/memory/**`

**详细要求:**

1. 为每个 plan event 分配单调递增 `sequence_num`。
2. 将 `plan.created`、`plan.node.*`、`artifact.created` 写入 `koduck-memory`。
3. 失败时按既有 memory fail-open 策略处理，不中断普通聊天主链路。
4. 支持从 memory snapshot/events 恢复 Plan State。

**验收标准:**

- [ ] 前端断线后可通过 memory 回放 plan events。
- [ ] plan event 写入包含 `tenant_id/session_id/request_id/trace_id`。
- [ ] memory 写入失败有结构化日志与指标。

### Task 2.4: 新增用户编辑事件 API

**建议 Issue:** `feat(ai): add plan edit event api`

**接口:**

- `POST /api/ai/sessions/{sessionId}/plans/{planId}/events`

**详细要求:**

1. 支持 `plan.pause`、`plan.resume`、`plan.cancel`。
2. 支持 `node.edit`、`node.retry`、`node.skip`。
3. 支持 `proposal.approve`、`proposal.reject`、`proposal.edit_and_approve` 的入口占位。
4. 校验 `tenant_id`、`session_id`、`user_id` 与 plan 权限。
5. 用户编辑动作写入 `memory_plan_events`。

**验收标准:**

- [ ] 无权限用户不能编辑 plan。
- [ ] 用户编辑事件可被 orchestrator 消费并更新 plan state。
- [ ] 每次用户编辑都有审计事件。

## Phase 3: koduck-flow 对话画布

目标：让计划在聊天界面中自然可见、可恢复、可编辑。

### Task 3.1: 新增 Conversation Plan Canvas 组件

**建议 Issue:** `feat(flow): render conversation plan canvas from SSE events`

**文件:**

- `koduck-flow/src/conversation-plan/PlanCanvas.tsx`
- `koduck-flow/src/conversation-plan/types.ts`
- `koduck-flow/src/conversation-plan/PlanEventAdapter.ts`

**详细要求:**

1. 根据 SSE plan events 渲染节点和依赖边。
2. 展示节点状态、标题、执行结果摘要。
3. 展示 artifact 入口。
4. 支持从 snapshot/events 初始化画布状态。

**验收标准:**

- [ ] 聊天过程中画布自动展开并更新。
- [ ] 刷新页面后能恢复画布。
- [ ] plan event 到节点/边的转换有组件或单元测试覆盖。

### Task 3.2: 实现用户计划编辑控制器

**建议 Issue:** `feat(flow): send user plan edit events to koduck-ai`

**文件:**

- `koduck-flow/src/conversation-plan/PlanEditController.ts`
- `koduck-flow/src/conversation-plan/PlanCanvas.tsx`

**详细要求:**

1. 支持修改节点参数。
2. 支持重跑节点。
3. 支持跳过节点。
4. 支持暂停、恢复、取消计划。
5. 将用户动作转换为 `koduck-ai` plan event API 请求。

**验收标准:**

- [ ] 用户修改节点参数后，`koduck-ai` 能收到并更新计划。
- [ ] pause/cancel 后 UI 状态与后端状态一致。
- [ ] 失败请求有可感知的错误状态。

### Task 3.3: 展示 Artifact 与节点结果

**建议 Issue:** `feat(flow): display plan node artifacts`

**文件:**

- `koduck-flow/src/conversation-plan/**`

**详细要求:**

1. 支持工具结果、图表、分析摘要、memory patch、knowledge patch 的基础展示。
2. 大对象使用 `object_uri` 懒加载。
3. artifact 不展示明文密钥、token、密码。

**验收标准:**

- [ ] `artifact.created` 事件能在对应节点中展示。
- [ ] 空 artifact、加载失败和权限失败状态可处理。
- [ ] 敏感字段不会在 UI 中直接展示。

## Phase 4: Memory Proposal

目标：支持对话内手工编辑、确认和审计 memory 修改。

### Task 4.1: 实现 Memory Proposal Store 与状态流转

**建议 Issue:** `feat(memory): add edit proposal store`

**文件:**

- `koduck-memory/src/plan/proposal.*`
- `koduck-memory/src/plan/service.*`

**详细要求:**

1. 支持 proposal 状态：`proposed`、`approved`、`rejected`、`edited`、`applied`。
2. 记录 `before_json`、`after_json`、`reason`、`confidence`。
3. 记录 `created_by`、`reviewed_by`、`reviewed_at`、`applied_at`。
4. 防止重复 approval 重复应用。

**验收标准:**

- [ ] approve/reject/edit_and_approve 状态流转测试通过。
- [ ] proposal 审核记录可审计。
- [ ] 幂等重复请求不会重复应用。

### Task 4.2: koduck-ai 支持 Memory Patch Proposal Workflow

**建议 Issue:** `feat(ai): support memory patch proposal workflow`

**文件:**

- `koduck-ai/src/plan/proposal.*`
- `koduck-ai/src/plan/orchestrator.*`
- `koduck-ai/src/clients/memory/**`

**详细要求:**

1. 对 memory 写入生成 `memory.patch.proposed`，默认不直接应用。
2. 用户 approve 后调用 memory apply/update 能力。
3. 用户 reject 后记录审核结果并终止写入。
4. 用户 edit_and_approve 后用编辑后的 patch 应用。

**验收标准:**

- [ ] AI 不能静默写入长期 memory。
- [ ] 用户确认后 memory 修改可查询。
- [ ] 拒绝和编辑记录可审计。

### Task 4.3: koduck-flow 展示 Memory Proposal Diff

**建议 Issue:** `feat(flow): add proposal diff and approval UI`

**文件:**

- `koduck-flow/src/conversation-plan/**`

**详细要求:**

1. 展示 memory proposal before/after diff。
2. 提供 approve、reject、edit_and_approve 操作。
3. 审核后更新 proposal 状态。

**验收标准:**

- [ ] 用户可在画布中确认、拒绝或编辑 memory patch。
- [ ] 审核动作提交到 `koduck-ai` plan event API。
- [ ] 审核结果刷新后仍可恢复。

## Phase 5: Knowledge Proposal

目标：支持对话内手工编辑、确认和审计 knowledge 修改。

### Task 5.1: koduck-ai 支持 Knowledge Patch Proposal Workflow

**建议 Issue:** `feat(ai): support knowledge patch proposal workflow`

**文件:**

- `koduck-ai/src/plan/proposal.*`
- `koduck-ai/src/clients/knowledge/**`

**详细要求:**

1. 对 knowledge 写入生成 `knowledge.patch.proposed`，默认不直接应用。
2. proposal 中记录来源、目标对象、before/after 与 reason。
3. 用户确认后由 `koduck-ai` 调用 `koduck-knowledge` 写入。
4. 写入完成后回写 proposal `applied` 状态到 `koduck-memory`。

**验收标准:**

- [ ] 未确认的知识修改不会进入 `koduck-knowledge`。
- [ ] 确认后的知识修改可在 `koduck-knowledge` 查询。
- [ ] memory 中保留完整 proposal 审计链路。

### Task 5.2: koduck-flow 展示 Knowledge Proposal Diff

**建议 Issue:** `feat(flow): add knowledge proposal diff UI`

**文件:**

- `koduck-flow/src/conversation-plan/**`

**详细要求:**

1. 展示 knowledge proposal diff 与来源。
2. 提供 approve、reject、edit_and_approve 操作。
3. 明确展示未确认状态，避免用户误以为已写入 knowledge。

**验收标准:**

- [ ] 用户可审核 knowledge patch。
- [ ] 审核结果可从 memory 恢复。
- [ ] 未确认 proposal 不展示为已生效知识。

## Phase 6: 高级执行控制与治理

目标：让计划执行具备生产可用的控制、幂等、安全和观测能力。

### Task 6.1: 实现 Pause/Resume/Cancel 与 Node Retry/Skip

**建议 Issue:** `feat(ai): add plan execution controls`

**文件:**

- `koduck-ai/src/plan/orchestrator.*`
- `koduck-ai/src/plan/node.*`

**详细要求:**

1. 支持 plan pause/resume/cancel。
2. 支持 node retry/skip。
3. 支持从指定节点重跑。
4. cancel 后停止后续工具执行。
5. retry 使用幂等 key 防止重复污染 memory/knowledge。

**验收标准:**

- [ ] 取消后不会继续执行后续工具。
- [ ] 重试不会重复写入 memory/knowledge。
- [ ] 从指定节点重跑后状态与事件序列一致。

### Task 6.2: 强化高风险节点人工确认

**建议 Issue:** `feat(ai): enforce human approval for high risk plan nodes`

**文件:**

- `koduck-ai/src/plan/node.*`
- `koduck-ai/src/plan/orchestrator.*`

**详细要求:**

1. 对 memory 写、knowledge 写、交易、下单、生产变更类工具强制 `human.approval`。
2. `requiresApprovalFor` 支持请求级扩展。
3. 未确认时节点停留在 `waiting_approval`。

**验收标准:**

- [ ] 高风险操作必须人工确认。
- [ ] 绕过确认的请求会被拒绝。
- [ ] 审批 actor 与时间可审计。

### Task 6.3: 快照压缩、过期策略与恢复性能

**建议 Issue:** `feat(memory): add plan snapshot compaction and retention`

**文件:**

- `koduck-memory/src/plan/service.*`
- `koduck-memory/src/plan/repository.*`

**详细要求:**

1. 支持按事件数量或时间间隔生成 snapshot。
2. 支持旧 snapshot 和 artifact 的 retention 策略。
3. 支持 replay latency 指标。

**验收标准:**

- [ ] 长对话恢复不需要全量回放所有事件。
- [ ] 过期策略不会删除仍被最新 snapshot 引用的必要 artifact。
- [ ] `ai_plan_replay_latency_ms` 可观测。

### Task 6.4: 观测、审计与安全基线

**建议 Issue:** `feat(ai): add plan canvas observability and audit baseline`

**文件:**

- `koduck-ai/src/observe/**`
- `koduck-memory/src/plan/**`
- `koduck-flow/src/conversation-plan/**`

**详细要求:**

1. 增加指标：
   - `ai_plan_created_total`
   - `ai_plan_node_completed_total`
   - `ai_plan_node_failed_total`
   - `ai_plan_waiting_approval_total`
   - `ai_plan_proposal_approved_total`
   - `ai_plan_proposal_rejected_total`
   - `ai_plan_replay_latency_ms`
2. 结构化日志包含 `request_id/session_id/tenant_id/plan_id/node_id/trace_id/event_type`。
3. plan event payload 不得包含明文密钥、token、密码。
4. 所有 plan API 校验 `tenant_id/session_id/user_id`。

**验收标准:**

- [ ] 指标可被现有观测栈采集。
- [ ] 日志字段完整且不暴露敏感信息。
- [ ] 越权访问 plan API 被拒绝。

## E2E 与发布验收

### Task 7.1: 覆盖 Conversation Plan Canvas Happy Path

**建议 Issue:** `test(e2e): cover conversation plan canvas happy path`

**详细要求:**

1. 对话触发复杂计划。
2. 前端显示 Plan Canvas。
3. 节点状态随 SSE 更新。
4. 用户修改节点参数。
5. 用户 approve memory patch。
6. 刷新页面后恢复画布与审核状态。

**验收标准:**

- [ ] E2E 测试稳定通过。
- [ ] plan/event/proposal 均可在 memory 中查询。
- [ ] 普通 chat regression 通过。

### Task 7.2: 最小质量校验

**详细要求:**

1. 执行 `koduck-memory` 相关单元测试。
2. 执行 `koduck-ai` plan orchestration 与 SSE 测试。
3. 执行 `koduck-flow` 组件测试。
4. 执行现有质量门禁脚本。

**验收标准:**

- [ ] 所有新增测试通过。
- [ ] 关键既有回归测试通过。
- [ ] CI 全绿后再合并到 `dev`。

## 建议 Issue 创建顺序

1. `docs(ai): add conversation-native plan canvas ADR`
2. `feat(memory): add plan event store schema`
3. `feat(memory): implement plan repository and service`
4. `feat(memory): expose plan store internal api`
5. `feat(ai): add plan event model and SSE event types`
6. `feat(ai): create plan orchestrator MVP`
7. `feat(ai): persist plan events to memory`
8. `feat(ai): add plan edit event api`
9. `feat(flow): render conversation plan canvas from SSE events`
10. `feat(flow): send user plan edit events to koduck-ai`
11. `feat(flow): display plan node artifacts`
12. `feat(memory): add edit proposal store`
13. `feat(ai): support memory patch proposal workflow`
14. `feat(flow): add proposal diff and approval UI`
15. `feat(ai): support knowledge patch proposal workflow`
16. `feat(flow): add knowledge proposal diff UI`
17. `feat(ai): add plan execution controls`
18. `feat(ai): enforce human approval for high risk plan nodes`
19. `feat(memory): add plan snapshot compaction and retention`
20. `feat(ai): add plan canvas observability and audit baseline`
21. `test(e2e): cover conversation plan canvas happy path`

