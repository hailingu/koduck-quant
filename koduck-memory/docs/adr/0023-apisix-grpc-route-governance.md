# ADR-0023: APISIX gRPC Route 与治理

- Status: Accepted
- Date: 2026-04-12
- Issue: #837

## Context

`koduck-ai` 作为 AI Gateway/Orchestrator，需要通过 APISIX southbound gRPC 路由访问 `koduck-memory` 服务。
设计文档（Section 13.2）明确要求：

- APISIX upstream: `memory-grpc`（实际命名为 `ai-memory-grpc`，与 tool/grpc 等 southbound 服务保持 `ai-` 前缀一致）
- route: `ai-memory-grpc`
- gRPC 治理、超时、重试预算、access log、trace 透传统一由 APISIX 承担

当前 APISIX route-init Job 中已注册了 `ai-memory-grpc` upstream 和 `ai-memory-grpc-route` route，
但需要增强治理能力以满足设计文档的完整要求：

1. **超时控制**：需要明确的 APISIX 层级超时，作为 gRPC `deadline_ms` 的安全兜底
2. **轻重试**：需要仅在 transport error 上重试，业务语义错误禁止重试
3. **Trace 透传**：需要 OpenTelemetry 插件 + header 注入实现端到端 trace
4. **Access log**：需要结构化 JSON 日志，包含 trace ID、latency、gRPC 状态等字段
5. **速率限制**：需要防止 memory-service 被过载

## Decision

我们在 APISIX route-init Job 中增强 `ai-memory-grpc` upstream 和 route 的治理配置：

### 1. Upstream 治理

```json
{
  "name": "ai-memory-grpc",
  "type": "roundrobin",
  "scheme": "grpc",
  "retries": 1,
  "timeout": {
    "connect": 1,
    "send": 5,
    "read": 65
  },
  "nodes": {
    "<env>-koduck-memory-grpc:50051": 1
  }
}
```

**决策说明**：

- `scheme: "grpc"`：APISIX 原生 gRPC 代理，不使用 grpc-transcode
- `retries: 1`：轻量级重试，仅在 transport error（连接失败、超时、5xx）上触发一次重试
  - APISIX 默认重试策略为 5xx 和连接错误，不重试 4xx
  - 对于 gRPC，APISIX 将 gRPC 状态码映射到 HTTP 状态码后应用相同逻辑
- `timeout.read: 65`：读超时 65s，覆盖所有 RPC 类型
  - `GetSession / GetCapabilities` 通常在 100ms 内完成
  - `QueryMemory` 可能因候选集较大需要更长时间
  - `AppendMemory` 涉及数据库写入 + 对象存储写入
  - V1 使用统一 read timeout，后续可按 RPC 拆分 upstream

### 2. Route 治理插件

```json
{
  "uri": "/koduck.memory.v1.MemoryService/*",
  "priority": 200,
  "plugins": {
    "limit-count": { "count": 600, "time_window": 60 },
    "limit-req": { "rate": 120, "burst": 60 },
    "opentelemetry": { "sampler": { "name": "always_on" } },
    "proxy-rewrite": { "headers": { "set": { "X-Request-Id", "X-Trace-Id", "traceparent", ... } } }
  },
  "upstream_id": "ai-memory-grpc"
}
```

**插件职责**：

| 插件 | 职责 | 说明 |
|------|------|------|
| `limit-count` | 全局速率限制 | 600 req/min，防止单 route 过载 |
| `limit-req` | 突发保护 | 120 req/s + 60 burst，吸收瞬时流量 |
| `opentelemetry` | 分布式 trace | always_on 采样，确保 gRPC 调用可追踪 |
| `proxy-rewrite` | Header 注入 | 透传 request_id / trace_id / session_id / user_id / tenant_id |

### 3. Access Log 增强

在 APISIX nginx_config 中增强 access log 格式，增加 latency 字段：

```
upstream_response_time — 后端处理耗时（ms）
request_time — 总请求耗时（ms，含 APISIX 处理）
```

这些字段为 Task 8.3 的 SLO 监控提供数据基础。

### 4. Trace 透传链路

```
koduck-ai → APISIX → koduck-memory
     │           │           │
     │   opentelemetry       │
     │   proxy-rewrite       │
     │   (X-Trace-Id,        │
     │    traceparent)       │
     └───────────────────────┘
         统一 trace context
```

APISIX 通过 `opentelemetry` 插件生成/传播 trace context，
通过 `proxy-rewrite` 将 `X-Trace-Id` 和 `traceparent` 注入到 gRPC metadata 中，
`koduck-memory` 从 metadata 中提取并纳入日志和 metrics。

## Consequences

正面影响：

1. `koduck-ai` 通过 APISIX 统一治理入口访问 memory-service，符合 southbound 架构约束
2. 超时控制作为 gRPC `deadline_ms` 的安全兜底，防止无限等待
3. 轻量级重试仅针对 transport error，不会导致业务语义重复（幂等由 `idempotency_key` 保证）
4. 结构化 access log 包含 trace ID 和 latency，支持审计与排障
5. 速率限制防止 memory-service 被过载

代价与权衡：

1. 统一 read timeout 65s 对快速 RPC（GetSession）来说过长，但 V1 不拆分 upstream，后续可优化
2. `retries: 1` 意味着最坏情况下总耗时可达 130s（65s * 2），但实际 transport error 重试通常在秒级
3. `opentelemetry` 采样率 `always_on` 在高流量场景下会产生大量 trace 数据，prod 可考虑按比例采样
4. `limit-count` 和 `limit-req` 的阈值需要根据实际流量调整

## Compatibility Impact

1. 不修改 `memory.v1` protobuf，不增加 breaking change
2. Upstream 和 route 通过 APISIX Admin API 注册，不影响 koduck-memory 服务本身
3. Access log 格式变更为向后兼容增强（新增字段，不删除现有字段）
4. 现有 dev/prod 环境的 APISIX route-init Job 会通过 `upsert_resource` 原子更新配置

## Alternatives Considered

### Alternative A: 按 RPC 拆分 upstream

为 GetSession/QueryMemory/AppendMemory 等不同 RPC 创建独立 upstream，配置不同超时和重试策略。

未采用。
V1 阶段 RPC 数量有限，拆分 upstream 增加运维复杂度，收益不明显。
后续如果发现统一超时确实不够用，再拆分。

### Alternative B: 使用 grpc-transcode 做 HTTP↔gRPC 转换

未采用。
`koduck-ai` 作为 gRPC 客户端直接调用 memory-service，不需要 HTTP↔gRPC 转换。
grpc-transcode 插件仅保留在 APISIX 插件列表中供未来使用。

### Alternative C: 在 koduck-memory 内部实现重试

未采用。
设计文档明确要求 "gRPC 治理统一由 APISIX 承担"。
在 APISIX 层做 transport-level 重试比在服务内部更合理：
- 避免客户端已经超时后服务还在重试
- 统一治理策略，不需要每个服务单独配置
