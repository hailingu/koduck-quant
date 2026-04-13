# ADR-0018: HYBRID 检索策略保留为后续扩展

- Status: Accepted
- Date: 2026-04-12
- Issue: #823

## Context

Task 5.4 要求确保 `HYBRID` 检索策略被保留为后续扩展，V1 主链路不依赖它。

在 Task 5.2 和 Task 5.3 完成后，`retrieve/` 模块已实现：
- `DOMAIN_FIRST` (policy=1)：按 domain_class 过滤
- `SUMMARY_FIRST` (policy=2)：在 domain_class 候选集内使用 summary 筛选

proto 定义中 `RetrievePolicy` 包含 `HYBRID = 3`，但 V1 不实现该策略。

需要解决：
1. 如何确保配置文件中默认策略不是 HYBRID。
2. 如何确保代码中 HYBRID 有适当的回退处理。
3. 如何文档化 HYBRID 是保留给 V2 的扩展点。

## Decision

### 默认策略配置

配置文件 `config/default.toml` 中：
```toml
[index]
mode = "domain-first"  # 明确使用 DOMAIN_FIRST 作为默认
```

已确认当前配置符合此要求。

### 代码中的 HYBRID 处理

`MemoryGrpcService::query_memory` 中：
- policy=0 (UNSPECIFIED) → 回退到 DOMAIN_FIRST
- policy=1 (DOMAIN_FIRST) → 使用 DomainFirstRetriever
- policy=2 (SUMMARY_FIRST) → 使用 SummaryFirstRetriever
- policy=3 (HYBRID) → 回退到 DOMAIN_FIRST（并记录警告日志）
- policy>3 → 回退到 DOMAIN_FIRST

已在 Task 5.3 实现中通过 `_ =>` 匹配处理此情况。

### Capability 声明

`GetCapabilities` 返回的 features 中：
- `retrieve_policy.default` = `"domain-first"`
- 不声明 `hybrid` 为支持的特性

### 文档说明

在代码和 ADR 中明确说明：
- HYBRID (policy=3) 保留给 V2 实现
- V1 主链路完全基于 DOMAIN_FIRST 和 SUMMARY_FIRST
- HYBRID 将实现更复杂的混合检索策略（如结合向量检索、关键词检索等）

## Consequences

### 正向影响

1. V1 主链路稳定，不依赖未实现的 HYBRID 策略。
2. HYBRID 作为明确的扩展点保留，V2 可无缝引入。
3. 客户端可以通过 capability 检测到 HYBRID 不被支持。

### 权衡与代价

1. 当前 HYBRID 请求会静默回退到 DOMAIN_FIRST，客户端可能无法感知。
2. 需要在 V2 开发时重新评估 HYBRID 的具体实现方案。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 客户端请求 HYBRID 时获得的结果质量可能低于预期（因为回退了）。

## Alternatives Considered

### 1. 返回错误当请求 HYBRID

- 未采用理由：fail-open 原则，回退到 DOMAIN_FIRST 比直接失败更友好。

### 2. 在 V1 中实现简化版 HYBRID

- 未采用理由：设计文档明确 HYBRID 不在 V1 范围内，避免过度设计。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 任务清单: [koduck-memory-service-tasks.md](../implementation/koduck-memory-service-tasks.md)
- 前序 ADR: [0017-summary-first-implementation.md](./0017-summary-first-implementation.md)
- Issue: [#823](https://github.com/hailingu/koduck-quant/issues/823)
