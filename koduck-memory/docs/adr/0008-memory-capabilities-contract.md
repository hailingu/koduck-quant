# ADR-0008: 固化 koduck-memory 的 Capabilities 协议键集合

- Status: Accepted
- Date: 2026-04-12
- Issue: #802

## Context

Task 2.4 要求 `koduck-memory` 正式实现 `GetCapabilities`，并返回稳定的：

1. `service`
2. `contract_versions`
3. `features`
4. `limits`

在 Task 2.2 之前，服务虽然已经能响应 `GetCapabilities`，但仍有两个问题：

1. `features` 里的键以骨架占位为主，例如 `session_truth`、`append_mode`。
2. `limits` 只包含 `capabilities_ttl_secs` 等内部字段，尚未覆盖设计文档要求的检索边界。

这会导致 `koduck-ai` 虽然能拿到一个合法的 `Capability` 消息，但拿不到稳定、可约定的 memory 特性描述。

## Decision

### 使用设计文档定义的稳定 feature keys

`features` 至少返回：

1. `session_meta`
2. `query_memory`
3. `append_memory`
4. `summary`
5. `domain_first_search`
6. `summary_search`

这些键统一用字符串值 `"true"` 表示 capability 已暴露，可被 `koduck-ai` 直接按 map 读取。

同时保留额外实现细节键：

1. `append_mode = object_per_append`
2. `retrieve_policy.default = domain-first`
3. `summary_async = <bool>`

这样既满足设计文档的最小稳定集，也保留了当前实现的运行时细节。

### 使用可解析的字符串 limits

`limits` 至少返回：

1. `max_top_k`
2. `max_page_size`
3. `recommended_timeout_ms`

继续沿用 `Capability` 里的 `map<string, string>` 结构，不在 Task 2.4 引入更复杂的 typed limits，
避免对已经冻结的 shared proto 造成额外变动。

### 保持 contract version 最小稳定声明

`contract_versions` 继续明确返回：

1. `memory.v1`

`service` 继续固定为：

1. `memory`

这样可以与 `koduck-ai` 当前的启动期 capability negotiation 逻辑保持兼容。

## Consequences

### 正向影响

1. `koduck-ai` 在启动时能拿到稳定的 memory 功能清单。
2. design doc 中的 capability 协商要求第一次在服务实现里真正落地。
3. 后续 Task 3.x / 4.x 可以在不变更键名的前提下，把 `"true"` 对应能力逐步从骨架推进到真实实现。

### 权衡与代价

1. `features/limits` 仍然是字符串 map，调用方需要自行解析布尔值和数字。
2. `max_top_k`、`max_page_size`、`recommended_timeout_ms` 当前是服务内常量，未来如果要配置化还需要补配置项。

### 兼容性影响

1. 对外 proto 结构没有变化，只是约定了更稳定的键集合和值语义。
2. 已有 `GetCapabilities` 调用不会 break；调用方只会拿到更完整的 map 数据。

## Alternatives Considered

### 1. 保持当前占位键集合

- 未采用理由：与设计文档不一致，也无法给 `koduck-ai` 提供稳定的协商语义。

### 2. 把 features / limits 升级成 typed message

- 未采用理由：会触碰已冻结的共享 contract，超出 Task 2.4 范围。

### 3. 只返回设计文档要求的最小键，不保留实现细节

- 未采用理由：`append_mode` 与 `retrieve_policy.default` 对当前实现和排障仍然有价值。

## Verification

- `docker run --rm ... cargo test`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`
- `kubectl logs deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0006-generated-stub-exposure-and-startup-verification.md](./0006-generated-stub-exposure-and-startup-verification.md)
- Issue: [#802](https://github.com/hailingu/koduck-quant/issues/802)
