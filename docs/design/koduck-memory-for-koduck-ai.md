# Koduck Memory 对接 Koduck AI 设计文档（V1）

## 1. 目的与范围

本文档定义 `koduck-memory` 作为 `koduck-ai` southbound first-class service 的 V1 设计，
用于承接会话元数据真值、记忆写入、记忆检索、摘要与长期事实提炼。

本文档覆盖：

- 服务职责边界与目标架构
- 与 `koduck-ai` 的 gRPC 契约
- 数据模型、对象存储组织与 append 语义
- 检索策略、摘要策略、多租户隔离与生命周期治理
- 部署、观测、迁移与验收要求

本文档不覆盖：

- `koduck-tool-service` 的内部执行引擎
- 具体全文检索引擎产品选型
- 向量检索设计

---

## 2. 背景与目标

根据 [`/Users/guhailin/Git/koduck-quant/koduck-ai/docs/design/ai-decoupled-architecture.md`](/Users/guhailin/Git/koduck-quant/koduck-ai/docs/design/ai-decoupled-architecture.md)，
`koduck-ai` 的目标是收敛为 AI Gateway / Orchestrator，不再内置 Memory 业务实现。

因此需要将以下能力从 `koduck-ai` 中剥离：

- 会话元数据真值
- 原始记忆写入
- 结构化记忆索引
- 会话摘要与长期事实提炼

V1 的目标是先把 southbound contract、存储模型、append 语义和默认检索路径定稳，
而不是追求复杂检索能力。

---

## 3. 当前定稿结论

1. `koduck-memory` 是 `koduck-ai` 的 southbound gRPC 服务，不直接面向前端。
2. 会话元数据真值统一归 `koduck-memory` 管理。
3. Memory contract 以 [`/Users/guhailin/Git/koduck-quant/koduck-ai/proto/koduck/memory/v1/memory.proto`](/Users/guhailin/Git/koduck-quant/koduck-ai/proto/koduck/memory/v1/memory.proto) 为基础冻结。
4. L0 原始材料存放于 S3 兼容对象存储。dev 使用 MinIO，prod 使用正式 S3 或兼容实现。
5. L1 结构化索引与 summary 存放于 PostgreSQL。
6. `session_id` 是稳定的会话根标识；V1 显式支持 `parent_session_id`、`forked_from_session_id`、`sequence_num`。
7. `AppendMemory` 在对象存储侧采用“新增对象”实现 append，不依赖单对象原地追加。
8. V1 默认检索策略是：先按 `domain_class` 粗筛，再用 `summary` 做负向排除。
9. `summary` 只用于排除不合适候选，不作为最终选中条件。
10. 暂不在 V1 中定义 keyword 召回或 keyword 筛选策略。
11. `SummarizeMemory`、事实提炼与索引刷新统一采用异步任务化实现。
12. V1 明确不引入向量检索。
13. 多租户隔离与数据生命周期治理属于当前设计的一部分，不留作后续开放问题。

---

## 4. 职责边界

### 4.1 `koduck-memory` 负责

- 会话元数据管理
- 原始记忆写入与顺序控制
- 结构化索引生成与查询
- 会话摘要与长期事实提炼
- capability discovery 与契约版本声明

### 4.2 `koduck-memory` 不负责

- LLM 编排
- Tool 选择与执行
- 对外 northbound chat / stream API
- JWT/JWKS 认证中心能力

### 4.3 与其他服务关系

| 服务 | 负责 | 不负责 |
|------|------|--------|
| `koduck-ai` | chat orchestration、SSE、错误映射、模型路由 | 会话与记忆真值 |
| `koduck-memory` | 会话与记忆真值、检索、摘要 | 对外 chat |
| `koduck-tool-service` | 工具执行 | 记忆持久化 |
| `koduck-auth` | JWT/JWKS | AI / Memory 业务语义 |
| `APISIX` | southbound gRPC 路由与治理 | 业务语义 |

---

## 5. 目标架构

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
koduck-memory
      │
      ├── PostgreSQL
      │     ├── session truth
      │     ├── memory index
      │     ├── summaries
      │     └── facts
      └── S3 / MinIO
            └── L0 raw materials
```

架构约束：

- `koduck-ai` 不直接访问 memory DB 或对象存储。
- 所有读写必须经过 `koduck-memory` 契约。
- APISIX 是 southbound 的统一治理入口。

---

## 6. 对接契约

### 6.1 基础 RPC

V1 契约基于 `memory.v1`，入口包括：

- `GetCapabilities`
- `UpsertSessionMeta`
- `GetSession`
- `QueryMemory`
- `AppendMemory`
- `SummarizeMemory`

### 6.2 RequestMeta

所有 RPC 必须要求并校验：

- `request_id`
- `session_id`
- `user_id`
- `tenant_id`
- `trace_id`
- `deadline_ms`
- `api_version`
- `idempotency_key`（`UpsertSessionMeta` / `AppendMemory` / `SummarizeMemory` 必填）

语义要求：

- `request_id` 用于日志、错误回传与幂等追踪
- `session_id` / `tenant_id` / `user_id` 共同限定会话与租户上下文
- `trace_id` 用于链路观测
- `deadline_ms` 必须向内部存储和异步任务调度传播
- `idempotency_key` 用于抵御上游 retry 导致的重复写入

### 6.3 会话元数据

`UpsertSessionMeta` 维护以下真值字段：

- `session_id`
- `tenant_id`
- `user_id`
- `parent_session_id`
- `forked_from_session_id`
- `title`
- `status`
- `created_at`
- `updated_at`
- `last_message_at`
- `extra`

约束：

- `session_id` 由 `koduck-ai` 生成或透传，但最终真值在 memory-service
- `session_id` 不因标题、摘要更新而变化
- `parent_session_id` 表示 resume / continue 关系
- `forked_from_session_id` 表示分叉来源
- `title/status/last_message_at` 更新必须幂等

### 6.4 AppendMemory

`AppendMemory` 的职责：

- 追加 user / assistant / system 级记忆条目
- 维护同一 `session_id` 下的顺序写入语义
- 写入 L0 原始材料
- 异步触发 L1 索引刷新与摘要/事实提炼

建议 `MemoryEntry.metadata` 预留字段：

- `message_id`
- `turn_id`
- `sequence_num`
- `source`
- `model`
- `language`
- `importance`
- `memory_kind`
- `domain_class`

约束：

- 同一 `session_id` 下写入必须具备单调顺序
- 冲突恢复以 `session_id + sequence_num` 或 `idempotency_key` 为基础
- `AppendMemory` 成功仅代表写入已接收并落地，不代表摘要/索引已完成

### 6.5 QueryMemory

`QueryMemory` 输入：

- `query_text`
- `tenant_id`
- `session_id`
- `domain_class`
- `top_k`
- `retrieve_policy`
- `page_token`
- `page_size`

V1 `retrieve_policy` 语义：

- `DOMAIN_FIRST`：先按 `domain_class` 过滤，再做 summary 排除
- `SUMMARY_FIRST`：先用 summary 排除，再回退结构化原文索引做正向选取
- `HYBRID`：保留为后续扩展策略，V1 不作为默认实现范围

`QueryMemoryResponse.hits[]` 最低要求：

- `session_id`
- `l0_uri`
- `score`
- `match_reasons`
- `snippet`

约束：

- `match_reasons` 至少支持 `domain_class_hit`、`summary_hit`、`session_scope_hit`
- `summary` 只承担排除作用，不承担最终选中作用

### 6.6 SummarizeMemory

`SummarizeMemory` 用于：

- 生成会话摘要
- 生成粗粒度 `domain_class`
- 提炼长期事实

V1 采用异步任务化实现：

- `SummarizeMemory` 只负责投递任务
- 结果落到 `memory_summaries` / `memory_facts`
- 不阻塞 `AppendMemory`

---

## 7. 与 `koduck-ai` 的协作方式

主链路建议如下：

1. `koduck-ai` 收到 `chat` / `chat_stream`
2. 调 `GetSession`
3. 若不存在则 `UpsertSessionMeta`
4. 按 `retrieve_policy` 调 `QueryMemory`
5. 拼装 LLM 上下文并生成回答
6. 完成后异步 `AppendMemory`
7. 按策略触发 `SummarizeMemory`
8. 更新 `last_message_at/status/title`

fail-open 原则：

- `GetSession / UpsertSessionMeta` 默认 fail-open，但必须告警
- `QueryMemory` 默认 fail-open，不阻塞主 chat
- `AppendMemory` 默认 fail-open，但必须记录补偿任务或结构化错误
- 摘要/事实任务失败不得阻塞主链路

capability 协商：

- `service = memory`
- `contract_versions = ["memory.v1"]`
- `features` 至少包含 `session_meta`、`query_memory`、`append_memory`、`summary`、`domain_first_search`、`summary_search`
- `limits` 至少包含 `max_top_k`、`max_page_size`、`recommended_timeout_ms`

---

## 8. 内部模块

推荐目录结构：

```text
koduck-memory/
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
- `capability/`：版本与 feature 声明
- `session/`：会话元数据真值
- `memory/`：写入、顺序控制、L0/L1 生成
- `retrieve/`：候选过滤、summary 排除、排序
- `summary/`：摘要与事实任务
- `store/`：PostgreSQL / S3(MinIO) DAO
- `index/`：L1 索引材料与全文索引接口

---

## 9. 数据模型与存储设计

### 9.1 核心表

V1 核心表：

- `memory_sessions`
- `memory_entries`
- `memory_index_records`
- `memory_summaries`
- `memory_facts`
- `memory_idempotency_keys`

设计约束：

- V1 不引入数据库外键
- 表间关系由应用层维护
- 用主键、唯一约束、索引和写入校验保证一致性

### 9.2 推荐表结构

#### `memory_sessions`

字段：

- `session_id uuid primary key`
- `tenant_id varchar(128) not null`
- `user_id varchar(128) not null`
- `parent_session_id uuid null`
- `forked_from_session_id uuid null`
- `title varchar(256) null`
- `status varchar(32) not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `last_message_at timestamptz null`
- `extra_json jsonb not null default '{}'::jsonb`

索引：

- `idx_memory_sessions_tenant_user_created_at (tenant_id, user_id, created_at desc)`
- `idx_memory_sessions_tenant_last_message_at (tenant_id, last_message_at desc)`
- `idx_memory_sessions_parent_session_id (parent_session_id)`
- `idx_memory_sessions_forked_from_session_id (forked_from_session_id)`

#### `memory_entries`

字段：

- `id uuid primary key`
- `tenant_id varchar(128) not null`
- `session_id uuid not null`
- `sequence_num bigint not null`
- `role varchar(32) not null`
- `raw_content_ref varchar(512) not null`
- `message_ts timestamptz not null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `l0_uri varchar(1024) not null`
- `created_at timestamptz not null`

约束与索引：

- `unique (tenant_id, session_id, sequence_num)`
- `idx_memory_entries_tenant_session_message_ts (tenant_id, session_id, message_ts desc)`
- `idx_memory_entries_tenant_session_created_at (tenant_id, session_id, created_at desc)`

#### `memory_index_records`

字段：

- `id uuid primary key`
- `tenant_id varchar(128) not null`
- `session_id uuid not null`
- `entry_id uuid null`
- `memory_kind varchar(64) not null`
- `domain_class varchar(64) not null`
- `summary text not null`
- `snippet text null`
- `source_uri varchar(1024) not null`
- `score_hint numeric(10,4) null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：

- `idx_memory_index_records_tenant_domain_updated (tenant_id, domain_class, updated_at desc)`
- `idx_memory_index_records_tenant_session_domain (tenant_id, session_id, domain_class, updated_at desc)`
- `idx_memory_index_records_memory_kind (memory_kind)`
- `idx_memory_index_records_summary_gin (to_tsvector('simple', coalesce(summary, '')))`
- `idx_memory_index_records_snippet_gin (to_tsvector('simple', coalesce(snippet, '')))`

#### `memory_summaries`

字段：

- `id uuid primary key`
- `tenant_id varchar(128) not null`
- `session_id uuid not null`
- `domain_class varchar(64) not null`
- `summary text not null`
- `strategy varchar(64) not null`
- `version integer not null`
- `created_at timestamptz not null`

约束与索引：

- `unique (tenant_id, session_id, version)`
- `idx_memory_summaries_tenant_session_created_at (tenant_id, session_id, created_at desc)`
- `idx_memory_summaries_tenant_domain_class (tenant_id, domain_class)`

#### `memory_facts`

字段：

- `id uuid primary key`
- `tenant_id varchar(128) not null`
- `session_id uuid not null`
- `fact_type varchar(64) not null`
- `domain_class varchar(64) not null`
- `fact_text text not null`
- `confidence numeric(5,4) not null`
- `created_at timestamptz not null`

索引：

- `idx_memory_facts_tenant_session_created_at (tenant_id, session_id, created_at desc)`
- `idx_memory_facts_tenant_domain_class (tenant_id, domain_class)`

#### `memory_idempotency_keys`

字段：

- `idempotency_key varchar(128) primary key`
- `tenant_id varchar(128) null`
- `session_id uuid null`
- `operation varchar(64) not null`
- `request_id varchar(128) not null`
- `created_at timestamptz not null`
- `expires_at timestamptz null`

索引：

- `idx_memory_idempotency_keys_tenant_session_operation (tenant_id, session_id, operation, created_at desc)`
- `idx_memory_idempotency_keys_expires_at (expires_at)`

### 9.3 L0 / L1 分层

- L0：原始对话或原始片段，存放于 S3/MinIO
- L1：结构化索引与 summary，存放于 PostgreSQL

说明：

- 本文中的“对象存储”即指 S3 兼容对象存储
- dev 使用 MinIO
- prod 使用正式 S3 或兼容实现

### 9.4 L0 的 JSONL 组织

参考 `claude-code` transcript 设计，L0 建议采用 JSONL event log 或等价事件对象组织，
但只借鉴“事件流结构”和“按 session 追加”思路，不把 JSONL 作为线上主检索面。

推荐事件字段：

- `session_id`
- `message_id`
- `sequence_num`
- `event_type`
- `role`
- `payload`
- `created_at`
- `request_id`
- `trace_id`

推荐事件类型：

- `message_appended`
- `session_meta_updated`
- `summary_generated`
- `fact_extracted`

### 9.5 S3/MinIO 下的 append 语义

由于 S3/MinIO 不支持单对象原地追加，V1 采用“新增对象 + 数据库顺序索引”实现 append：

1. 先为同一 `session_id` 分配单调递增的 `sequence_num`
2. 将新增 entry 写入新的 L0 对象
3. 在 PostgreSQL 中写入 `memory_entries`
4. 异步生成或刷新 `memory_index_records`

推荐对象 key：

- `tenants/{tenant_id}/sessions/{session_id}/entries/{sequence_num}-{message_id}.json`
- `tenants/{tenant_id}/sessions/{session_id}/segments/{segment_id}.jsonl`
- `tenants/{tenant_id}/sessions/{session_id}/summaries/{version}.json`

### 9.6 Session Lineage

V1 显式支持：

- `session_id`
- `parent_session_id`
- `forked_from_session_id`
- `sequence_num`

约束：

- `session_id` 用于会话分组、检索分区和对象存储前缀组织
- lineage 只承载恢复/分叉关系，不改变当前会话真值
- 同一 `session_id` 的写入必须串行化或具备等价顺序控制

---

## 10. 检索与摘要策略

### 10.1 V1 默认检索策略

V1 默认策略固定为 `DOMAIN_FIRST`：

1. 先按 `domain_class` 做粗粒度候选过滤
2. 再基于 `summary` 做语义排除
3. `summary` 只用于排除不合适候选，不作为最终选中条件
4. 命中后返回 `snippet` 与 `source_uri`
5. 必要时再回对象存储读取原始材料

当前不在 V1 中定义 keyword 的召回或筛选策略。`HYBRID` 保留为后续增强能力。

### 10.2 摘要与事实策略

摘要触发条件建议：

- 会话累计消息数超过阈值
- 会话 token 估算超过阈值
- 会话长时间活跃后进入空闲

摘要输出：

- `summary`
- `domain_class`
- `candidate_facts`

实现约束：

- 摘要、事实提炼、索引刷新统一采用异步任务化
- 不在 `AppendMemory` 主路径中同步等待完成
- 失败应支持重试与补偿

---

## 11. 多租户隔离与生命周期治理

### 11.1 多租户隔离

- 每条 session、entry、summary、fact 都必须带 `tenant_id`
- `tenant_id` 参与查询、写入、对象存储 key 组织和指标维度
- `QueryMemory` 默认只允许在当前 `tenant_id` 内查询
- 不允许跨租户 fallback 或模糊匹配

### 11.2 生命周期治理

- L0、L1、summary、facts 支持独立 retention 配置
- 支持按 `tenant_id + session_id` 逻辑删除或归档
- 对象存储支持按前缀归档与清理
- 生命周期清理不能破坏保留窗口内的数据一致性

推荐分层：

- 热数据：PostgreSQL + 对象存储在线保留
- 温数据：保留 summary / facts / 必要索引，原始材料转归档
- 冷数据：按租户策略定期清理或导出

---

## 12. 运行时与错误语义

### 12.1 超时与重试

- `GetSession / QueryMemory` 可在 transport error 上短重试
- `AppendMemory / UpsertSessionMeta` 必须依赖 `idempotency_key`
- 业务语义错误禁止重试
- 必须尊重 `deadline_ms`

### 12.2 错误映射

禁止对 `koduck-ai` 暴露：

- PostgreSQL 原始错误
- 存储 SDK 原始异常
- 检索引擎原始响应

建议映射：

- 参数错误 -> `INVALID_ARGUMENT`
- session 不存在 -> `RESOURCE_NOT_FOUND`
- 幂等冲突 -> `CONFLICT`
- 预算耗尽 -> `UPSTREAM_UNAVAILABLE` 或 `SERVER_BUSY`
- 后台索引未完成 -> `DEPENDENCY_FAILED`（尽量 fail-open）

---

## 13. 部署、配置与观测

### 13.1 必要配置

- `SERVER__GRPC_ADDR`
- `SERVER__METRICS_ADDR`
- `POSTGRES__DSN`
- `OBJECT_STORE__BUCKET`
- `OBJECT_STORE__ENDPOINT`
- `OBJECT_STORE__ACCESS_KEY`
- `OBJECT_STORE__SECRET_KEY`
- `OBJECT_STORE__REGION`
- `INDEX__MODE`
- `CAPABILITIES__TTL_SECS`
- `SUMMARY__ASYNC_ENABLED`

### 13.2 APISIX 接入

- APISIX upstream：`memory-grpc`
- route：`ai-memory-grpc`
- gRPC 治理、超时、重试预算、access log、trace 透传统一由 APISIX 承担

### 13.3 `k8s/deploy.sh` / `k8s/uninstall.sh`

`koduck-memory` 与 MinIO 必须纳入现有
[`/Users/guhailin/Git/koduck-quant/k8s/deploy.sh`](/Users/guhailin/Git/koduck-quant/k8s/deploy.sh)
与
[`/Users/guhailin/Git/koduck-quant/k8s/uninstall.sh`](/Users/guhailin/Git/koduck-quant/k8s/uninstall.sh)
生命周期管理。

要求：

- `deploy.sh` 负责 secret、MinIO、memory-service、bucket 初始化
- `uninstall.sh` 负责 deployment/service/secret/pvc/job 清理
- dev / prod 使用同一脚本入口，不引入独立 memory 专用脚本

### 13.4 指标与日志

建议指标：

- `memory_rpc_requests_total`
- `memory_rpc_latency_ms`
- `memory_query_hits_count`
- `memory_query_empty_total`
- `memory_append_entries_total`
- `memory_summary_jobs_total`
- `memory_summary_failures_total`
- `memory_object_store_put_total`
- `memory_object_store_failures_total`

建议维度：

- `rpc`
- `status`
- `retrieve_policy`
- `domain_class`
- `tenant`

日志必须包含：

- `request_id`
- `session_id`
- `trace_id`
- `user_id`
- `tenant_id`
- `rpc`
- `latency_ms`

---

## 14. 迁移与回滚

阶段化迁移：

1. 冻结 `memory.v1`
2. 启动服务骨架与 capability
3. 接通 `GetSession / UpsertSessionMeta`
4. 接通 `AppendMemory / QueryMemory`
5. 在 `koduck-ai` 中移除本地会话元数据真值
6. 接入异步摘要与长期事实能力

回滚原则：

- `koduck-ai` 可 fail-open 跳过 memory 查询
- `AppendMemory` 落失败补偿日志
- APISIX route 可回滚到上一个稳定版本

---

## 15. 验收标准

满足以下条件可视为对接准备完成：

- `koduck-ai` 可通过 gRPC 成功调用 `GetSession / QueryMemory / AppendMemory`
- 会话元数据真值不再由 `koduck-ai` 本地持有
- `AppendMemory` 幂等可验证，顺序语义可验证
- `QueryMemory` 可返回可解释的 `match_reasons`
- capability 协商、trace 透传、错误映射完整可观测
- memory-service 故障时，`koduck-ai` 主 chat 流程可按 fail-open 策略继续运行
