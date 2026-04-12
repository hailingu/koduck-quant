# ADR-0016: DOMAIN_FIRST 检索策略实现

- Status: Accepted
- Date: 2026-04-12
- Issue: #819

## Context

Task 5.2 要求实现 `DOMAIN_FIRST` 检索策略。在 Task 5.1 完成后，`index/` 模块已有 `MemoryIndexRepository`，支持按 `domain_class` 和 `session_id` 查询。

`QueryMemory` gRPC handler 当前返回 `NOT_IMPLEMENTED`，需要实现完整的检索逻辑。

需要解决：
1. 如何组织检索模块的架构（检索策略 vs 数据访问）。
2. 如何实现 `DOMAIN_FIRST` 策略：先按 `domain_class` 过滤，再支持 session 范围限制。
3. 如何生成正确的 `match_reasons`（`domain_class_hit`, `session_scope_hit`）。
4. 如何处理 `top_k` 限制和分页。

## Decision

### 模块架构

在 `retrieve/` 模块实现检索策略：

```
retrieve/
├── mod.rs          # 模块入口，暴露策略类型
├── domain_first.rs # DOMAIN_FIRST 策略实现
└── types.rs        # 检索相关类型（RetrieveContext, RetrieveResult）
```

### DOMAIN_FIRST 策略

1. **输入**：`QueryMemoryRequest` 包含 `domain_class`, `session_id`, `top_k`, `query_text`。
2. **过滤逻辑**：
   - 优先使用 `domain_class` 查询 `memory_index_records`。
   - 如果 `session_id` 非空，额外限制在指定 session 范围内。
3. **排序**：按 `updated_at DESC`（最近更新优先）。
4. **限制**：应用 `top_k` 限制结果数量。
5. **Match Reasons**：
   - `domain_class_hit`：记录匹配了请求的 `domain_class`。
   - `session_scope_hit`：记录在请求的 `session_id` 范围内（仅当 session_id 指定时）。

### 与 QueryMemory 集成

`MemoryGrpcService::query_memory` 方法：
1. 验证请求参数。
2. 根据 `retrieve_policy` 选择策略实现。
3. 对于 `DOMAIN_FIRST`，调用 `DomainFirstRetriever`。
4. 将 `MemoryIndexRecord` 转换为 `MemoryHit`。

### Domain Class 定义

V1 支持以下粗粒度 domain_class：
- `chat`：普通对话
- `task`：任务执行
- `system`：系统消息
- `summary`：摘要内容
- `fact`：长期事实

客户端可以通过 `domain_class` 参数指定要检索的领域。

## Consequences

### 正向影响

1. `QueryMemory` 从 stub 变为可工作的 RPC。
2. `DOMAIN_FIRST` 策略提供简单有效的粗粒度过滤。
3. `match_reasons` 支持可解释性。

### 权衡与代价

1. 当前实现仅支持 PostgreSQL 查询，不依赖外部搜索引擎。
2. `score_hint` 字段尚未用于排序，仅作为数据保留。
3. 全文搜索能力有限，复杂查询将在 Task 5.3 (SUMMARY_FIRST) 中增强。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 无数据库 migration 变更，依赖 Task 5.1 创建的索引。

## Alternatives Considered

### 1. 在 Repository 层直接实现策略

- 未采用理由：检索策略可能涉及多个 Repository 组合，单独模块更清晰。

### 2. 使用外部搜索引擎（如 Elasticsearch）

- 未采用理由：V1 明确不引入额外依赖，PostgreSQL 足够支持基础需求。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0015-memory-index-records.md](./0015-memory-index-records.md)
- Issue: [#819](https://github.com/hailingu/koduck-quant/issues/819)
