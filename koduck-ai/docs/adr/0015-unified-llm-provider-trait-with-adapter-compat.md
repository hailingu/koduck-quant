# ADR-0015: 为 koduck-ai 引入统一 LLM Provider Trait，并保留 adapter 兼容实现

- Status: Accepted
- Date: 2026-04-11
- Issue: #748

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.5 节和
`koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md` Task 3.3.1：

1. `koduck-ai` 需要把上层编排与具体 LLM 厂商协议解耦。
2. 上层 orchestrator 只能依赖统一抽象，不能直接感知 gRPC contract 或厂商 HTTP/JSON 细节。
3. 迁移期仍需保留现有 `llm.proto` / `LlmServiceClient` 兼容路径，为后续 `direct | adapter`
   模式切换打基础。

在本次任务开始前，现状存在两个问题：

- `src/api/mod.rs` 直接构造 `LlmServiceClient`、`GenerateRequest`、`StreamGenerateEvent`，
  上层已经耦合到具体 gRPC 契约。
- chat 与 stream 的主链路拿到的是下游 proto 类型，而不是统一的 LLM 领域对象。

## Decision

本次先引入一层最小统一抽象，让现有 gRPC adapter 路径成为 `LlmProvider` 的一个实现，
再在后续任务中继续接入 provider-native HTTP。

### 1. 定义统一 trait 与领域类型

新增：

- `src/llm/provider.rs`
- `src/llm/types.rs`

核心抽象：

- `LlmProvider`
  - `generate`
  - `stream_generate`
  - `list_models`
  - `count_tokens`
- 统一领域类型：
  - `RequestContext`
  - `GenerateRequest`
  - `GenerateResponse`
  - `CountTokensRequest/Response`
  - `ModelInfo`
  - `StreamEvent`
  - `TokenUsage`

这些类型只表达编排层关心的稳定语义，不暴露 provider-specific JSON 字段。

### 2. 用兼容实现包住现有 gRPC adapter

新增 `src/llm/compat.rs`，提供 `AdapterLlmProvider`：

- 输入统一领域类型
- 内部转换为现有 `llm.proto` 请求
- 输出统一领域类型
- 把流式 gRPC 事件映射为统一 `StreamEvent`

这样现有链路仍然通过 gRPC adapter 工作，但上层已经不再直接依赖 `LlmServiceClient`。

### 3. 在 AppState 中注入 trait object

`AppState` 新增：

- `llm_provider: Arc<dyn LlmProvider>`

当前默认注入 `AdapterLlmProvider`。后续 direct provider router 落地时，只需要替换注入实现，
不需要再修改 chat/stream 主链路。

### 4. 将 API 主链路切到统一抽象

`src/api/mod.rs` 中：

- chat 非流式路径改为调用 `state.llm_provider.generate`
- stream 路径改为调用 `state.llm_provider.stream_generate`
- 上层只处理统一 `GenerateResponse` 与 `StreamEvent`

这保证了 orchestrator/API 层不再接触 provider-specific gRPC 类型。

## Consequences

### 正向影响

1. **上层完成解耦**：编排层已经不依赖具体 gRPC proto 类型。
2. **为 direct 模式铺路**：后续接入 OpenAI/MiniMax/DeepSeek 的 HTTP adapter 时，不必再改上层接口。
3. **兼容路径保留**：当前功能行为仍然沿用现有 LLM adapter gRPC 链路，风险较低。

### 代价与风险

1. **当前仍只有 adapter 实现**：`direct` 模式的真实 provider-native HTTP 适配留到后续任务完成。
2. **领域类型与 proto 暂时接近**：这是为了平滑迁移，后续 provider-native HTTP 落地后再继续校准语义边界。

### 兼容性影响

- **向后兼容**：现有 northbound chat/stream 行为不变。
- **内部接口变化**：`src/api/mod.rs` 不再直接使用 `LlmServiceClient`，统一改为 trait object。

## Alternatives Considered

### 1. 继续直接在 API 层使用 `LlmServiceClient`

- **拒绝理由**：会让后续 direct provider-native HTTP 接入时再次重写主链路，重复成本高。

### 2. 直接在本任务引入完整 provider-native HTTP router

- **拒绝理由**：这会把 Task 3.3.2-3.3.5 一起做掉，超出 Task 3.3.1 的边界。
