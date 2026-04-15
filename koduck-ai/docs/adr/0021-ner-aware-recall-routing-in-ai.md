# ADR-0021: NER-aware Recall Routing in koduck-ai

- Status: Accepted
- Date: 2026-04-15
- Issue: TBD

## Context

ADR-0020 已经把 `query_memory` 升级为 intent-aware 路由，但在真实验证中又暴露出一个更细粒度的问题：

1. 当用户问“我们之前谈论过什么吗？”这类无明确主题的历史回顾问题时，走全局 `session summaries` 是合理的。
2. 但当用户问“之前我们具体聊了鸡排的哪些内容？”这类带有明确主题/实体的历史回顾问题时，如果仍然一律走全局 summaries，会把本应主题收敛的 recall 查询放大成全局历史回顾。
3. 当前仅靠 `intent=recall` 还不足以表达“这是全局回顾”还是“这是围绕明确主题/实体的回顾”。

因此，`koduck-ai` 需要在 LLM tool call 阶段拿到更结构化的主题信息，并在 northbound orchestration 层完成更细粒度的 recall 路由。

## Decision

我们决定在 `koduck-ai` 中引入 **NER-aware recall routing**，并明确以下规则：

### 1. `query_memory` tool call 必须显式返回 `ner[]`

当 LLM 输出 `query_memory` 工具调用时，除了 `query` 与 `intent` 外，还必须显式返回 `ner` 数组：

- 每个 NER 元素至少包含：
  - `text`
  - `type`
- 如果没有识别到明确主题/实体，也必须返回空数组 `[]`

### 2. `intent=recall` 时按 NER 是否为空细分路由

- `intent=recall` 且 `ner` 为空
  - 语义：全局历史回顾
  - 路径：全局 `session summaries`
- `intent=recall` 且 `ner` 非空
  - 语义：围绕明确主题/实体的历史回顾
  - 路径：anchor-oriented recall
  - 由 `koduck-ai` 将 query 收敛到 NER 文本，并避免误触发 `recall_global_summaries`

### 3. 其他显式 intent 继续走 anchor-oriented 路由

- `intent=compare`
  - 路径：compare anchors
- `intent=correct`
  - 路径：correct anchors
- `intent=disambiguate`
  - 路径：disambiguate anchors

这些路径继续通过 `koduck-ai` 下发 southbound 查询语义，由 `koduck-memory` 执行对应 anchor 检索。

### 4. 本次变更限定在 `koduck-ai`

本次调整不修改 `koduck-memory` southbound contract，而由 `koduck-ai`：

- 扩展 tool schema
- 要求 LLM 输出 `ner[]`
- 根据 `intent + ner[]` 选择实际 southbound query 形态

## Consequences

正面影响：

1. “全局回顾”与“主题化回顾”被清晰区分。
2. 与用户问题中的明确主题更一致，避免把聚焦 recall 误扩展成全局 summaries。
3. compare / correct / disambiguate 路径继续保持 intent-aware 的 anchor 检索语义。
4. 日志中可以直接观察：
   - tool intent
   - effective memory intent
   - ner 列表
   - retrieval route

代价与约束：

1. LLM tool schema 更复杂，需要模型稳定返回 `ner[]`。
2. `koduck-ai` 需要承担更多 northbound semantic routing 责任。
3. 在不修改 `koduck-memory` contract 的前提下，主题化 recall 的 southbound 表达会继续通过 `koduck-ai` 的策略映射实现。

## Compatibility Impact

1. 对前端 northbound API 保持兼容。
2. 对 `koduck-memory` southbound proto 保持兼容，本次不新增字段。
3. 只有 `koduck-ai` 的 tool schema、prompt instruction 和 southbound 路由决策发生变化。

## Alternatives Considered

### Alternative A: 继续让所有 `intent=recall` 都走全局 summaries

未采用。

这会让“鸡排”“鲁迅”这类明确主题回顾问题失去主题收敛能力。

### Alternative B: 在 `koduck-memory` 中再细分 recall 的语义

本次未采用。

这会扩大 southbound contract 与 memory 服务职责边界；当前更合适的做法是先由 `koduck-ai` 明确编排。

## Follow-up

1. 更新 `query_memory` tool schema，强制返回 `ner[]`。
2. 在 `koduck-ai` 中实现：
   - `recall + ner=[] -> global session summaries`
   - `recall + ner!=[] -> anchor recall`
   - `compare/correct/disambiguate -> anchor routes`
3. 为新的日志字段补充验收验证：
   - `tool_query_intent`
   - `memory_query_intent`
   - `retrieval_route`
   - `ner`
