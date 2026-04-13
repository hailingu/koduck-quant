# ADR-0017: SUMMARY_FIRST 检索策略实现

- Status: Accepted
- Date: 2026-04-12
- Issue: #821

## Context

Task 5.3 要求实现 `SUMMARY_FIRST` 检索策略。在 Task 5.2 完成后，`retrieve/` 模块已有 `DomainFirstRetriever`，支持按 `domain_class` 过滤。

`SUMMARY_FIRST` 策略需要在 `domain_class` 候选集的基础上，使用 `summary` 字段进行进一步筛选。根据设计文档，summary 只用于排除不合适候选，不作为最终选中条件。

需要解决：
1. 如何在 `domain_class` 候选集内使用 `summary` 进行筛选。
2. 无 summary 匹配时如何回退到结构化原文索引。
3. 如何生成 `summary_hit` match_reason。
4. 如何与现有的 `DomainFirstRetriever` 共享代码。

## Decision

### 策略实现：`SummaryFirstRetriever`

在 `retrieve/` 模块新增 `SummaryFirstRetriever`：

1. **两阶段检索**：
   - 阶段 1：使用 `DomainFirstRetriever` 获取 `domain_class` 候选集。
   - 阶段 2：在候选集内使用 PostgreSQL 全文搜索（`to_tsvector/to_tsquery`）匹配 `summary`。

2. **Summary 筛选逻辑**：
   - 使用 `search_by_summary` Repository 方法执行全文搜索。
   - 匹配 summary 的记录标记 `summary_hit`。
   - 不匹配的记录仍保留在结果中（summary 只用于排除不作为选中条件）。

3. **回退策略**：
   - 如果 `query_text` 为空或无法生成有效的 tsquery，回退到 `DomainFirstRetriever`。
   - 如果 summary 搜索无结果，返回 domain_class 候选集（无 summary_hit）。

### 与 QueryMemory 集成

`MemoryGrpcService::query_memory` 方法：
- 当 `retrieve_policy == SUMMARY_FIRST (2)` 时，调用 `SummaryFirstRetriever`。
- 当 `retrieve_policy` 为其他值时，回退到 `DomainFirstRetriever`。

### Match Reasons

`SummaryFirstRetriever` 返回的 match_reasons 包含：
- `domain_class_hit`：来自阶段 1 的 domain_class 过滤。
- `summary_hit`：记录匹配了 summary 搜索（仅当实际匹配时）。
- `session_scope_hit`：如果指定了 session 范围（可选）。

## Consequences

### 正向影响

1. `SUMMARY_FIRST` 策略提供基于 summary 的语义筛选能力。
2. 两阶段检索设计复用 `DomainFirstRetriever`，保持代码一致性。
3. 全文搜索使用 PostgreSQL GIN 索引，无需额外依赖。

### 权衡与代价

1. 两阶段查询可能增加数据库访问次数（可通过优化合并查询）。
2. 全文搜索质量依赖 PostgreSQL 的简单词典，复杂场景可能需要专用搜索引擎。
3. summary 筛选是正向包含而非负向排除，与设计文档的"排除不合适候选"略有差异，但更符合实际检索需求。

### 兼容性影响

1. 无 proto 变更，完全向后兼容。
2. 无数据库 migration 变更，依赖 Task 5.1 创建的 GIN 索引。

## Alternatives Considered

### 1. 在应用层执行 summary 筛选

- 未采用理由：数据库层的全文搜索更高效，且已有 GIN 索引支持。

### 2. 仅返回 summary 匹配的记录

- 未采用理由：设计文档要求 summary 用于"排除"而非最终选中，保留非匹配记录符合 fail-open 原则。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 任务清单: [koduck-memory-service-tasks.md](../implementation/koduck-memory-service-tasks.md)
- 前序 ADR: [0016-domain-first-implementation.md](./0016-domain-first-implementation.md)
- Issue: [#821](https://github.com/hailingu/koduck-quant/issues/821)
