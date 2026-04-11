# Koduck Memory Service 对接 Koduck AI 设计文档（V1）

## 1. 文档目的与范围

本文档定义 `koduck-memory-service` 作为 `koduck-ai` southbound first-class service 的目标设计，
用于支撑会话元数据真值、记忆写入、记忆检索与摘要能力。

本文档覆盖：

- `koduck-memory-service` 在 AI 解耦架构中的职责边界
- 与 `koduck-ai` 的 gRPC 契约与调用关系
- 内部模块划分、数据模型与检索策略
- 运行时要求、错误语义、部署与迁移路径

本文档不覆盖：

- 具体 embedding / rerank 模型选型
- 对象存储、向量库或全文索引引擎的最终产品选型
- `koduck-tool-service` 的内部执行引擎实现

---

## 2. 设计背景

根据 [`koduck-ai/docs/design/ai-decoupled-architecture.md`](../../koduck-ai/docs/design/ai-decoupled-architecture.md)，
`koduck-ai` 的 V2 目标是收敛为 AI Gateway / Orchestrator，不再内置 Memory 业务实现。

因此：

1. 会话元数据真值必须从 `koduck-ai` 中剥离。
2. 记忆存储、检索、摘要生产必须由独立服务承接。
3. `koduck-ai` 通过统一 southbound gRPC contract 调用 memory 能力。
4. `koduck-memory-service` 必须成为可独立部署、可治理、可灰度的 first-class service。

---

## 3. 结论先行

V1 的核心结论如下：

1. `koduck-memory-service` 是 `koduck-ai` 的 southbound gRPC 服务，不直接面向前端。
2. 会话元数据真值统一归 `koduck-memory-service` 管理。
3. `koduck-ai` 只声明检索偏好，不固化记忆检索算法。
4. Memory Southbound Contract 以 [`koduck-ai/proto/koduck/memory/v1/memory.proto`](../../koduck-ai/proto/koduck/memory/v1/memory.proto) 为基础冻结。
5. 第一阶段优先落地 `GetSession / UpsertSessionMeta / QueryMemory / AppendMemory`，`SummarizeMemory` 可先同步占位、后续异步化。
6. V1 先实现 keyword / tag / session 范围检索；hybrid / summary-first 先保留契约、逐步增强实现。

---

## 4. 职责边界

### 4.1 `koduck-memory-service` 负责

- 会话元数据管理
- 对话记忆追加与存储
- 记忆检索与命中排序
- 会话摘要、标签与长期记忆材料生产
- capability discovery 与契约版本声明

### 4.2 `koduck-memory-service` 不负责

- LLM 编排
- Tool 选择与执行
- 对外 northbound chat / stream API
- JWT 鉴权中心能力本身

### 4.3 与其他服务边界

| 服务 | 负责 | 不负责 |
|------|------|--------|
| `koduck-ai` | 对话编排、SSE、错误映射、模型路由 | 会话元数据真值、记忆检索算法实现 |
| `koduck-memory-service` | 会话与记忆真值、检索、摘要 | chat orchestration |
| `koduck-tool-service` | 工具注册、执行、权限策略 | 记忆持久化 |
| `koduck-auth` | JWT/JWKS | AI / Memory 业务语义 |
| `APISIX` | gRPC 路由、限流、trace 透传、access log | 业务语义决策 |

---

## 5. 目标架构

### 5.1 逻辑拓扑

```text
Frontend / BFF
      │
      ▼
    APISIX
      │
      ▼
  koduck-ai
      │
      ▼
 APISIX(gRPC)
      │
      ▼
koduck-memory-service
      │
      ├── Session Metadata Store
      ├── Memory Entry Store
      ├── Summary / Fact Store
      └── Retrieval Engine
```

### 5.2 调用路径

- 北向：`Frontend -> APISIX -> koduck-ai`
- Southbound：`koduck-ai -> APISIX -> koduck-memory-service`
- 内部持久化：`koduck-memory-service -> PostgreSQL / Object Storage / Index Backend`

### 5.3 旁路原则

默认不允许 `koduck-ai` 直接访问 memory DB 或对象存储。
所有会话与记忆读写必须经过 `koduck-memory-service` 契约。

---

## 6. 对接契约设计

### 6.1 契约来源

V1 直接以 [`koduck-ai/proto/koduck/memory/v1/memory.proto`](../../koduck-ai/proto/koduck/memory/v1/memory.proto) 为正式契约基础。

服务入口：

- `GetCapabilities`
- `UpsertSessionMeta`
- `GetSession`
- `QueryMemory`
- `AppendMemory`
- `SummarizeMemory`

### 6.2 RequestMeta 约束

所有 RPC 必须要求并校验：

- `request_id`
- `session_id`（按场景必填）
- `user_id`
- `trace_id`
- `deadline_ms`
- `api_version`
- `idempotency_key`（写操作建议必填）

约束：

- `request_id` 用于幂等日志与错误回传
- `trace_id` 用于链路观测
- `deadline_ms` 必须传递到存储与索引层
- `idempotency_key` 用于抵御 `koduck-ai` retry 带来的重复写入

### 6.3 会话元数据契约

`UpsertSessionMeta` 负责维护以下真值字段：

- `session_id`
- `title`
- `status`
- `created_at`
- `updated_at`
- `last_message_at`
- `extra`

设计约束：

- `session_id` 由 `koduck-ai` 生成或透传，但最终真值在 memory-service。
- `title/status/last_message_at` 更新必须幂等。
- `extra` 用于存储可扩展字段，如 `tenant_id`, `conversation_type`, `client_version`。

### 6.4 记忆写入契约

`AppendMemory` 的核心职责：

- 追加 user / assistant / system 级别的结构化消息
- 建立检索材料
- 为后续 summary / facts 任务准备输入

建议约定 `MemoryEntry.metadata` 预留字段：

- `message_id`
- `turn_id`
- `source`（如 `chat`, `stream_finalize`, `manual_import`）
- `model`
- `tags`
- `language`
- `importance`

约束：

- `AppendMemory` 成功返回只代表“结构化记忆已接收并落地”。
- 若存在异步索引构建，不应阻塞主写路径。

### 6.5 记忆检索契约

`QueryMemory` 输入：

- `query_text`
- `session_id`
- `tags[]`
- `top_k`
- `retrieve_policy`
- `page_token`
- `page_size`

`retrieve_policy` 语义：

- `KEYWORD_FIRST`：关键词 / tag / recent-first 优先
- `SUMMARY_FIRST`：优先检索会话摘要或结构化记忆
- `HYBRID`：综合候选集后统一排序

`QueryMemoryResponse.hits[]` 最低要求：

- `session_id`
- `l0_uri`
- `score`
- `match_reasons`
- `snippet`

约束：

- `koduck-ai` 只声明偏好策略，不决定打分算法。
- `match_reasons` 必须便于调试，例如：`tag_hit`, `keyword_hit`, `summary_hit`, `session_scope_hit`。

### 6.6 摘要契约

`SummarizeMemory` 在 V1 可先提供同步占位实现，用于：

- 生成会话摘要
- 归纳主题标签
- 提炼长期记忆事实

后续推荐演进为异步任务化：

- `SummarizeMemory` 只负责投递任务
- 结果落到 `memory_summaries` / `memory_facts`

---

## 7. `koduck-ai` 与 `koduck-memory-service` 的协作方式

### 7.1 chat / stream 主链路

建议编排顺序：

1. `koduck-ai` 收到 `chat` / `chat_stream`
2. 调 `GetSession`
3. 若不存在则 `UpsertSessionMeta`
4. 按 `retrieve_policy` 调 `QueryMemory`
5. 拼装 LLM 上下文并生成回答
6. 完成后异步 `AppendMemory`
7. 按策略触发 `SummarizeMemory`
8. 更新 `last_message_at/status/title`

### 7.2 fail-open / fail-closed 原则

建议：

- `GetSession / UpsertSessionMeta` 默认 fail-open，但需打结构化告警
- `QueryMemory` 默认 fail-open，`koduck-ai` 可在无记忆情况下继续对话
- `AppendMemory` 默认 fail-open，但必须记录补偿任务或错误日志
- `SummarizeMemory` 必须异步，不可阻塞主对话完成

原因：

- memory 是增强能力，不应成为 chat 主链路的单点硬阻塞
- 但会话元数据真值仍需要最终一致性保障

### 7.3 capabilities 协商

`koduck-memory-service` 必须实现 `GetCapabilities`，至少返回：

- `service = memory`
- `contract_versions = ["memory.v1"]`
- `features`
  - `session_meta`
  - `query_memory`
  - `append_memory`
  - `summary`
  - `keyword_search`
  - `hybrid_search`
- `limits`
  - `max_top_k`
  - `max_page_size`
  - `recommended_timeout_ms`

`koduck-ai` 启动时：

- 拉取 capability
- 校验 `contract_versions`
- 缓存 capability，并按 TTL 后台刷新

---

## 8. 内部模块设计

推荐目录结构：

```text
koduck-memory-service/
  proto/
  src/
    app/
    api/
    capability/
    session/
    memory/
    retrieve/
    summary/
    store/
    index/
    config/
    reliability/
    observe/
```

模块职责：

- `api/`：gRPC server 与 DTO 转换
- `capability/`：版本声明、feature flag、limits
- `session/`：会话元数据管理
- `memory/`：消息写入、L0/L1 材料生成
- `retrieve/`：查询、排序、策略分发
- `summary/`：摘要与长期记忆提炼
- `store/`：PostgreSQL / Object Storage DAO
- `index/`：全文索引、tag 索引、后续向量索引

---

## 9. 数据模型建议

### 9.1 核心表

建议至少包含：

1. `memory_sessions`
   - `session_id`
   - `user_id`
   - `title`
   - `status`
   - `created_at`
   - `updated_at`
   - `last_message_at`
   - `extra_json`

2. `memory_entries`
   - `id`
   - `session_id`
   - `role`
   - `content`
   - `message_ts`
   - `metadata_json`
   - `l0_uri`

3. `memory_summaries`
   - `id`
   - `session_id`
   - `summary`
   - `strategy`
   - `version`
   - `created_at`

4. `memory_facts`（可选）
   - `id`
   - `session_id`
   - `fact_type`
   - `fact_text`
   - `confidence`
   - `created_at`

5. `memory_idempotency_keys`
   - `idempotency_key`
   - `operation`
   - `request_id`
   - `created_at`

### 9.2 存储分层

建议采用两层：

- L0：原始对话或原始片段，保证可追溯
- L1：结构化索引材料，供高频检索

演进方向：

- V1：L0 / L1 先都落 PostgreSQL，可辅以对象存储 URI
- V2：L0 放对象存储，L1 放 PostgreSQL / 搜索索引
- V3：引入向量索引与 hybrid ranking

---

## 10. 检索与摘要策略

### 10.1 V1 检索策略

V1 先实现以下能力：

- session 精确范围过滤
- tag 过滤
- 关键词匹配
- recent-first 时间衰减
- summary 文本检索占位

推荐实现：

- `KEYWORD_FIRST`
  - 优先当前 session
  - title / tags / content keyword 匹配
- `SUMMARY_FIRST`
  - 若 summary 存在，先命中 summary，再回退原文
- `HYBRID`
  - 合并 keyword 命中与 summary 命中，按统一 score 排序

### 10.2 V1 摘要策略

摘要触发条件建议：

- 会话累计消息数超过阈值
- 会话 token 估算超过阈值
- 会话长时间活跃后进入空闲

摘要输出建议：

- summary
- topic tags
- candidate facts

---

## 11. 错误语义与超时约束

### 11.1 错误类型

对 `koduck-ai` 暴露的错误必须统一收敛到 contract `ErrorDetail`，禁止直接暴露：

- PostgreSQL 错误文本
- 存储 SDK 原始异常
- 搜索引擎原始响应

建议映射：

- 参数错误 -> `INVALID_ARGUMENT`
- session 不存在 -> `RESOURCE_NOT_FOUND`
- 幂等冲突 -> `CONFLICT`
- budget 超时 -> `UPSTREAM_UNAVAILABLE` 或 `SERVER_BUSY`
- 索引后台未完成 -> `DEPENDENCY_FAILED`（但尽量 fail-open）

### 11.2 deadline 约束

`koduck-memory-service` 必须尊重 `deadline_ms`：

- 若剩余预算不足以完成检索，快速失败
- 不在服务内部叠加长超时
- 内部下游访问也必须透传剩余预算

### 11.3 重试原则

- `GetSession / QueryMemory` 可在 transport error 上短重试
- `AppendMemory / UpsertSessionMeta` 必须依赖 `idempotency_key`
- 业务语义错误禁止重试

---

## 12. 部署与配置

### 12.1 必要配置

建议至少支持：

- `SERVER__GRPC_ADDR`
- `SERVER__METRICS_ADDR`
- `POSTGRES__DSN`
- `OBJECT_STORE__BUCKET`
- `OBJECT_STORE__ENDPOINT`
- `INDEX__MODE`
- `CAPABILITIES__TTL_SECS`
- `SUMMARY__ASYNC_ENABLED`

### 12.2 APISIX 接入

对 `koduck-ai` southbound 暴露：

- APISIX upstream: `memory-grpc`
- route: `ai-memory-grpc`
- gRPC 协议治理、超时、重试预算、access log、trace 透传

约束：

- `koduck-ai` 不保存 memory-service 直连地址作为常态主路径
- APISIX 统一承担治理入口

---

## 13. 可观测性要求

### 13.1 指标

建议暴露：

- `memory_rpc_requests_total`
- `memory_rpc_latency_ms`
- `memory_query_hits_count`
- `memory_query_empty_total`
- `memory_append_entries_total`
- `memory_summary_jobs_total`
- `memory_summary_failures_total`

维度建议：

- `rpc`
- `status`
- `retrieve_policy`
- `tenant`

### 13.2 日志

日志必须包含：

- `request_id`
- `session_id`
- `trace_id`
- `user_id`
- `rpc`
- `latency_ms`

禁止输出：

- 原始敏感对话全文
- token / secret / 凭证

---

## 14. 迁移路径

### 14.1 阶段化迁移

1. 冻结 `memory.v1` 契约
2. 启动 `koduck-memory-service` 骨架与 capability
3. 接通 `GetSession / UpsertSessionMeta`
4. 接通 `QueryMemory / AppendMemory`
5. 在 `koduck-ai` 中移除会话元数据真值持有
6. 接入摘要与长期记忆能力

### 14.2 回滚策略

若 memory-service 新版本异常：

- `koduck-ai` 暂时 fail-open 跳过 memory 查询
- `AppendMemory` 落失败补偿日志
- APISIX route 可回滚到上一个稳定版本

---

## 15. 验收标准

满足以下条件可视为 `koduck-memory-service` 完成对接准备：

- `koduck-ai` 能通过 gRPC 成功调用 `GetSession / QueryMemory / AppendMemory`
- 会话元数据真值不再由 `koduck-ai` 本地持有
- `QueryMemory` 能返回可解释的 `match_reasons`
- `AppendMemory` 幂等可验证
- capability 协商、trace 透传、错误映射完整可观测
- memory-service 故障时，`koduck-ai` 主 chat 流程可按 fail-open 策略继续运行

---

## 16. 后续 ADR 议题

建议在实现过程中追加 ADR：

- 是否引入向量检索以及何时引入
- L0 是否迁移到对象存储
- 摘要/事实提炼是同步实现还是异步任务化
- keyword / hybrid 的默认检索策略
- 多租户隔离与数据生命周期策略
