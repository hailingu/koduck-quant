# ADR-0016: 为 direct LLM provider 建立共享 reqwest HTTP 基础设施

- Status: Accepted
- Date: 2026-04-11
- Issue: #750

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.5.5 节和
`koduck-ai/docs/implementation/koduck-ai-rust-grpc-tasks.md` Task 3.3.2：

1. `koduck-ai` 的 direct 模式需要统一基于 `reqwest` 实现，不引入额外 OpenAI SDK。
2. 未来 `openai` / `deepseek` / `minimax` 三个 provider adapter 都会走 HTTP + SSE/chunk 流式协议。
3. 如果每个 provider 各自实现 header、timeout、错误映射和流式 chunk 解析，会重复大量样板代码，也会让 429 / 5xx / timeout / EOF 的语义不一致。

在本次任务开始前，`src/llm/` 只有 trait 抽象和 gRPC adapter 兼容实现，还没有：

- 共享 `reqwest::Client`
- 统一 header / deadline timeout 组织
- 共享 SSE chunk 解析器
- 厂商 HTTP 状态码与错误体到 `AppError` 的标准化映射

## Decision

本次在 `src/llm/` 下新增共享 HTTP 基础设施，而不直接实现具体 provider。

### 1. 引入共享 reqwest client

新增 `src/llm/http.rs`，提供 `LlmHttpClient`：

- 使用 `reqwest::Client::builder()`
- 显式启用 `rustls`
- 统一连接复用参数：
  - `connect_timeout`
  - `pool_idle_timeout`
  - `pool_max_idle_per_host`
  - `tcp_keepalive`

这样后续三个 provider adapter 可以共享同一套连接池与 TLS 基线。

### 2. 统一 JSON 请求构造

新增 `JsonRequestOptions`：

- `url`
- `request_id`
- `deadline_ms`
- `bearer_token`
- `traceparent`
- `accept`
- `extra_headers`

统一由共享基础设施注入：

- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `Accept`
- `X-Request-Id`
- `traceparent`

同时把 `deadline_ms` 映射到本地 request timeout，保证后续 provider adapter 严格服从上层预算。

### 3. 统一 SSE chunk 解析

同文件新增 `SseStreamParser`：

- 支持跨 chunk 拼接
- 支持 `event` / `id` / `data`
- 支持按空行 flush 完整事件
- 对提前 EOF 和 malformed chunk 返回统一 `AppError`

这让三个 provider 可以复用同一套流式文本解析器，只在 adapter 内做 provider-specific JSON 到统一 `StreamEvent` 的最后一跳转换。

### 4. 统一 HTTP / stream 错误语义

新增 `src/llm/errors.rs`，提供：

- `map_http_transport_error`
- `map_http_status_error`
- `map_stream_eof`
- `map_malformed_stream_chunk`

归一规则：

- `429` -> `RATE_LIMITED`
- `503` -> `SERVER_BUSY`
- `502` -> `UPSTREAM_UNAVAILABLE`
- `504` / timeout -> `STREAM_TIMEOUT`
- 其他 `5xx` -> `DEPENDENCY_FAILED`
- 提前 EOF / malformed chunk -> `STREAM_INTERRUPTED`

同时兼容从 HTTP header / body 读取 `retry_after_ms`，为后续重试预算逻辑保留一致输入。

## Consequences

### 正向影响

1. **direct provider 有统一底座**：后续三个 provider adapter 只需关心各自 URL、body schema 和响应字段差异。
2. **错误语义一致**：HTTP / stream 异常不会在不同 provider 中漂移成不同的 `AppError`。
3. **便于复用和测试**：header、timeout、SSE 解析器都可以独立单测。

### 代价与风险

1. **仍未接入真实 provider**：本次只完成基础设施，真正的 `openai` / `deepseek` / `minimax` adapter 留到 Task 3.3.3。
2. **当前错误映射是通用启发式**：后续若某个 provider 有更细的错误体语义，需要在 adapter 层补充映射，但不应破坏共享基线。

### 兼容性影响

- **对 northbound API 无兼容性变化**：当前线上路径仍然是 adapter gRPC。
- **对后续 direct provider 是增量增强**：新模块是可并行接入的底座，不影响现有 trait 抽象。

## Alternatives Considered

### 1. 在每个 provider adapter 内各自写 HTTP / SSE / 错误处理

- **拒绝理由**：会在三个 provider 中复制同样的连接池、header、timeout 和错误映射逻辑，长期维护成本高。

### 2. 引入第三方 OpenAI SDK 作为公共底座

- **拒绝理由**：设计已经明确要求统一基于 `reqwest`，并且 `MiniMax` / `DeepSeek` 只是 OpenAI-compatible，直接使用 SDK 会增加不必要耦合。
