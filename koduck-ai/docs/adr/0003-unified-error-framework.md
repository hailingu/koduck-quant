# ADR-0003: 统一错误框架

- Status: Accepted
- Date: 2026-04-10
- Issue: #721

## Context

`koduck-ai` 作为 AI Gateway/Orchestrator，需要为北向 API（对前端）提供统一的错误语义，同时为南向 gRPC 调用（对 memory/tool/llm 服务）提供错误归一能力。

### 问题

1. **多下游错误来源**：memory-service、tool-service、LLM adapter 各自返回不同格式的错误，需要统一归一
2. **双协议映射**：南向使用 gRPC（tonic::Code），北向使用 HTTP（axum StatusCode），需要双向映射
3. **错误信息泄露风险**：下游内部错误细节（如数据库连接串、堆栈信息）不得透传给前端
4. **重试/降级决策依赖**：编排层需要结构化的 `retryable`、`degraded`、`retry_after_ms` 字段来驱动重试预算和降级策略

### 现有参考

- 设计文档 §14 附录 A 定义了 V1 错误码字典（13 个错误码）和统一错误对象结构
- 设计文档 §7.3 定义了错误映射基线和归一规则
- `koduck-auth/src/error.rs` 已建立 `AppError` + `ErrorResponse` 模式，可参考其 `IntoResponse` / `From<AppError> for Status` 实现

## Decision

### 1. 错误码枚举（ErrorCode）

定义 13 个 V1 错误码，每个错误码携带以下元信息（编译期确定）：

| 属性 | 说明 |
|------|------|
| `retryable` | 是否可重试 |
| `degradable` | 是否可降级 |
| `http_status` | 对应 HTTP 状态码 |
| `grpc_code` | 对应 gRPC status code |

使用 `strum` crate 的 `Display` / `IntoStaticStr` 派生实现，避免手写字符串转换。

### 2. 统一错误对象（AppError）

结构：

```
AppError {
    code: ErrorCode,
    message: String,
    request_id: Option<String>,
    retryable: bool,       // 来自 ErrorCode 默认值，可覆盖
    degraded: bool,        // 默认 false，降级场景显式标记
    upstream: Option<UpstreamService>,  // 标识来源服务
    retry_after_ms: Option<u64>,        // 429 场景携带
    source: Option<Box<dyn Error>>,     // 内部存储原始错误，不序列化
}
```

关键设计决策：

- **`source` 字段**：存储下游原始错误供日志/排查使用，但 `Debug`/`Serialize` 输出不包含原始错误详情
- **`client_message()`**：对外返回的消息，内部错误统一脱敏为通用描述
- **`retryable` 可覆盖**：ErrorCode 提供默认值，但实际场景中（如重试预算耗尽）可覆盖为 `false`

### 3. 状态码映射

提供工具函数（非 trait impl，避免耦合）：

- `ErrorCode::http_status()` → `axum::http::StatusCode`
- `ErrorCode::grpc_code()` → `tonic::Code`
- `From<&tonic::Status> for ErrorCode` — 将下游 gRPC 错误归一到 ErrorCode
- `From<tonic::Status> for AppError` — 将下游 gRPC 错误转换为 AppError

### 4. 非透传规则

- `AppError` 的 `Serialize` 实现仅输出 `code/message/request_id/retryable/degraded/upstream/retry_after_ms`
- `source`（原始下游错误）不参与序列化
- `message` 字段在内部错误场景下替换为脱敏描述

## Consequences

### 正向影响

1. **统一出口**：所有北向 API 响应共享同一错误格式，前端处理逻辑简化
2. **安全性**：下游内部细节不会泄露到客户端
3. **可观测性**：结构化错误码支持按 `code` 聚合日志和指标
4. **编排友好**：`retryable` / `degraded` 字段直接驱动重试预算和降级策略

### 代价与风险

1. **依赖 strum crate**：引入一个额外依赖，但 strum 是 Rust 生态成熟且广泛使用的枚举工具库
2. **映射覆盖**：部分 gRPC Code 到 ErrorCode 的映射需要业务语义判断（如 `UNAVAILABLE` 可能是 `UPSTREAM_UNAVAILABLE` 或 `SERVER_BUSY`），需在具体转换点明确上下文
3. **错误码扩展**：V1 之后新增错误码需走 ADR 评审

### 兼容性影响

- **API 兼容性**：北向错误响应格式从此定义开始确立，后续变更需保持向后兼容
- **下游对接**：Task 5.1（error_mapper）将基于此框架落地全量映射，当前骨架仅覆盖基础映射
- **环境变量**：无新增环境变量

## Alternatives Considered

### 1. 复用 koduck-auth 的 AppError 模式

- **优点**：与现有代码一致
- **缺点**：koduck-auth 的错误码是 auth 领域特定的（如 `PasswordHash`、`Jwt`），缺少 AI 网关所需的 `UPSTREAM_UNAVAILABLE`、`RATE_LIMITED`、`STREAM_TIMEOUT` 等语义
- **结论**：参考其模式（`IntoResponse` + `From for Status`），但定义独立的错误码枚举

### 2. 使用 anyhow::Error 统一处理

- **优点**：零成本抽象，灵活
- **缺点**：anyhow 缺少结构化错误码、无法自动映射 HTTP/gRPC 状态码、不适合作为 API 层错误类型
- **结论**：内部实现可使用 anyhow，但 API 层错误必须使用结构化的 AppError

### 3. 不引入 strum，手写 Display/AsRef<str>

- **优点**：零额外依赖
- **缺点**：手写 13 个枚举变体的字符串转换和映射函数，易出错且维护成本高
- **结论**：引入 strum，依赖极轻且提供编译时保证

## Verification

- 所有 V1 错误码可构造并序列化为 JSON
- gRPC ↔ HTTP 映射单元测试覆盖所有 13 个错误码
- 下游原始错误（`source`）不出现序列化输出中
- `docker build -t koduck-ai:dev ./koduck-ai` 通过

## References

- 设计文档: [ai-decoupled-architecture.md](../../../docs/design/koduckai-rust-server/ai-decoupled-architecture.md) §7.3, §14
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../../../docs/implementation/koduck-ai-rust-grpc-tasks.md) Task 1.3
- 前置 ADR: [ADR-0001](0001-init-rust-grpc-project-structure.md), [ADR-0002](0002-config-and-secret-management.md)
- 参考: `koduck-auth/src/error.rs`
- Issue: [#721](https://github.com/hailingu/koduck-quant/issues/721)
