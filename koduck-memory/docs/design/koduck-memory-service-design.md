# Koduck Memory 对接 Koduck AI 设计文档

## 1. 目的与范围

本文档定义 `koduck-memory` 作为 `koduck-ai` southbound first-class service 的设计基线，用于承接会话元数据真值、记忆写入、记忆检索、摘要与长期事实提炼。

本文档覆盖：

- 服务职责边界与目标架构
- `memory.v1` southbound 契约基线
- 数据模型、对象存储组织与 append 语义
- 默认检索策略、多租户隔离与生命周期治理
- 与 `koduck-ai` 的协作边界

本文档不覆盖：

- `koduck-tool-service` 内部执行引擎
- 向量检索设计
- 具体全文检索引擎产品选型

## 2. 结论先行

1. `koduck-memory` 是 `koduck-ai` 的 southbound gRPC 服务，不直接面向前端。
2. 会话元数据真值统一归 `koduck-memory` 管理，`koduck-ai` 不再本地持有 session truth。
3. `memory.v1` 是长期 southbound contract，`RequestMeta`、lineage 字段与检索策略语义已冻结。
4. L0 原始材料存放于 S3 兼容对象存储，dev 使用 MinIO；L1 索引、summary 与 facts 存放于 PostgreSQL。
5. `AppendMemory` 在对象存储侧采用“新增对象”实现 append，不依赖单对象原地追加。
6. V1 默认检索策略为 `DOMAIN_FIRST`，`SUMMARY_FIRST` 只做候选排除，`HYBRID` 保留为未来扩展。
7. 摘要、事实提炼与索引刷新采用异步任务化实现，不阻塞主写路径。
8. V1 明确支持多租户隔离与数据生命周期治理，不留作后续开放问题。

## 3. 职责边界

### 3.1 `koduck-memory` 负责

- 会话元数据管理
- 原始记忆写入与顺序控制
- 结构化索引生成与查询
- 会话摘要与长期事实提炼
- capability discovery 与契约版本声明

### 3.2 `koduck-memory` 不负责

- LLM 编排
- Tool 选择与执行
- 对外 northbound chat / stream API
- JWT / JWKS 认证中心能力

### 3.3 与 `koduck-ai` 的边界

`koduck-ai` 负责 orchestration、prompt 组装、模型调用、SSE 与错误映射；
`koduck-memory` 负责 session / memory truth、检索、摘要与事实持久化。

## 4. 契约基线

V1 最小 RPC 集合：

- `GetCapabilities`
- `UpsertSessionMeta`
- `GetSession`
- `QueryMemory`
- `AppendMemory`
- `SummarizeMemory`

`RequestMeta` 必填基线：

- `request_id`
- `session_id`
- `user_id`
- `tenant_id`
- `trace_id`
- `deadline_ms`
- `api_version`
- `idempotency_key`：对 `UpsertSessionMeta`、`AppendMemory`、`SummarizeMemory` 必填

会话元数据真值字段至少包括：

- `session_id`
- `tenant_id`
- `user_id`
- `parent_session_id`
- `forked_from_session_id`
- `title`
- `status`
- `last_message_at`
- `extra`

## 5. 存储与 append 语义

### 5.1 L0 对象存储

- 每条记忆落为独立对象，避免单对象重写竞争
- dev 使用 MinIO，prod 使用正式 S3 或兼容实现
- 对象 key 采用租户前缀组织，便于生命周期管理与权限边界控制

### 5.2 L1 结构化索引

- PostgreSQL 存储 `memory_sessions`、`memory_entries`、`memory_index_records`、`memory_summaries`、`memory_facts`、`memory_idempotency_keys`
- 查询至少支持 `tenant_id + session_id` 和 `tenant_id + domain_class` 两条高频路径
- `source_uri` / `l0_uri` 必须能回溯到 L0 原始材料

### 5.3 AppendMemory

- 同一 `session_id` 下保持单调顺序写入
- 幂等去重基于 `idempotency_key`
- 成功语义仅表示写入已接收并持久化，不代表摘要或索引刷新已完成

## 6. 检索策略

### 6.1 `DOMAIN_FIRST`

- 先按 `domain_class` 粗筛候选集
- 再叠加 session scope、summary 排除等辅助条件
- 作为 V1 默认主链路

### 6.2 `SUMMARY_FIRST`

- 在候选集内使用 summary 进行负向排除
- summary 不直接作为最终命中依据
- 无 summary 时回退结构化原文索引

### 6.3 `HYBRID`

- 仅保留为后续扩展能力
- V1 主链路与验收不依赖该策略

## 7. 关联文档

- 契约冻结：`../adr/0005-freeze-memory-v1-contract.md`
- AI 对接：`../adr/0019-koduck-ai-memory-southbound-integration.md`
- 对象存储与索引：`../adr/0014-l0-object-storage-implementation.md`、`../adr/0015-memory-index-records.md`
- 检索策略：`../adr/0016-domain-first-implementation.md`、`../adr/0017-summary-first-implementation.md`、`../adr/0018-hybrid-reserved-for-future.md`
- 运行时治理：`../adr/0020-memory-fail-open-strategy.md`、
  `../adr/0022-retry-and-compensation.md`、
  `../adr/0023-apisix-grpc-route-governance.md`、
  `../adr/0024-observability-and-slo.md`
