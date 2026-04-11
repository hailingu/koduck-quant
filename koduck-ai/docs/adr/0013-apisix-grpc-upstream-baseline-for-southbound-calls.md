# ADR-0013: 为 koduck-ai southbound gRPC 调用建立 APISIX 基线治理

- Status: Accepted
- Date: 2026-04-11
- Issue: #744

## Context

根据 `koduck-ai/docs/design/ai-decoupled-architecture.md` 第 6.4 节和附录 C：

1. `koduck-ai` 到 memory/tool/llm 的 southbound gRPC 调用需要统一经过 APISIX。
2. 网关侧需要提供统一的 connect/send/read timeout、轻重试、keepalive 和熔断阈值。
3. 路由初始化脚本必须具备回滚能力，避免 route/upstream 半更新后留下不一致状态。

在 Task 6.1 开始前，当前仓库存在三个问题：

- `k8s/overlays/dev/koduck-ai.yaml` 仍然把 memory/tool/llm 直接指到下游服务，而不是 APISIX。
- `k8s/overlays/dev/apisix-route-init.yaml` 与 `k8s/overlays/prod/apisix-route-init.yaml` 只有 northbound HTTP 路由，没有 southbound gRPC upstream/route。
- route init 脚本对新增 gRPC 资源没有失败回滚机制，不满足“路由变更可回滚”的验收要求。

## Decision

本次在 APISIX 侧为 `koduck-ai` 建立独立的 gRPC upstream/route 基线，并让 dev 环境的 `koduck-ai` southbound target 统一改指向 APISIX data plane。

### 1. `koduck-ai` southbound target 统一走 APISIX

在 dev overlay 中，将以下三个环境变量全部改为 `http://dev-apisix-gateway:9080`：

- `KODUCK_AI__MEMORY__GRPC_TARGET`
- `KODUCK_AI__TOOLS__GRPC_TARGET`
- `KODUCK_AI__LLM__ADAPTER_GRPC_TARGET`

这样 `koduck-ai` 发起的 gRPC 请求会统一先命中 APISIX，再由 APISIX 根据 gRPC `:path` 分发到具体 upstream。

### 2. 为 memory/tool/llm 建立独立 gRPC upstream

在 dev/prod 的 APISIX route init job 中新增 4 个 upstream：

- `ai-memory-grpc`
- `ai-tool-grpc`
- `ai-llm-grpc`
- `ai-llm-stream-grpc`

其中：

- memory/tool/llm 普通 unary 调用统一使用 `connect=1s`、`send=5s`、`read=65s`
- LLM 流式调用单独使用 `read=310s`
- 所有 upstream 统一使用：
  - `retries=1`
  - `keepalive_pool.size=256`
  - passive TCP health check 作为轻量熔断阈值

### 3. 用 gRPC service path 做路由分流

新增 4 条 APISIX route：

- `/koduck.memory.v1.MemoryService/*`
- `/koduck.tool.v1.ToolService/*`
- `/koduck.llm.v1.LlmService/*`
- `/koduck.llm.v1.LlmService/StreamGenerate`

其中 `StreamGenerate` 使用更高优先级，命中单独的长读超时 upstream。

### 4. gRPC route/upstream 变更支持失败回滚

对本次新增的 gRPC upstream/route，route init 脚本在写入前先读取现有资源：

- 若资源不存在，记录为 `created`
- 若资源已存在，备份旧配置为 `updated`

脚本异常退出时：

- 删除本次新建的 gRPC route/upstream
- 尝试恢复本次更新前的 gRPC route/upstream 旧配置

这样可以把回滚范围收敛在 Task 6.1 新增的资源上，而不影响既有 northbound HTTP 路由。

## Consequences

### 正向影响

1. **southbound gRPC 治理收口**：timeout、retry、keepalive 和熔断阈值不再散落在各调用方。
2. **LLM 流式与非流式分离治理**：避免普通 unary 调用继承过长 `read timeout`。
3. **回滚半径可控**：失败时只回滚本次新增的 gRPC 资源，不触碰现有 northbound HTTP 规则。

### 代价与风险

1. **APISIX route init 脚本复杂度上升**：新增了资源备份与回滚逻辑。
2. **memory/tool 服务仍是占位服务名**：当前仓库尚未引入对应 k8s 基础资源，本次只完成网关 IaC 和 `koduck-ai` 接入点治理。
3. **rollback 依赖 APISIX Admin API 返回结构**：当前恢复逻辑基于 Admin API 读取已有资源的 `value` 字段。

### 兼容性影响

- **dev 环境行为变化**：`koduck-ai` southbound gRPC 将不再直连下游，而是统一经过 APISIX。
- **prod 环境向前兼容**：本次先预埋 prod 的 route/upstream IaC，不强行引入新的 prod `koduck-ai` deployment overlay。

## Alternatives Considered

### 1. 继续让 `koduck-ai` 直连下游服务

- **拒绝理由**：无法满足 Task 6.1 “gRPC 请求全部经过 APISIX”的验收标准，也无法统一执行附录 C 的超时/重试基线。

### 2. 只建立一个统一的 `ai-grpc` upstream

- **拒绝理由**：memory/tool/llm 的 timeout 需求不同，尤其 LLM 流式调用需要独立的长读超时，不适合全部复用同一个 upstream。

### 3. 让 route init 的回滚覆盖全部 APISIX 资源

- **拒绝理由**：现有 northbound HTTP 路由不属于 Task 6.1 改动范围，扩大回滚半径会增加误伤风险。
