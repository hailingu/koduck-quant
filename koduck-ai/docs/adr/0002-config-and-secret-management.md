# ADR-0002: 配置与 Secret 管理

- Status: Accepted
- Date: 2026-04-10
- Issue: #719

## Context

`koduck-ai` 作为 AI Gateway/Orchestrator，需要灵活管理多种运行时配置：

1. **南向 gRPC 客户端地址**：memory / tool / llm adapter 的 gRPC target（经由 APISIX 路由）
2. **LLM 提供商参数**：默认提供商、超时时间
3. **流式传输参数**：最大流式持续时间
4. **敏感信息**：LLM API Key（如 `OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`ANTHROPIC_API_KEY`）等

设计文档第 9 节明确了 Secret 管理约束：禁止在代码、配置样例、日志中明文落地密钥。

### 现有参考

`koduck-auth` 已建立成熟的配置管理模式，使用 `config` crate + `secrecy` crate 实现：

- `config` crate：支持多层配置源（默认值 → 配置文件 → 环境变量），环境变量优先级最高
- `secrecy::SecretString`：封装敏感字段，Debug/Display 输出自动脱敏为 `***`
- 环境变量前缀：`KODUCK_AUTH__`，双下划线分隔嵌套层级

## Decision

### 配置结构设计

采用与 `koduck-auth` 一致的模式，按职责域划分配置子结构：

| 配置域 | 结构体 | 关键字段 |
|--------|--------|----------|
| 服务端口 | `ServerConfig` | `http_addr`, `grpc_addr`, `metrics_addr` |
| LLM | `LlmConfig` | `default_provider`, `timeout_ms`, `api_keys` |
| Memory | `MemoryConfig` | `grpc_target` |
| Tool | `ToolConfig` | `grpc_target` |
| Stream | `StreamConfig` | `max_duration_ms` |
| Auth | `AuthConfig` | `jwks_url` |

### 环境变量命名规范

沿用 `KODUCK_AI__` 前缀 + 双下划线层级分隔：

```
KODUCK_AI__MEMORY__GRPC_TARGET
KODUCK_AI__TOOLS__GRPC_TARGET
KODUCK_AI__LLM__ADAPTER_GRPC_TARGET
KODUCK_AI__LLM__DEFAULT_PROVIDER
KODUCK_AI__LLM__TIMEOUT_MS
KODUCK_AI__STREAM__MAX_DURATION_MS
KODUCK_AI__AUTH__JWKS_URL
```

### Secret 管理

- LLM API Key 使用 `secrecy::SecretString` 封装
- Config 的 `Debug` / `Display` 实现中，Secret 字段统一输出 `***`
- 按提供商分 Key（`openai_api_key`, `deepseek_api_key`, `anthropic_api_key`），由环境变量注入

### 配置校验

- 每个配置子结构实现 `validate()` 方法，启动时统一校验
- 校验失败返回结构化 `ValidationError`，包含具体字段名和错误原因
- 校验不通过则 fail-fast，服务拒绝启动

### 配置加载优先级

```
默认值 → config/default.toml → config/local.toml → 环境变量（最高优先级）
```

## Consequences

### 正向影响

1. **与 koduck-auth 一致**：相同的配置模式和命名规范，降低团队认知成本
2. **安全性**：Secret 类型确保密钥不会意外泄露到日志中
3. **灵活性**：环境变量覆盖机制支持 K8s ConfigMap / Secret 注入
4. **快速失败**：启动时校验避免运行时配置错误导致的不确定行为

### 代价与风险

1. **SecretString 开销**：每次访问密钥需显式调用 `expose_secret()`，增加少量代码复杂度
2. **配置项增长**：后续 Phase 可能增加更多配置项，需保持结构清晰

### 兼容性影响

- **环境变量**：新增环境变量不影响现有服务（koduck-ai 为新服务）
- **配置文件**：`config/default.toml` 和 `config/local.toml` 为可选文件，不存在时不影响启动
- **API 兼容性**：配置变更不影响北向 API 契约

## Alternatives Considered

### 1. 使用 clap 进行 CLI 参数配置

- **拒绝理由**：服务端应用主要通过环境变量和配置文件管理配置，CLI 参数不适合容器化部署

### 2. 自定义配置解析

- **拒绝理由**：`config` crate 已是 Rust 生态事实标准，支持多层配置源合并，无需重复造轮

### 3. 使用 envy 直接从环境变量反序列化

- **拒绝理由**：不支持配置文件，且缺少与 `config` crate 同等的分层覆盖能力

## Verification

- 配置校验失败时服务拒绝启动并输出具体错误信息
- Secret 字段在 `Debug` / `Display` 输出中显示为 `***`
- 环境变量正确覆盖默认值和配置文件值
- `docker build -t koduck-ai:dev ./koduck-ai` 通过

## References

- 设计文档: [ai-decoupled-architecture.md](../../../docs/design/koduckai-rust-server/ai-decoupled-architecture.md) 第 9 节
- API 定义: [koduck-ai-api.yaml](../../../docs/design/koduckai-rust-server/koduck-ai-api.yaml)
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../../../docs/implementation/koduck-ai-rust-grpc-tasks.md) Task 1.2
- 前置 ADR: [ADR-0001](0001-init-rust-grpc-project-structure.md)
- 参考: `koduck-auth/src/config.rs`
- Issue: [#719](https://github.com/hailingu/koduck-quant/issues/719)
