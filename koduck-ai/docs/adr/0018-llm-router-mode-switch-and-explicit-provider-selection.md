# ADR-0018: 为 koduck-ai 引入 LLM Router、模式切换与显式 Provider 选择

- Status: Accepted
- Date: 2026-04-11
- Issue: #754

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.5 节和
`koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md` Task 3.3.4：

1. `koduck-ai` 需要支持 `llm.mode = direct | adapter` 的模式切换。
2. `direct` 需要成为默认模式，`adapter` 仅保留为迁移兼容与回滚开关。
3. 路由选择必须同时支持 `provider`、`model` 前缀和 `default_provider`。
4. 多 provider 配置必须独立管理 `enabled/api_key/base_url/default_model`，并且不能发生静默 fallback。

在本次任务开始前，仓库已经具备：

- 统一的 `LlmProvider` trait
- `AdapterLlmProvider` 兼容实现
- `openai` / `deepseek` / `minimax` direct provider adapter

但还缺少一层统一 router 来在 direct 与 adapter 之间切换，也缺少独立的 provider 配置结构。

## Decision

本次引入 `LlmRouter`，作为 `AppState.llm_provider` 的统一入口，在启动期完成模式装配，在请求期完成 provider 路由解析。

### 1. 引入 `llm.mode` 与分 provider 配置

在 `src/config/mod.rs` 中：

- 新增 `LlmMode`
  - `direct`
  - `adapter`
- 将原先扁平的 LLM 配置改为：
  - `llm.openai`
  - `llm.deepseek`
  - `llm.minimax`

每个 provider 独立配置：

- `enabled`
- `api_key`
- `base_url`
- `default_model`

默认值选择：

- `direct` 为默认模式
- `openai` 默认启用
- `deepseek` / `minimax` 默认关闭，避免未显式配置时影响默认直连路径

### 2. 引入 `LlmRouter` 统一处理 direct | adapter 路由

新增 `src/llm/router.rs`，并在 `src/app/mod.rs` 中替换原先固定注入的 `AdapterLlmProvider`。

`LlmRouter` 负责：

- 根据 `llm.mode` 选择 direct 或 adapter 路径
- 根据显式 `provider`、`model` 前缀或 `default_provider` 解析目标 provider
- 将解析后的统一请求下发给对应 provider 实现

请求路由优先级为：

1. `request.provider`
2. `request.model` 中的 provider 前缀，如 `openai:gpt-4.1-mini`
3. `request.model` 中的 provider path 前缀，如 `deepseek/deepseek-v4-flash`
4. `llm.default_provider`

### 3. direct 模式只允许显式启用、显式报错

在 `direct` 模式下：

- 仅对 `enabled=true` 的 provider 视为可路由目标
- 如果请求指向未启用 provider，立即返回错误
- 如果 provider 被启用但缺失运行时凭证，也立即返回错误

这样保证：

- 不会从 `deepseek` 静默跳到 `openai`
- 不会从 direct 静默回落到 adapter
- 错误由调用方显式感知，可用于后续降级或回滚策略

### 4. adapter 模式保留现有 `llm.proto` 兼容链路

在 `adapter` 模式下，router 统一转发到 `AdapterLlmProvider`：

- provider 解析规则仍然保留
- 但真正下游链路仍是现有 `llm.proto` / gRPC adapter

这保证迁移期间可以通过单个开关切回旧链路。

## Consequences

### 正向影响

1. **direct 成为默认模式**：后续主链路可以在不再感知 gRPC adapter 的前提下继续推进。
2. **回滚路径简单清晰**：把 `llm.mode` 切到 `adapter` 即可恢复旧 southbound 链路。
3. **provider 选择行为可预测**：所有 fallback 都变成显式错误，不会产生隐藏流量漂移。
4. **多 provider 配置边界清晰**：各 provider 的 base_url、default_model、api_key 可独立演进。

### 代价与风险

1. **配置项增多**：部署侧需要理解 `mode` 与各 provider 独立配置。
2. **未启用或未配 key 的 provider 会快速失败**：这会更早暴露配置问题，但不会再由系统偷偷兜底。

### 兼容性影响

- **对 northbound API 无破坏性变化**：`/chat`、`/chat/stream` 输入输出契约不变。
- **对 southbound 链路引入显式开关**：默认从固定 adapter 注入切换为 router 注入。
- **对运维配置有增量要求**：需要按 provider 设置独立配置项；旧 `adapter_grpc_target` 仍保留用于兼容模式。

## Alternatives Considered

### 1. 继续固定注入 `AdapterLlmProvider`

- **拒绝理由**：无法满足 direct 为默认模式的设计目标，也无法形成显式回滚开关。

### 2. 允许 direct 模式自动回落到 default provider 或 adapter

- **拒绝理由**：会导致请求真实流向不可预测，不利于灰度、回滚和问题定位。

### 3. 将所有 provider 默认一起启用

- **拒绝理由**：在凭证尚未完整配置时会放大默认配置复杂度，不利于“默认可用”的目标。
