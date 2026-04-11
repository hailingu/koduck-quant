# ADR-0017: 为 koduck-ai 落地首批 OpenAI-compatible direct provider adapters

- Status: Accepted
- Date: 2026-04-11
- Issue: #752

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.5 节和
`koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md` Task 3.3.3：

1. `koduck-ai` 需要默认走 provider-native HTTP 直连外部 LLM Provider。
2. 首批支持 provider 为 `openai`、`deepseek`、`minimax`。
3. 上层 orchestrator 只能依赖统一 `LlmProvider` trait，不允许泄漏厂商-specific HTTP 路径、body 或 stream chunk 结构。

在本次任务开始前，仓库已经有：

- `LlmProvider` 统一抽象
- 兼容旧 `llm.proto` 的 `AdapterLlmProvider`
- 共享 `reqwest`/SSE/HTTP 错误基础设施

但还没有真正的 direct provider adapter，因此 `direct` 模式仍然缺少可以承接实际请求的实现。

## Decision

本次为 `openai`、`deepseek`、`minimax` 新增首批 direct provider adapter，并把公共 OpenAI-compatible 协议处理沉到一个共享实现中。

### 1. 增加三个 provider 文件

新增：

- `src/llm/openai.rs`
- `src/llm/deepseek.rs`
- `src/llm/minimax.rs`

其中：

- `OpenAiProvider` 直接实现 OpenAI 官方接口适配
- `DeepSeekProvider` 与 `MiniMaxProvider` 作为 wrapper，复用同一套 OpenAI-compatible HTTP 协议处理

### 2. 在 adapter 内收敛厂商差异

共享层负责：

- `chat.completions` 请求构造
- `stream=true` 的 SSE 增量解析
- `models` 查询
- 本地 token 估算
- OpenAI-compatible 的响应体解析与标准化

各 provider 仅暴露：

- `provider` 标识
- 默认 `base_url`
- 默认 `model`
- provider-specific 构造入口

这样可以把厂商差异留在 `src/llm/` 内，而不扩散到 orchestrator 或 API 层。

### 3. 使用本地 token 估算作为当前 count_tokens 实现

考虑到并非所有 provider 都稳定提供独立 token count endpoint，本次 `count_tokens` 先采用本地估算：

- 按 message 字符长度粗略折算
- 保持统一返回结构

这符合设计里“若厂商未提供，允许本地估算”的约束，也避免了在 Task 3.3.3 阶段引入额外 southbound 契约复杂度。

### 4. 流式输出统一映射为 `StreamEvent`

stream adapter 统一把 OpenAI-compatible SSE chunk 映射到：

- `event_id`
- `sequence_num`
- `delta`
- `finish_reason`
- `usage`
- `provider`
- `model`

并在 adapter 内处理：

- `[DONE]`
- 仅含 `finish_reason` 的尾事件
- 仅含 `usage` 的尾事件
- malformed chunk / 提前 EOF 的错误收敛

## Consequences

### 正向影响

1. **首批 direct provider 已可落地**：`openai` / `deepseek` / `minimax` 都具备非流式和流式生成能力。
2. **厂商差异被限制在 adapter 层**：上层继续只依赖 `LlmProvider`。
3. **后续 router 接入更直接**：Task 3.3.4 只需要做配置和 provider 选择，不必再补 provider 具体协议代码。

### 代价与风险

1. **MiniMax 仍按 OpenAI-compatible 路径建模**：如果后续发现 MiniMax 某些高级能力需要额外字段，应继续在 `minimax.rs` 内收敛，不上浮到公共 trait。
2. **count_tokens 当前是估算值**：精度不如厂商原生能力，但足以支撑现阶段能力探活与主链路衔接。

### 兼容性影响

- **对 northbound API 无破坏性变化**：本次只新增 direct provider adapter，不改现有主链路默认模式。
- **对后续 direct 模式是前置能力补全**：为 Task 3.3.4 / 3.3.5 提供可切换的真实 provider 实现。

## Alternatives Considered

### 1. 分别在三个 provider 文件里复制完整 HTTP / stream 逻辑

- **拒绝理由**：会造成请求构造、SSE 解析、错误处理和 usage 映射的大量重复，后续维护成本高。

### 2. 继续只保留 `AdapterLlmProvider`

- **拒绝理由**：这与设计的目标态相违背，也无法支撑后续 `direct` 作为默认模式的要求。
