# ADR-0019: 为 koduck-ai 引入 mode-aware capability 协商与启动探活

- Status: Accepted
- Date: 2026-04-11
- Issue: #757

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.5.8 节和
`koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md` Task 3.3.5：

1. `chat/stream` 主链路需要正式以 Rust provider adapter 为默认调用入口。
2. `memory/tool` 继续沿用 `GetCapabilities` 协商与 TTL 刷新。
3. `llm` 在 `direct` 模式下不再依赖内部 `llm.proto` 的 `GetCapabilities`，而要改为本地静态 capability + 启动探活。
4. `llm.proto` 的 capability 协商只应在 `adapter` 模式下保留，用于迁移期兼容和回滚。

在本次任务开始前，仓库已经具备：

- `chat/stream` 主链路基于 `state.llm_provider` 调用统一 trait
- `LlmRouter` 可在 `direct | adapter` 模式之间切换
- `CapabilityCache` 已支持 `memory/tool/llm` 的 gRPC capability 协商

但 capability 初始化仍是单一路径：

- 无论 `llm.mode` 为何，都会尝试对 `llm` 使用 gRPC `GetCapabilities`
- 启动期没有对 direct provider 做显式配置校验与可用性探活

这会让 direct 模式的目标态和 capability 体系不一致。

## Decision

本次把 capability 初始化改为 mode-aware，并将 direct provider 的配置校验和轻量探活纳入服务启动流程。

### 1. 启动时引入 mode-aware capability negotiation

在 `src/clients/capability.rs` 中新增 mode-aware 初始化与刷新逻辑：

- `memory/tool` 始终通过 gRPC `GetCapabilities`
- `llm`:
  - `adapter` 模式继续调用 `llm.proto` 的 `GetCapabilities`
  - `direct` 模式改为本地构建 `Capability`，并通过 `list_models` 做启动探活

### 2. direct 模式下使用本地静态 capability

对 direct 模式，本地 capability 由 `koduck-ai` 自己生成，包含：

- `service = "llm"`
- `contract_versions`
- `mode`
- `default_provider`
- `available_providers`
- 每个 provider 的配置默认模型、base_url 与探活得到的模型数量

这样可以保持 northbound / runtime 的 capability 语义一致，而不再虚构一个额外的内部 gRPC LLM service。

### 3. 启动探活基于 `list_models`

direct 模式启动时，对所有 `enabled` 的 provider 逐个执行 `list_models`：

- 若 provider 被启用但缺少运行时凭证，router 会显式返回错误
- 若 provider HTTP 探活失败，启动直接失败
- 若成功，则把探活结果汇总到 capability 中

这满足“启动期可校验 provider 配置与可用性”的要求。

### 4. 把 capability 初始化接入服务启动流程

在 `src/app/mod.rs` 和 `src/main.rs` 中：

- `AppState` 新增 `CapabilityCache`
- 服务开始监听前先执行 `initialize_runtime`
- 初始化成功后再启动 HTTP / metrics server
- capability 后台 TTL 刷新也改为 mode-aware

这样 direct 模式配置错误会在启动时 fail-fast，而不是拖到第一条请求才暴露。

## Consequences

### 正向影响

1. **主链路与 capability 体系对齐**：direct 模式下不再依赖 `llm.proto` 做 capability 协商。
2. **启动失败更早、更明确**：缺失 key、provider 不可达、探活失败都会在启动期暴露。
3. **adapter 回滚路径仍然保留**：切回 `adapter` 模式后，继续走旧的 gRPC capability 协商链路。
4. **后台刷新保持一致策略**：启动和运行期对 LLM capability 的处理方式一致，不会出现模式漂移。

### 代价与风险

1. **启动阶段增加外部依赖探活**：direct 模式启动时需要额外访问外部 provider。
2. **provider 探活依赖 `list_models` 可用**：若某 provider 后续需要改成更轻量探测方式，应继续在 capability 模块内收敛。

### 兼容性影响

- **对 northbound API 无破坏性变化**：`/api/v1/ai/chat` 与 `/api/v1/ai/chat/stream` 契约不变。
- **对 direct 模式行为更严格**：配置和可用性问题会在启动期 fail-fast。
- **对 adapter 模式完全兼容**：现有 `llm.proto` 协商链路继续保留。

## Alternatives Considered

### 1. 继续让 direct 模式伪装成 gRPC `GetCapabilities`

- **拒绝理由**：这会让目标架构与运行时现实脱节，也无法真正校验 direct provider 的可用性。

### 2. direct 模式仅做本地 capability，不做启动探活

- **拒绝理由**：只能校验静态配置，不能在启动时发现 provider 实际不可达的问题。

### 3. 仅对 default provider 探活

- **拒绝理由**：会留下“已启用但不可用”的 provider 到运行期才失败，不符合任务对启动校验的要求。
