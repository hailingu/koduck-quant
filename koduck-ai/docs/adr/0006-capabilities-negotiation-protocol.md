# ADR-0006: Capabilities 协商协议实现

- Status: Accepted
- Date: 2026-04-10
- Issue: #727

## Context

`koduck-ai` 在 Task 2.1 中已冻结了 memory/tool/llm 三个服务的 proto 契约（ADR-0004），Task 2.2 中已通过 `build.rs` 完成代码生成（ADR-0005）。所有三个服务均定义了 `GetCapabilities` RPC，返回 `koduck.contract.v1.Capability` 消息，包含 `service`、`contract_versions`、`features`、`limits` 字段。

### 问题

1. **启动时缺乏版本校验**：koduck-ai 启动后直接连接下游服务，未验证契约版本是否兼容。如果下游升级了不兼容的 proto 版本，运行时才会暴露错误
2. **能力信息不可知**：各服务的 `features`（支持的功能）和 `limits`（限制）对 orchestrator 不可见，无法做运行时决策（如选择检索策略、限制 token 数）
3. **无能力缓存机制**：每次需要能力信息都发起 RPC 调用不现实，但能力信息会随服务部署变化

### 现有参考

- Proto 定义: `proto/koduck/contract/v1/shared.proto` 中的 `Capability` 消息
- 各服务 proto 均定义 `rpc GetCapabilities(RequestMeta) returns (Capability)`
- 设计文档 6.4 描述了能力发现与版本协商机制

## Decision

### 1. CapabilityCache — TTL 缓存 + 异步刷新

在 `src/clients/` 下新建 `capability.rs`，实现 `CapabilityCache`：

```rust
pub struct CapabilityCache {
    memory: RwLock<Option<CachedCapability>>,
    tool: RwLock<Option<CachedCapability>>,
    llm: RwLock<Option<CachedCapability>>,
    ttl: Duration,
}
```

- 使用 `tokio::sync::RwLock` 实现读写分离，读不阻塞读
- `CachedCapability` 包含 `Capability` proto 消息 + `Instant` 过期时间
- 默认 TTL = 60s，可通过配置 `KODUCK_AI__CAPABILITIES__TTL_SECS` 覆盖

### 2. 启动阶段：并行拉取 + 版本校验 + Fail-Fast

启动时通过 `tokio::join!` 并行调用三个服务的 `GetCapabilities`：

```rust
pub async fn initial_negotiation(&self) -> Result<NegotiationResult, AppError>
```

- 超时配置为 `KODUCK_AI__CAPABILITIES__STARTUP_TIMEOUT_MS`（默认 5s）
- 获取到能力后写入缓存，日志输出各服务的 `contract_versions`
- 版本校验规则：检查 `contract_versions` 中是否包含 `v1`（当前支持的版本）
- 任一服务不兼容 -> 输出结构化告警（JSON 格式，包含 service、expected、actual）-> 进程 `exit(1)`

### 3. 运行阶段：后台 TTL 刷新

启动成功后 spawn 一个后台 tokio task，按 TTL 周期刷新：

```rust
pub fn spawn_refresh_task(&self, clients: CapableClients) -> JoinHandle<()>
```

- 使用 `tokio::time::sleep` 等待 TTL 到期后刷新
- 刷新失败仅记录 warn 日志，不影响已缓存数据和主请求处理（graceful degradation）
- 支持 graceful shutdown：通过 `shutdown_tx` broadcast channel 通知退出

### 4. 配置扩展

在 `Config` 中新增 `CapabilitiesConfig`：

```rust
pub struct CapabilitiesConfig {
    pub ttl_secs: u64,              // default: 60
    pub startup_timeout_ms: u64,    // default: 5000
    pub required_version: String,   // default: "v1"
    pub strict_mode: bool,          // default: true
}
```

- `strict_mode = true`：版本不兼容时拒绝启动
- `strict_mode = false`：版本不兼容时仅 warn 日志，允许启动（用于开发/调试）

## Consequences

### 正向影响

1. **启动即校验**：版本不兼容在启动阶段即可发现，而非运行时
2. **能力信息可观测**：日志输出各服务的 contract_versions/features/limits
3. **异步刷新不阻塞**：后台 task 独立运行，读缓存用 RwLock 读锁
4. **可配置的严格度**：生产环境 strict mode，开发环境可放宽

### 代价与风险

1. **启动延迟增加**：需等待三个服务的 GetCapabilities 响应（但并行调用，超时 5s）
2. **后台 task 生命周期管理**：需要正确处理 shutdown 信号，避免 task 泄漏
3. **缓存一致性**：TTL 窗口内下游服务能力变更不会被感知（可接受的 tradeoff）

### 兼容性影响

- **API 兼容性**：纯新增模块，不影响已有代码
- **配置兼容性**：新增 `capabilities` 配置段，所有字段有默认值
- **下游服务**：依赖下游正确实现 GetCapabilities RPC（如未实现则启动超时）

## Alternatives Considered

### 1. 每次请求前检查能力

- **方案**：在每次 gRPC 调用前先 GetCapabilities
- **拒绝理由**：增加每次请求延迟，且频繁调用下游能力接口不合理

### 2. 使用 Watch 流式推送能力变更

- **方案**：各服务实现 `WatchCapabilities` server-streaming RPC
- **拒绝理由**：增加 proto 复杂度，当前 TTL 轮询已满足需求；后续需要时可升级

### 3. 能力信息存储在外部 KV（etcd/Redis）

- **方案**：各服务将能力信息注册到 etcd/Redis，koduck-ai 从中读取
- **拒绝理由**：引入外部依赖，当前三个服务的 GetCapabilities RPC 已足够

## Verification

- 启动日志包含各服务的 `contract_versions`
- 模拟版本不兼容时进程拒绝启动并输出结构化告警
- 后台刷新 task 在 TTL 到期后执行刷新
- 关闭 refresh task 时无 panic/leak
- `docker build -t koduck-ai:dev ./koduck-ai` 编译通过

## References

- 设计文档: [ai-decoupled-architecture.md](../design/ai-decoupled-architecture.md)
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../implementation/koduck-ai-rust-grpc-tasks.md) Task 2.3
- 前置 ADR: [ADR-0004](0004-freeze-proto-contract-v1.md), [ADR-0005](0005-build-rs-and-code-generation.md)
- Issue: [#727](https://github.com/hailingu/koduck-quant/issues/727)
