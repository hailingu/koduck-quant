# ADR-0024: RPC 可观测性与 SLO

- Status: Accepted
- Date: 2026-04-12
- Issue: #841

## Context

设计文档（Section 13.4）明确要求为关键 RPC 增加可观测性能力：

- **指标**：`memory_rpc_requests_total`、`memory_rpc_latency_ms`、`memory_query_hits_count` 等
- **维度**：`rpc`、`status`、`retrieve_policy`、`domain_class`、`tenant`
- **日志**：必须包含 `request_id`、`session_id`、`trace_id`、`user_id`、`tenant_id`、`rpc`、`latency_ms`
- **SLO**：定义基础 SLO 与错误预算

当前实现状态：

- 已有 `/metrics` 端点暴露 Prometheus 格式的指标（build_info、postgres pool、retry/failure counters）
- 已有 `tracing-subscriber` JSON 日志输出
- 缺少 **per-RPC 维度的请求计数和延迟指标**
- 缺少 **RPC handler 中的结构化日志字段**
- 缺少 **SLO 定义**

## Decision

### 1. 指标方案

在现有手写 Prometheus 格式的基础上，增加 per-RPC 指标：

```
memory_rpc_requests_total{rpc="get_session",status="ok"} 42
memory_rpc_requests_total{rpc="get_session",status="error"} 1
memory_rpc_duration_ms_bucket{rpc="get_session",le="1"} 10
memory_rpc_duration_ms_bucket{rpc="get_session",le="5"} 38
...
memory_rpc_duration_ms_sum{rpc="get_session"} 230.5
memory_rpc_duration_ms_count{rpc="get_session"} 42
```

**实现方式**：

- 使用 `std::sync::Mutex<HashMap>` 实现轻量级 histogram buckets，保持与现有方案一致（不引入 Prometheus client 库）
- 提供 `RpcMetrics` 结构体，封装 `record()` 方法，在 RPC handler 的入口和出口调用
- 指标通过现有 `metrics_handler` 的 `/metrics` 端点暴露

**Histogram buckets**: `[1, 5, 10, 25, 50, 100, 250, 500, 1000, +Inf]` ms

### 2. 结构化日志

在每个 RPC handler 中使用 `tracing::info!` / `tracing::warn!` 记录结构化字段：

```rust
tracing::info!(
    rpc = "get_session",
    request_id = %meta.request_id,
    session_id = %meta.session_id,
    tenant_id = %meta.tenant_id,
    user_id = %meta.user_id,
    trace_id = %meta.trace_id,
    latency_ms = elapsed.as_millis() as u64,
    status = "ok",
    "rpc completed"
);
```

### 3. SLO 定义

| SLO | 目标 | 说明 |
|-----|------|------|
| Availability | >= 99.9% | 月度可用性 |
| p50 latency (GetSession) | <= 10ms | 读取类 RPC |
| p99 latency (GetSession) | <= 50ms | |
| p50 latency (QueryMemory) | <= 50ms | 检索类 RPC |
| p99 latency (QueryMemory) | <= 500ms | |
| p50 latency (AppendMemory) | <= 100ms | 写入类 RPC |
| p99 latency (AppendMemory) | <= 2000ms | |
| Error rate | <= 0.1% | 非客户端错误 |

SLO 仅作文档记录，不引入 alerting 代码。

## Consequences

正面影响：

1. 运维可通过 `/metrics` 端点实时监控 RPC 延迟和错误率
2. 结构化日志支持按 request_id / trace_id 快速排障
3. SLO 定义为后续告警规则提供基线
4. 不引入外部依赖，保持现有 Prometheus 手写格式的一致性

代价与权衡：

1. 手写 histogram 不如 Prometheus client 库精确（无分位计算），但满足 V1 需求
2. Metrics 数据存储在内存中，进程重启后清零，但符合 Prometheus pull 模型的预期

## Compatibility Impact

1. 不修改 `memory.v1` protobuf，不增加 breaking change
2. `/metrics` 端点新增指标行，不影响现有 Prometheus scrape 配置
3. 日志新增字段为向后兼容增强（JSON 格式新增 key，不删除现有 key）

## Alternatives Considered

### Alternative A: 引入 prometheus-client Rust 库

未采用。现有项目已使用手写 Prometheus 格式，保持一致性优先。后续可迁移。

### Alternative B: 使用 tonic gRPC interceptor 自动采集 metrics

未采用。tonic 0.11 的 interceptor 功能有限，手动在 handler 中采集更灵活，可携带业务语义标签。
