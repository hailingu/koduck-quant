# ADR-0020: Intent-aware Memory Query Routing

- Status: Accepted
- Date: 2026-04-15
- Issue: TBD

## Context

当前 `koduck-ai -> query_memory -> koduck-memory` 主链路已经打通，但在处理
“我们之前聊过什么”“之前讨论过哪些内容”这类全局历史回顾问题时，暴露出一个
边界错位问题：

1. `koduck-ai` 当前只让 LLM 返回 `tool_call=query_memory`，没有要求 LLM 同时显式返回
   本次 memory query 的主意图。
2. `koduck-memory` 因此需要再次根据 `query_text` 进行内部意图猜测，并在统一检索路径中
   把“全局回顾”“比较”“纠错”“辨析”等不同语义重新路由。
3. 对于“之前我们聊过什么”这类 query，单靠 query text 做 anchor-style 检索时，
   可能既没有明确 `domain`，也没有稳定 `entity/relation`，导致 `QueryMemory`
   返回空命中，即使系统中实际上存在可用于汇总的全局 session summaries。
4. 这会让 `koduck-ai` 的 northbound 编排语义与 `koduck-memory` 的 southbound
   检索职责重新耦合：AI 编排层没有真正声明“这次想回顾历史”，memory 服务只能靠猜。

本问题不应通过新增 fallback 解决。

原因是：

1. fallback 会把“检索意图不明确”的问题掩盖成“检索策略补丁”，继续放大服务边界漂移。
2. “全局历史回顾”本身就是一种显式 retrieval intent，不是默认 anchor 检索失败后的兜底分支。
3. `koduck-ai` 作为 orchestration 层，本来就应负责把用户请求映射为明确的 southbound
   语义，而不是把这一步隐式下沉给 `koduck-memory`。

## Decision

我们决定引入 **intent-aware memory query routing**，并明确以下约束：

### 1. LLM 对 `query_memory` 的工具调用必须同时输出主意图

当 LLM 选择调用 `query_memory` 时，除了现有 query 参数外，必须显式返回一个封闭集合中的
主意图字段，例如：

- `recall`
- `compare`
- `disambiguate`
- `correct`
- `explain`
- `decide`
- `none`

`koduck-ai` 不再只依赖 `tool_call=query_memory` 这一层语义，而是将
`query_memory + intent` 作为完整的编排决策单元。

### 2. `koduck-ai` 根据 `intent + tool_call` 决定 southbound 检索路径

`koduck-ai` 负责把 LLM 返回的主意图转化为具体的 memory 检索模式：

- `intent=recall`
  - 语义：显式全局历史回顾
  - 路径：全局 `session summaries` 检索
- `intent=compare`
  - 语义：比较/差异类历史检索
  - 路径：优先查找 `anchor=compare` / `relation=comparison`
- `intent=disambiguate`
  - 语义：辨析/混淆消解
  - 路径：优先查找 `anchor=disambiguation`
- `intent=correct`
  - 语义：纠正历史说法
  - 路径：优先查找 `anchor=correction`
- `intent=explain`
  - 语义：解释型问题
  - 路径：继续走 domain/entity 为主的常规 memory 检索
- `intent=decide`
  - 语义：决策上下文检索
  - 路径：优先查找 decision-related anchors / facts
- `intent=none`
  - 语义：不做 intent-specific routing
  - 路径：走默认 memory 查询路径

### 3. `koduck-memory` 不再承担主意图猜测责任

`koduck-memory` 仍可保留轻量 query normalization 或结构化辅助分析，但它不再负责根据
`query_text` 独立决定“这是 recall 还是 compare”这种主语义分流。

换句话说：

- 主意图由 `koduck-ai` 显式下发
- `koduck-memory` 按已声明意图执行相应检索路径

### 4. “全局历史回顾”不是 fallback，而是一级检索模式

`intent=recall` 时，不应先走 anchor-first 再在空结果后 fallback 到 summaries。

正确语义是：

- `recall` 本身就是一个一级 retrieval mode
- 其主路径就是全局 `session summaries`

这保证了“我们之前聊过什么”不会被误降级成宽泛、低信息量的 anchor 查询。

## Consequences

正面影响：

1. `koduck-ai` 与 `koduck-memory` 的边界更清晰：
   `koduck-ai` 负责语义编排，`koduck-memory` 负责检索执行。
2. “全局回顾”“比较”“纠错”等不同 memory 需求可以走清晰、可观测、可测试的独立路径。
3. 避免出现“本次 QueryMemory 结果为空，但回答看起来像命中了历史”的隐式语义漂移。
4. 后续如果需要观测 recall/compare/correct 等命中率，可以直接按 intent 维度统计。

代价与约束：

1. `query_memory` 的工具 schema、`koduck-ai` 内部 tool resolution、`memory.v1` southbound
   contract 都需要一起演进。
2. 原有 `koduck-memory` 内部基于 `query_text` 猜 intent 的逻辑需要降级为辅助能力，
   不再作为主路由依据。
3. 需要为 intent-routing 建立明确的集成测试，确保 `intent=recall` 不会错误落回
   anchor-first 主路径。

## Compatibility Impact

1. `koduck-ai` 的 northbound HTTP API 对前端保持兼容；
   变化发生在 LLM tool schema 与 southbound memory contract。
2. `memory.v1` 需要新增 intent-aware 查询字段或等价的 retrieval mode 表达；
   这属于 southbound contract 的前向演进，不应复用原有“仅靠 query text 推断”的隐式语义。
3. 历史调用方若仍只传 `query_text` 而不传 intent，应在迁移期被显式识别为旧路径，
   而不是静默混入新语义。

## Alternatives Considered

### Alternative A: 保持现状，由 `koduck-memory` 继续从 `query_text` 猜主意图

未采用。

这会把编排责任错误地下沉到 memory 服务，继续模糊服务边界，也无法稳定支持
`recall -> global session summaries` 这样的一级检索模式。

### Alternative B: 在 anchor-first 空结果后增加 fallback 到全局 summaries

未采用。

这会把“显式 recall”伪装成“检索失败后的补丁分支”，掩盖问题根因。
`recall` 应该是一级检索意图，而不是 fallback。

### Alternative C: 让 `koduck-ai` 直接本地维护 recall / compare 的检索实现

未采用。

这会破坏 `koduck-memory` 作为 southbound first-class memory service 的定位，
把检索执行重新带回 `koduck-ai`，与解耦架构方向相反。

## Follow-up

1. 更新 `query_memory` tool schema，使 LLM 必须返回 `intent`。
2. 更新 `koduck-ai` tool resolution 逻辑，基于 `intent + tool_call` 构造 southbound 请求。
3. 演进 `memory.v1 QueryMemoryRequest`，显式承载 intent-aware routing 信息。
4. 在 `koduck-memory` 中将 `recall` 路径实现为全局 `session summaries` 查询主路径，
   而非 anchor-first fallback。
5. 为 `recall / compare / correct / disambiguate` 增加端到端测试和日志字段。
