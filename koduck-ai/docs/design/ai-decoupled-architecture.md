# Koduck AI 解耦架构设计（V2）

## 1. 文档目的与范围

本文档定义 `koduck-ai` 的 V2 解耦架构，目标是把其从“内聚过多能力的 AI 服务”收敛为“AI Gateway / Orchestrator”。

本文档覆盖：

- 服务边界（做什么 / 不做什么）
- 交互架构（统一经 APISIX）
- 运行时能力（SSE 可靠性、错误与降级、SLO 与容量）
- 配置与安全（Secret）
- 迁移路径与验收标准

本文档不覆盖：

- `koduck-memory-service` 内部存储实现细节
- `koduck-tool-service` 内部执行引擎实现细节
- 具体模型提示词工程与业务规则细节

---

## 2. 结论先行

V2 的核心结论如下：

1. `koduck-ai` 只做 AI 网关与编排，不内置 Memory/Tool 业务实现。
2. `koduck-memory-service` 与 `koduck-tool-service` 均为独立服务。
3. 前端到 AI、AI 到下游服务的调用，默认统一经过 APISIX（内部 east-west 统一 gRPC）。
4. `koduck-ai` 内部治理保持最小闭环：`auth`、`logging`、`trace`。
5. 限流优先由 APISIX 承担；`koduck-ai` 负责自身重试预算、错误映射、降级语义与 SLO。
6. LLM URL/API Key 作为 Secret 管理，不再作为独立“组件”设计。

---

## 3. 设计原则

- 单一职责：网关编排与业务能力服务分离。
- 统一入口：流量治理能力集中在 APISIX。
- 契约优先：先稳定接口契约，再拆分实现。
- 可观测优先：所有关键链路可追踪、可统计、可复盘。
- 渐进演进：先兼容、再替换、最后下线旧路径。

---

## 4. 边界定义（强约束）

### 4.1 `koduck-ai` 负责

- 对话编排（chat / stream / 上下文拼装）
- 模型路由与多提供商调用适配
- SSE 输出与会话内流控
- 对外统一错误语义、降级语义、重试预算
- SLO 目标定义与容量保护策略

### 4.2 `koduck-ai` 不负责

- 记忆数据持久化、记忆索引构建与检索实现
- 工具注册、执行引擎、工具权限策略实现
- 认证中心能力本身（由 `koduck-auth` 提供）

### 4.3 其他服务边界

| 服务 | 负责 | 不负责 |
|------|------|--------|
| `koduck-memory-service` | 会话元数据管理、记忆存储与检索、摘要/标签生产 | AI 编排 |
| `koduck-tool-service` | 工具注册表、执行调度、工具权限策略 | 会话记忆持久化 |
| `koduck-auth` | JWT/JWKS 认证能力 | AI 业务编排 |
| `APISIX` | 路由、限流、统一 access log、trace 透传 | 业务语义决策 |

### 4.4 会话元数据归属

会话元数据（如 `session_id`、`title`、`status`、`last_message_at`）统一归 `koduck-memory-service` 管理；`koduck-ai` 仅在编排链路中读取/写入必要元数据，不持有其最终真值。

---

## 5. 目标架构

### 5.1 逻辑拓扑

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend/BFF                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                               APISIX 网关                               │
│   认证透传/校验    路由与协议治理    限流策略    Access Log    Trace透传 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      koduck-ai (AI Gateway)                      │
│   Orchestrator / Stream Engine / LLM Router / Error-SLO Guard          │
└─────────────────────────────────────────────────────────────────────────┘
          │                   │                   │                   │
          ▼                   ▼                   ▼                   ▼
  APISIX -> koduck-auth  APISIX -> koduck-memory-service  APISIX -> koduck-tool-service  LLM Egress
                              │                                                       │
                              ▼                                                       ▼
                   L0(.jsonl@S3/MinIO) + L1(index@DB)                (optional) LLM Adapter Service / Bridge
                                                                                      │
                                                                                      ▼
                                                                  External LLM Providers (provider-native HTTP)
```

### 5.2 关键调用路径

- 北向：`Frontend -> APISIX -> koduck-ai`
- 南向：`koduck-ai -> APISIX(gRPC route) -> {koduck-auth / koduck-memory-service / koduck-tool-service}`
- 外部模型：`koduck-ai -> LLM Provider`
- 迁移期可选：`koduck-ai -> LLM Adapter -> LLM Provider`

### 5.3 旁路策略

默认不允许绕过 APISIX。若未来出现性能旁路需求，必须以 ADR 形式评审并定义回滚开关。

---

## 6. 接口与协议策略

### 6.1 北向接口（对前端）

保留兼容接口：

- `POST /api/v1/ai/chat`
- `POST /api/v1/ai/chat/stream`

约束：

- 路径与事件语义保持兼容
- 前端访问入口统一经 APISIX

### 6.2 南向接口（对内部服务）

- 内部服务通信统一使用 gRPC（HTTP/2）。
- APISIX 统一承担 gRPC 路由、治理与可观测入口。
- 禁止新增 HTTP JSON 内部契约；历史 HTTP 仅允许在迁移窗口内保留。

### 6.3 SSE 事件规范（对流式能力）

建议标准事件字段：

- `event_id`
- `sequence_num`
- `event_type`
- `payload`
- `request_id`
- `session_id`

重连参数：

- `Last-Event-ID`
- `from_sequence_num`

### 6.4 可插拔交互协议（memory/tool）

本节定义 `koduck-ai` 与下游能力服务的统一交互协议，用于支持“实现可插拔、语义不混淆”。

原则：

- `memory` 是 first-class service contract，不作为普通 tool 对待。
- `tool` 是插件化能力 contract，可扩展注册和执行实现。
- 两者共享协议骨架（便于治理），但保留独立语义（避免边界漂移）。

#### 6.4.1 统一协议骨架（Shared Envelope）

所有南向请求建议采用统一信封字段：

- `request_id`：全局请求 ID（必填）
- `session_id`：会话 ID（按场景必填）
- `user_id`：用户标识（必填）
- `trace_id`：链路追踪 ID（必填）
- `tenant_id`：租户标识（多租户场景必填）
- `idempotency_key`：幂等键（写操作建议必填）
- `deadline_ms`：剩余时间预算（由 ai-server 统一下发）
- `api_version`：契约版本（如 `memory.v1` / `tool.v1`）

统一响应建议包含：

- `ok`：是否成功
- `code`：标准错误码或 `OK`
- `message`：错误说明
- `request_id`：回传请求 ID
- `retryable`：是否可重试
- `provider`：下游服务标识（如 `memory` / `tool`）

#### 6.4.2 能力发现与版本协商（gRPC）

`memory-service` 与 `tool-service` 均应提供统一能力发现 RPC：

- `rpc GetCapabilities(GetCapabilitiesRequest) returns (GetCapabilitiesResponse)`

返回建议：

- `service`：`memory` 或 `tool`
- `contract_versions`：支持的契约版本列表
- `features`：能力开关（如 `keyword_search`、`summary_similarity`、`tool_streaming`）
- `limits`：能力上限（QPS、payload、timeout 建议值）

`koduck-ai` 启动时拉取并缓存能力，运行时按 TTL 刷新；版本不兼容时快速失败并给出可观测告警。

#### 6.4.3 Memory Contract（first-class, gRPC）

推荐最小 RPC 集合：

- `rpc UpsertSessionMeta(UpsertSessionMetaRequest) returns (UpsertSessionMetaResponse)`
- `rpc GetSession(GetSessionRequest) returns (GetSessionResponse)`
- `rpc QueryMemory(QueryMemoryRequest) returns (QueryMemoryResponse)`
- `rpc AppendMemory(AppendMemoryRequest) returns (AppendMemoryResponse)`
- `rpc SummarizeMemory(SummarizeMemoryRequest) returns (SummarizeMemoryResponse)`（可异步）

`QueryMemory` 输入建议：

- `query_text`
- `session_id`（可选）
- `tags`（可选，多值）
- `top_k`
- `retrieve_policy`：`keyword_first` / `summary_first` / `hybrid`

`QueryMemory` 输出建议：

- `hits[]`：`session_id`、`l0_uri`、`score`、`match_reasons`（如 `tag_hit`、`keyword_hit`、`summary_hit`）
- `next_page_token`（可选）

约束：

- 会话元数据真值只在 memory-service。
- 检索策略由 memory-service 负责演进，ai-server 仅声明偏好策略，不固化算法。

#### 6.4.4 Tool Contract（plugin-style, gRPC）

推荐最小 RPC 集合：

- `rpc ListTools(ListToolsRequest) returns (ListToolsResponse)`
- `rpc ExecuteTool(ExecuteToolRequest) returns (ExecuteToolResponse)`
- `rpc ExecuteToolStream(ExecuteToolRequest) returns (stream ExecuteToolStreamEvent)`（可选）
- `rpc ValidateToolInput(ValidateToolInputRequest) returns (ValidateToolInputResponse)`（可选）

`ListTools` 输出建议：

- `tools[]`：`name`、`version`、`input_schema`、`output_schema`、`timeout_ms`、`permission_scope`

`ExecuteTool` 输入建议：

- `tool_name`
- `tool_version`（可选，不填表示 latest compatible）
- `arguments`（JSON）
- `execution_mode`：`sync` / `async`

约束：

- tool-service 负责工具注册、选择、执行与权限校验。
- ai-server 负责编排、超时预算和统一错误映射，不内嵌工具业务实现。

#### 6.4.5 超时、重试、幂等约定

- ai-server 为每次下游调用下发 `deadline_ms`，下游必须尊重预算并尽快失败。
- 写操作（memory append、tool execute 非幂等动作）使用 `idempotency_key` 去重。
- 可重试仅限显式可重试错误（`429/5xx/网络错误`）；业务语义错误禁止重试。

#### 6.4.6 插件化验收标准（可插拔落地）

满足以下条件即视为“可插拔”：

- 新增一个 memory/tool 实现，不改 ai-server 编排代码，仅改配置与路由。
- 新实现通过 `capabilities + contract` 兼容性检查。
- 统一错误与指标字段不变，灰度和回滚路径可用。

### 6.5 LLM Contract（provider-agnostic）

`koduck-ai` 对模型调用采用统一 LLM 契约，屏蔽厂商差异。对内以 gRPC 契约表达；对外由适配层转换为各厂商原生 HTTP API。

推荐最小 RPC 集合：

- `rpc Generate(GenerateRequest) returns (GenerateResponse)`
- `rpc StreamGenerate(GenerateRequest) returns (stream StreamGenerateEvent)`
- `rpc CountTokens(CountTokensRequest) returns (CountTokensResponse)`
- `rpc ListModels(ListModelsRequest) returns (ListModelsResponse)`（可选）

`GenerateRequest` 关键字段建议：

- `model`
- `messages[]`（role/content）
- `temperature`、`top_p`、`max_tokens`
- `tools[]`（可选）
- `response_format`（可选）
- `request_id`、`trace_id`、`deadline_ms`

`StreamGenerateEvent` 关键字段建议：

- `event_id`
- `sequence_num`
- `delta`
- `finish_reason`（结束事件）
- `usage`（结束事件可选）

错误语义约束：

- 适配层必须把厂商错误归一到本设计定义的标准错误码集合。
- 对 `429` 优先传递 `retry_after_ms`。
- 超时必须区分“上游超时”与“本地预算耗尽”。

说明：

- “统一使用 gRPC”适用于内部服务契约与平台内部适配层接口。
- 外部 LLM 厂商接口仍以其原生 HTTP 协议为准，由适配层负责转换。

---

## 7. 运行时能力（koduck-ai）

### 7.1 最小治理能力

`koduck-ai` 内只保留：

- `auth`：对接 `koduck-auth` 的 token 校验能力
- `logging`：结构化日志
- `trace`：trace/span 上下文透传与关联

不在服务内首期实现复杂中间件栈与主限流逻辑。

### 7.2 流式可靠性

- 传输抽象：支持 `Transport` 抽象（至少 SSE，可扩展 WS）
- 去重续流：按 `sequence_num` 高水位去重，支持断点续流
- 顺序与背压：写路径串行批处理，避免乱序与失控堆积
- 取消语义：支持 cancel/interrupt；引入 generation 防旧请求覆盖
- 生命周期：统一 `AbortSignal + timeout + cleanup` 封装
- 优雅停机：停止新请求、排空队列、有界清理、超时 failsafe 退出

### 7.3 错误与降级责任

#### 7.3.1 统一错误结构

对外错误建议统一为：

- `code`
- `message`
- `request_id`
- `retryable`
- `upstream`
- `retry_after_ms`（可选）

#### 7.3.2 错误映射基线

- `401/403` -> `AUTH_FAILED`（不可重试）
- `404` -> `RESOURCE_NOT_FOUND`（不可重试）
- `429` -> `RATE_LIMITED`（可重试）
- `5xx/网络超时` -> `UPSTREAM_UNAVAILABLE`（可重试）
- 参数校验失败 -> `INVALID_ARGUMENT`（不可重试）

#### 7.3.3 降级规则

- 是否允许降级由 `koduck-ai` 配置开关控制
- 触发条件：上游超时、重试预算耗尽、关键依赖熔断打开
- 降级响应必须显式标记 `degraded=true`
- 禁止把降级结果伪装为完整成功

#### 7.3.4 重试预算归属

`koduck-ai` 统一维护：

- 最大重试次数
- 单请求总超时预算
- 可重试错误白名单

APISIX 的限流与网关重试不替代服务内业务语义重试预算。

### 7.4 SLO 与容量责任

#### 7.4.1 首版目标

- `chat`（非流式）P95 延迟：`<= 8s`
- `chat/stream` 首 token P95：`<= 3s`
- 流中断率：`<= 1%`
- 并发 SSE 连接上限：按环境配置（示例：dev 200 / prod 5000）
- 单请求 token 上限：按模型与租户策略配置
- 单 SSE 最大时长：建议 `<= 5min`

#### 7.4.2 超限保护行为

- 并发超限：返回 `RATE_LIMITED` 或 `SERVER_BUSY`
- token 超限：返回 `TOKEN_BUDGET_EXCEEDED`
- SSE 超时：发送结束事件并标记 `timeout=true`

#### 7.4.3 必备指标

- `latency_p95_ms`
- `first_token_p95_ms`
- `stream_interrupt_rate`
- `shed_count`
- `timeout_count`
- `slo_violation_count`

---

## 8. 记忆架构对接约定（与 Memory Contract 一致）

`koduck-ai` 仅依赖第 6.4 节定义的契约，不绑定 memory 内部实现。当前约定能力层次：

- L0：原始会话 `.jsonl`（存储于 S3/MinIO）
- L1：索引层（`session_id`、L0 路径、summary、tags、keywords）

读取策略（由 memory-service 执行）：

1. 查询关键词与主题 tag 命中时，返回对应 L0 引用。
2. 查询与 summary 语义近似时，返回对应 L0 引用。
3. 指定 `session_id` 时，直接定位 L0。

备注：召回策略允许“关键词优先 + 语义补充”，具体算法由 memory-service 演进，不在 ai-server 内固化。

---

## 9. 配置与安全

### 9.1 Secret 管理

以下项仅通过 Secret/环境变量注入：

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` 等

禁止在代码、配置样例、日志中明文落地密钥。

### 9.2 推荐配置键

- `KODUCK_AI__LLM__DEFAULT_PROVIDER`
- `KODUCK_AI__LLM__TIMEOUT_MS`
- `KODUCK_AI__AUTH__JWKS_URL`
- `KODUCK_AI__MEMORY__GRPC_TARGET`（APISIX gRPC 路由）
- `KODUCK_AI__TOOLS__GRPC_TARGET`（APISIX gRPC 路由）
- `KODUCK_AI__LLM__ADAPTER_GRPC_TARGET`（可选，仅迁移期或兼容模式下使用独立 LLM Adapter 服务时）
- `KODUCK_AI__STREAM__MAX_DURATION_MS`
- `KODUCK_AI__RETRY__MAX_ATTEMPTS`
- `KODUCK_AI__RETRY__TOTAL_BUDGET_MS`

---

## 10. 目录建议

```text
koduck-ai/
  proto/              # memory/tool 长期 contract proto；llm proto 为迁移期可选契约
  src/
    app/              # 启动与生命周期管理
    api/              # chat/stream handler
    orchestrator/     # 编排核心
    llm/              # 提供商适配与路由
    auth/             # auth 适配
    clients/
      memory/         # memory service client
      tool/           # tool service client
      llm/            # llm adapter client（迁移期可选）
    stream/           # SSE/WS transport 与队列
    reliability/      # retry/circuit/degrade
    observe/          # logging/trace/metrics
    config/           # 配置与 secret 解析
```

---

## 11. 迁移计划与验收

### Phase A：边界冻结

- 冻结本文档为 V2 目标边界
- 停止在 `koduck-ai` 新增 memory/tool 内部实现

验收：新增需求评审中，不再接受“把 memory/tool 写回 ai-server”方案。

### Phase B：契约先行

- 冻结 `memory/tool` 的长期 proto 契约并生成多语言 stub
- `llm.proto` 仅作为迁移期可选契约保留，不作为目标态必选依赖
- 在 `koduck-ai` 建立 gRPC `memory_client` / `tool_client`
- 迁移期如启用独立 LLM Adapter，再建立可选 `llm_client`
- `memory/tool` 通过 APISIX gRPC 路由接入下游

验收：AI 主链路不再依赖本地 memory/tool 实现，且不再新增内部 HTTP 契约。

### Phase C：独立服务切换

- `koduck-memory-service` 与 `koduck-tool-service` 独立部署
- 切换主流量并移除旧直连逻辑

验收：生产链路仅保留“AI Gateway + 独立能力服务”。

### Phase D：可靠性与治理收口

- 完成错误码、降级、重试预算统一
- 完成 SLO 指标上报与容量压测
- 完成 APISIX 限流与 trace 规范对齐

验收：达到首版 SLO 目标，具备可观测闭环与稳定回滚能力。

---

## 12. 主要风险与控制

| 风险 | 表现 | 控制 |
|------|------|------|
| 拆分后链路变长 | 延迟上升 | 连接池、超时预算、热点接口压测 |
| 迁移期契约漂移 | 字段不一致 | 契约测试、版本化、灰度比对 |
| 流式稳定性不足 | 断流/乱序/重复 | `sequence_num` 去重、重连策略、排队背压 |
| 观测断层 | 无法定位故障 | 统一 request/trace/session 字段规范 |
| 降级失控 | 用户感知混乱 | 强制 `degraded=true` 与统一错误码 |

---

## 13. 与旧方案差异摘要

- 从“单进程内聚 Memory/Tool”改为“AI Gateway + 独立服务”。
- 从“中间件叠加设计”改为“最小治理 + APISIX 承担统一网关能力”。
- 从“LLM API 组件化描述”改为“Secret 注入 + 提供商适配”。
- 新增“错误归一、降级责任、SLO 与容量责任”作为 `koduck-ai` 明确边界。

---

## 14. 附录 A：错误码字典（V1）

### 14.1 统一错误对象

```json
{
  "code": "UPSTREAM_UNAVAILABLE",
  "message": "memory service timeout",
  "request_id": "req_xxx",
  "retryable": true,
  "degraded": false,
  "upstream": "memory",
  "retry_after_ms": 0
}
```

### 14.2 错误码对照表

| code | HTTP | gRPC | retryable | degradable | 说明 |
|------|------|------|-----------|------------|------|
| `OK` | 200 | `OK` | 否 | 否 | 成功 |
| `INVALID_ARGUMENT` | 400 | `INVALID_ARGUMENT` | 否 | 否 | 请求参数不合法 |
| `AUTH_FAILED` | 401/403 | `UNAUTHENTICATED`/`PERMISSION_DENIED` | 否 | 否 | 认证或授权失败 |
| `RESOURCE_NOT_FOUND` | 404 | `NOT_FOUND` | 否 | 否 | 资源不存在 |
| `CONFLICT` | 409 | `ALREADY_EXISTS`/`ABORTED` | 否 | 否 | 幂等冲突或状态冲突 |
| `TOKEN_BUDGET_EXCEEDED` | 413/422 | `FAILED_PRECONDITION` | 否 | 否 | token 或上下文预算超限 |
| `RATE_LIMITED` | 429 | `RESOURCE_EXHAUSTED` | 是 | 是 | 触发限流，优先返回 `retry_after_ms` |
| `SERVER_BUSY` | 503 | `UNAVAILABLE` | 是 | 是 | 并发保护触发，拒绝入队 |
| `UPSTREAM_UNAVAILABLE` | 502/503/504 | `UNAVAILABLE`/`DEADLINE_EXCEEDED` | 是 | 是 | 下游不可用或超时 |
| `DEPENDENCY_FAILED` | 424/500 | `FAILED_PRECONDITION`/`UNKNOWN` | 视情况 | 是 | 下游业务失败但非网络异常 |
| `INTERNAL_ERROR` | 500 | `INTERNAL` | 否 | 否 | 未分类内部错误 |
| `STREAM_TIMEOUT` | 504 | `DEADLINE_EXCEEDED` | 是 | 是 | 流式请求超时结束 |
| `STREAM_INTERRUPTED` | 499/502 | `CANCELLED`/`UNAVAILABLE` | 是 | 是 | 流中断或客户端断连 |

### 14.3 归一规则

- `koduck-ai` 是唯一对外错误码出口，下游原始错误不得透传。
- gRPC 到 HTTP 的映射在边缘层保持稳定，不随下游厂商变化。
- 只有 `retryable=true` 的错误允许进入重试预算计算。

---

## 15. 附录 B：Proto 契约草案（V1）

### 15.1 公共消息（shared.proto）

```proto
syntax = "proto3";
package koduck.contract.v1;

message RequestMeta {
  string request_id = 1;
  string session_id = 2;
  string user_id = 3;
  string tenant_id = 4;
  string trace_id = 5;
  string idempotency_key = 6;
  int64 deadline_ms = 7;
  string api_version = 8;
}

message ErrorDetail {
  string code = 1;
  string message = 2;
  bool retryable = 3;
  bool degraded = 4;
  string upstream = 5;
  int64 retry_after_ms = 6;
}

message Capability {
  string service = 1;
  repeated string contract_versions = 2;
  map<string, string> features = 3;
  map<string, string> limits = 4;
}
```

### 15.2 Memory 服务（memory.proto）

```proto
syntax = "proto3";
package koduck.memory.v1;

import "shared.proto";

service MemoryService {
  rpc GetCapabilities(koduck.contract.v1.RequestMeta) returns (koduck.contract.v1.Capability);
  rpc UpsertSessionMeta(UpsertSessionMetaRequest) returns (UpsertSessionMetaResponse);
  rpc GetSession(GetSessionRequest) returns (GetSessionResponse);
  rpc QueryMemory(QueryMemoryRequest) returns (QueryMemoryResponse);
  rpc AppendMemory(AppendMemoryRequest) returns (AppendMemoryResponse);
  rpc SummarizeMemory(SummarizeMemoryRequest) returns (SummarizeMemoryResponse);
}
```

### 15.3 Tool 服务（tool.proto）

```proto
syntax = "proto3";
package koduck.tool.v1;

import "shared.proto";

service ToolService {
  rpc GetCapabilities(koduck.contract.v1.RequestMeta) returns (koduck.contract.v1.Capability);
  rpc ListTools(ListToolsRequest) returns (ListToolsResponse);
  rpc ValidateToolInput(ValidateToolInputRequest) returns (ValidateToolInputResponse);
  rpc ExecuteTool(ExecuteToolRequest) returns (ExecuteToolResponse);
  rpc ExecuteToolStream(ExecuteToolRequest) returns (stream ExecuteToolStreamEvent);
}
```

### 15.4 LLM 适配服务（llm.proto，可选迁移契约）

`llm.proto` 用于迁移期或兼容模式下的独立 LLM Adapter / Bridge。
它不是 V2 目标态的必选 southbound 契约；目标态默认由 `koduck-ai`
直接通过 provider-native HTTP 对接外部 LLM Provider。

```proto
syntax = "proto3";
package koduck.llm.v1;

import "shared.proto";

service LlmService {
  rpc GetCapabilities(koduck.contract.v1.RequestMeta) returns (koduck.contract.v1.Capability);
  rpc ListModels(ListModelsRequest) returns (ListModelsResponse);
  rpc CountTokens(CountTokensRequest) returns (CountTokensResponse);
  rpc Generate(GenerateRequest) returns (GenerateResponse);
  rpc StreamGenerate(GenerateRequest) returns (stream StreamGenerateEvent);
}
```

若未来确认不再保留独立 LLM Adapter 服务，可将该契约降级为 deprecated，
并最终从主链路移除。

### 15.5 兼容性规则（V1）

- 字段新增只能追加新 tag，不得复用或重排已有 tag。
- 删除字段采用 `reserved` 保留 tag 与名称。
- 非破坏升级允许新增 optional/repeated 字段；破坏升级必须提升大版本（`v2`）。

---

## 16. 附录 C：APISIX gRPC 参数基线（V1）

### 16.1 路由与超时

| 项 | 建议值 | 说明 |
|----|--------|------|
| upstream connect timeout | 1s | 防止连接长时间阻塞 |
| upstream send timeout | 5s | 非流式请求发送上限 |
| upstream read timeout | 65s | 普通 RPC 默认读超时 |
| stream read timeout | 310s | 对齐 SSE/流式 5 分钟窗口 |
| retries | 1 | 网关层轻重试，避免与服务内预算叠加 |
| keepalive pool | 256+ | 减少频繁建连开销 |

### 16.2 插件基线

| 插件 | 用途 | 基线建议 |
|------|------|----------|
| `limit-req` / `limit-count` | 入口限流 | 按 `tenant_id + route` 分组 |
| `prometheus` | 指标采集 | 暴露 route/upstream/status 维度 |
| `opentelemetry` | 链路追踪 | 透传并补全 `trace_id` |
| `access-log` | 审计与排障 | 记录 `request_id/session_id/user_id` |
| `grpc-transcode`（可选） | 兼容迁移窗口 | 仅迁移期开启，目标下线 |

### 16.3 保护阈值（首版）

| 指标 | 告警阈值 | 级别 |
|------|----------|------|
| `5xx_ratio` | >= 2% (5m) | P1 |
| `grpc_deadline_exceeded_ratio` | >= 3% (5m) | P1 |
| `p95_latency_ms(chat)` | > 8000 (10m) | P2 |
| `p95_first_token_ms(stream)` | > 3000 (10m) | P2 |
| `shed_count` | 持续增长 10m | P2 |

### 16.4 回滚触发条件

- 新版本发布后 10 分钟内出现 P1 告警即自动回滚。
- `5xx_ratio` 与 `deadline_exceeded_ratio` 同时超阈值时直接切流到上一稳定版本。
- 回滚后保留变更窗口内 `trace_id` 与 `request_id` 采样用于复盘。
