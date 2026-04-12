# ADR-0020: Koduck AI Capability 协商接入与版本校验修复

- Status: Accepted
- Date: 2026-04-12
- Issue: #829

## Context

Task 6.3 要求 `koduck-ai` 在启动时拉取 `GetCapabilities`，校验 `memory.v1` 契约版本，
并通过 TTL 后台刷新保持 capability 缓存更新。

当前 capability 协商框架（ADR-0006）已在 `koduck-ai` 中实现，
包括 TTL 缓存、后台刷新和版本兼容性检查。
但在实际对接 `koduck-memory` 后发现版本格式不匹配问题：

1. **版本格式不一致**：
   - `koduck-ai` 的 `CapabilitiesConfig.required_version` 默认为 `"v1"`
   - `koduck-memory` 按 ADR-0008 返回 `contract_versions: ["memory.v1"]`
   - 版本校验使用精确匹配 `v == required`，导致 `"memory.v1" != "v1"`
   - 在 strict mode 下会错误地拒绝启动

2. **NegotiationResult 未持久化**：
   - `initial_negotiation_mode_aware` 返回的 `NegotiationResult` 在调用后即被丢弃
   - 健康检查端点 `/healthz` 无法反映 capability 协商状态

3. **无 capability 协商指标**：
   - 协商成功/失败次数无法被观测
   - 与已有的 `MemoryObservePolicy`、`DegradePolicy` 指标体系不一致

## Decision

### 1. 版本校验改为后缀匹配

将 `collect_mismatches` 中的精确匹配改为后缀匹配：

```rust
fn version_matches(actual: &str, required: &str) -> bool {
    actual == required || actual.ends_with(&format!(".{required}"))
}
```

- `"v1"` 匹配 `"v1"`、`"memory.v1"`、`"tool.v1"`、`"llm.v1"`
- 保持向后兼容：如果未来某服务只返回 `"v1"` 仍然能匹配
- 配置 `required_version` 默认值保持 `"v1"` 不变

### 2. 在 CapabilityCache 中持久化协商状态

- 在 `CapabilityCache` 中新增 `negotiation_status: RwLock<NegotiationStatus>` 字段
- `NegotiationStatus` 包含各服务的协商结果（成功/失败/待协商）和时间戳
- 新增 `get_negotiation_status()` 方法供健康检查使用

### 3. 新增 CapabilityMetrics

遵循现有 `MemoryObservePolicy` 的 AtomicU64 + snapshot 模式：

- `capability_negotiation_total{service, status}` — 协商次数（startup + refresh）
- `capability_version_mismatch_total` — 版本不匹配次数

### 4. 健康检查暴露 capability 状态

在 `/healthz` 端点的响应中新增 `capabilities` 字段：

```json
{
  "status": "ok",
  "service": "koduck-ai",
  "version": "0.x.y",
  "capabilities": {
    "memory": "ok",
    "tool": "ok",
    "llm": "ok"
  }
}
```

## Consequences

### 正向影响

1. 版本校验能正确识别 `memory.v1` 格式，不再因格式差异错误拒绝启动
2. 健康检查能反映 capability 协商状态，便于运维快速定位
3. 协商指标纳入现有观测体系，可被 `/metrics` 端点统一采集
4. 后缀匹配向后兼容，不影响只返回 `"v1"` 格式的服务

### 代价与约束

1. 后缀匹配可能过于宽松——如果某服务返回 `"foo.v1"` 但并非预期服务，
   也会被误认为兼容。不过当前只有三个已知服务，风险可控
2. `CapabilityCache` 新增状态字段增加了少量内存开销
3. 健康检查响应结构变化属于向后兼容增强，不影响现有监控

### 兼容性影响

1. 不修改 `memory.v1` protobuf 定义
2. `CapabilitiesConfig.required_version` 默认值保持 `"v1"` 不变
3. 健康检查新增字段为可选，旧客户端不受影响
4. 新增指标为纯增量，不影响已有 `/metrics` 数据结构

## Alternatives Considered

### Alternative A: 修改 `required_version` 默认值为 `"memory.v1"`

未采用。单一 `required_version` 无法同时匹配三个不同服务（memory/tool/llm）
的不同版本前缀。改为 per-service 配置会增加配置复杂度。

### Alternative B: 改为 per-service required_version 配置

未采用。需要新增 `memory_required_version`、`tool_required_version`、
`llm_required_version` 三个配置项，增加配置负担。后缀匹配在当前场景下更简洁。

### Alternative C: 由各服务统一返回 `"v1"` 而非 `"{service}.v1"`

未采用。`"memory.v1"` 已在 ADR-0008 中确认并部署，修改需要协调多方。

## Verification

- 单元测试：验证 `version_matches("memory.v1", "v1")` 返回 true
- 单元测试：验证 `version_matches("v2", "v1")` 返回 false
- 单元测试：验证健康检查包含 capabilities 状态
- `docker build -t koduck-ai:dev ./koduck-ai` 编译通过
- `kubectl rollout restart deployment/dev-koduck-ai -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-ai -n koduck-dev --timeout=180s`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md) Task 6.3
- 前序 ADR: [ADR-0006](../../../koduck-ai/docs/adr/0006-capabilities-negotiation-protocol.md), [ADR-0008](./0008-memory-capabilities-contract.md), [ADR-0019](./0019-koduck-ai-memory-southbound-integration.md)
- Issue: [#829](https://github.com/hailingu/koduck-quant/issues/829)
