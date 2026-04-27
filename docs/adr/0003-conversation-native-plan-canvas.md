# ADR 0003: 对话原生 Plan Canvas 边界

## 元数据

- **状态**: 提议
- **日期**: 2026-04-26
- **作者**: Codex
- **相关**:
  - `docs/implementation/koduck-ai-conversation-plan-canvas-implementation-plan.md`
  - `docs/implementation/koduck-ai-conversation-plan-canvas-tasks.md`

---

## 背景与问题陈述

`koduck-ai` 需要在自然语言对话中支持复杂任务的计划生成、协作编辑、执行状态展示、
产物追踪以及 memory/knowledge 修改确认。如果直接把 `koduck-flow` 设计成独立 workflow
产品，会让计划事实来源、执行 owner、长期知识 owner 和画布交互状态混杂，增加部署、
一致性、审计和权限治理成本。

本 ADR 冻结 Conversation-native Plan Canvas 的系统边界：计划编排归 `koduck-ai`，
计划过程状态归 `koduck-memory`，画布展示与局部交互归 `koduck-flow`，长期领域知识归
`koduck-knowledge`。

### 上下文

- 业务背景：用户希望在聊天过程中看到 AI 的任务计划、节点执行状态、工具结果和待确认修改。
- 技术背景：当前系统已有 `koduck-ai`、`koduck-memory`、`koduck-flow`、
  `koduck-knowledge` 等边界清晰的服务/模块，需要避免新增独立 workflow 执行平面。

---

## 决策驱动因素

1. **对话一致性**: 计划、执行、用户确认和最终回答必须属于同一条对话脉络。
2. **事实来源清晰**: 不允许画布组件成为计划事实或长期知识事实来源。
3. **审计要求**: memory/knowledge 修改必须可追溯到用户确认、节点、请求和会话。
4. **安全要求**: memory/knowledge 写入、交易、下单、生产变更等高风险动作必须人工确认。
5. **渐进交付**: MVP 应优先完成计划事件持久化、SSE 展示和 proposal 审核闭环。

---

## 考虑的选项

### 选项 1: koduck-flow 作为独立 workflow 产品

**描述**: `koduck-flow` 独立负责流程定义、部署、运行和状态持久化。

**优点**:

- 具备更通用的流程编辑能力。
- 可以面向非对话场景复用。

**缺点**:

- 与 `koduck-ai` 的对话编排产生双执行 owner。
- 计划状态、用户确认、工具执行结果需要跨系统同步。
- memory/knowledge 写入审计链路更复杂。
- 当前阶段会显著扩大交付范围。

### 选项 2: koduck-ai 内嵌计划状态，不持久化到 koduck-memory

**描述**: `koduck-ai` 在内存或自身存储中维护计划状态，前端只订阅 SSE。

**优点**:

- MVP 实现较快。
- 服务间交互较少。

**缺点**:

- 断线、刷新、重启后难以恢复计划。
- 计划事件和 proposal 审计无法进入统一 conversation state。
- 与现有 memory-first 会话真值方向不一致。

### 选项 3: 对话原生 Plan Canvas

**描述**: `koduck-ai` 负责编排执行，`koduck-memory` 持久化 plan/event/artifact/proposal，
`koduck-flow` 作为聊天内 Plan Canvas SDK，`koduck-knowledge` 仅保存确认后的长期知识。

**优点**:

- 对话、计划、执行和审计保持同一上下文。
- 服务边界清晰，避免独立 workflow 执行平面。
- 支持断线恢复、事件回放和 proposal 审计。
- 适合按 Phase 渐进实现。

**缺点**:

- `koduck-ai` 与 `koduck-memory` 的契约需要扩展。
- 初期需要同时改动 AI、Memory、Flow 三个模块。

---

## 决策结果

**选定的方案**: 选项 3，对话原生 Plan Canvas。

**理由**:

1. `koduck-ai` 已经是对话任务的编排入口，由它决定计划生成、节点执行和用户编辑事件处理最自然。
2. `koduck-memory` 已经承载会话状态和记忆能力，将 plan event/proposal 纳入其中能统一恢复和审计。
3. `koduck-flow` 保持为画布 SDK，可专注渲染、局部交互和用户动作采集，不承担执行与事实写入。
4. `koduck-knowledge` 继续只保存稳定、确认后的领域事实，避免未确认草稿污染长期知识库。

**积极后果**:

- 复杂 AI 任务可以在聊天中形成可视化、可编辑、可恢复的计划。
- memory/knowledge 修改具备确认、拒绝、编辑和应用的完整审计链路。
- 计划状态和产物可以随会话恢复，不依赖前端临时状态。

**消极后果**:

- 需要新增 plan store、plan orchestration 和 conversation canvas 三组能力。
- 事件模型、幂等、权限和观测需要在多个模块保持一致。

**缓解措施**:

- 使用事件溯源 + 快照模型降低存储和 UI 形态耦合。
- 先交付 MVP 节点类型和事件类型，再扩展高级执行控制。
- 将高风险写入统一收口到 proposal + human approval。

---

## 实施细节

### 系统边界

`koduck-ai` 职责：

- 根据用户消息动态生成 Plan。
- 编排 LLM、tool catalog、tool executor、memory client、knowledge client。
- 处理用户编辑事件，如 node edit/retry/skip、plan pause/resume/cancel。
- 向前端流式发送 plan events。
- 将计划事件和快照写入 `koduck-memory`。

`koduck-memory` 职责：

- 保存 `memory_plans`、`memory_plan_events`、`memory_plan_snapshots`、
  `memory_plan_artifacts`、`memory_edit_proposals`。
- 支持按 session/plan 回放计划状态。
- 保存 proposal 审核、拒绝、编辑和应用记录。
- 为 `koduck-ai` 提供恢复、重放、审计查询能力。

`koduck-flow` 职责：

- 订阅 `koduck-ai` SSE plan events。
- 渲染计划画布、节点状态、依赖关系和 artifact。
- 收集用户对节点、参数、顺序和 proposal 审核的编辑动作。
- 将用户动作发送给 `koduck-ai` plan event API。

`koduck-knowledge` 职责：

- 保存稳定、确认后的领域知识。
- 暴露查询与写入接口。
- 不保存未确认的计划过程和草稿提案。

### 强制约束

- `koduck-flow` 不作为生产执行引擎。
- `koduck-flow` 不直接调用业务工具。
- `koduck-flow` 不直接写入 memory 或 knowledge。
- `koduck-ai` 不静默写入长期 memory 或 knowledge。
- memory/knowledge 写入必须经过 proposal + confirmation。
- 交易、下单、生产变更类 tool 必须强制 human approval。
- 所有 plan API 必须校验 `tenant_id`、`session_id`、`user_id`。
- plan event payload 不得包含明文密钥、token、密码。

### 实施计划

- [ ] Phase 1: 在 `koduck-memory` 新增 Plan Store schema、repository、service。
- [ ] Phase 2: 在 `koduck-ai` 新增 Plan 领域模型、SSE 事件和 Orchestrator MVP。
- [ ] Phase 3: 在 `koduck-flow` 新增 Conversation Plan Canvas。
- [ ] Phase 4: 实现 memory proposal 审核闭环。
- [ ] Phase 5: 实现 knowledge proposal 审核闭环。
- [ ] Phase 6: 补齐 pause/resume/cancel、retry/skip、幂等、快照压缩和观测。

### 影响范围

- `koduck-ai`
- `koduck-memory`
- `koduck-flow`
- `koduck-knowledge`
- `docs/implementation`

---

## 相关文档

- [koduck-ai 对话原生 Plan Canvas 集成实施计划](../implementation/koduck-ai-conversation-plan-canvas-implementation-plan.md)
- [koduck-ai 对话原生 Plan Canvas 实施任务清单](../implementation/koduck-ai-conversation-plan-canvas-tasks.md)
- [Koduck Memory 对接 Koduck AI 实施任务清单](../../koduck-memory/docs/implementation/koduck-memory-service-tasks.md)
- [Koduck AI Rust + gRPC 实施任务清单](../../koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md)

---

## 备注

- 本 ADR 不引入独立 workflow 部署服务。
- 本 ADR 不覆盖完整 BPMN/低代码引擎。
- 本 ADR 不允许生产交易自动执行或无确认的长期事实写入。

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-26 | 初始版本 | Codex |

