# ADR-0021: 异步长期事实提炼

- Status: Accepted
- Date: 2026-04-12
- Issue: #833

## Context

Task 7.1 已经让 `SummarizeMemory` 具备了异步摘要物化能力，
但设计文档同时要求后台任务继续提炼长期事实，并将结果落到 `memory_facts`。

Task 7.2 的约束有两条：

1. facts 必须作为独立材料存储，不能只藏在 summary 文本里。
2. facts 提炼失败不能阻塞主链路，也不能影响已经成功写入的 summary。

与此同时，当前 `QueryMemory` southbound 契约已经被 `koduck-ai` 消费，
Task 7.2 不能为了接 facts 而引入新的 gRPC 字段或强迫调用方升级。

## Decision

我们决定沿用 Task 7.1 的进程内异步任务框架，在 `SummaryTaskRunner` 内追加 facts 提炼步骤：

1. 先按既有流程生成并持久化 `memory_summaries`。
2. 基于 session 标题和最近 transcript 做规则化候选 facts 提炼：
   - `session_focus`
   - `preference`
   - `constraint`
   - `task_context`
3. 候选 facts 独立写入 `memory_facts`：
   - `fact_type`
   - `domain_class`
   - `fact_text`
   - `confidence`
4. facts 写入采用“best effort”：
   - summary 已成功后，再尝试插入 facts
   - 若 facts 插入失败，只记录结构化 warning，不回滚 summary，也不影响 RPC 已返回的 accepted 结果

## Consequences

正面影响：

1. `memory_facts` 成为长期事实的独立真值表，后续可独立做 retention、补偿与检索增强。
2. 主链路仍然只有任务投递，不会因为 facts 提炼而增加 `SummarizeMemory` 或 `AppendMemory` 的同步延迟。
3. `QueryMemory` 协议与当前检索链路保持不变，northbound 不需要联动升级。

代价与权衡：

1. 当前 facts 提炼仍是规则化实现，优先保证稳定、可预测和易测试，不追求语义覆盖率最大化。
2. facts 目前只按 `session_id` 与 `domain_class` 建立关联，尚未引入独立 source URI；更细粒度追溯可在后续任务中补强。
3. facts 暂未直接物化进 `memory_index_records`，因此不会马上影响既有查询结果排序。

## Compatibility Impact

1. 不修改 `memory.v1` protobuf，不增加 breaking change。
2. `SummarizeMemoryResponse` 仍然只返回 accepted 语义，调用方无须理解 facts 细节。
3. `QueryMemory` 现有 `DOMAIN_FIRST / SUMMARY_FIRST` 语义保持稳定，不会因为 Task 7.2 产生新的返回类型。

## Alternatives Considered

### Alternative A: 在 `AppendMemory` 主路径中同步提炼 facts

未采用。  
这会直接违背设计文档对“摘要/事实任务异步化”和主链路 fail-open 的要求。

### Alternative B: 将 facts 直接追加进 `memory_index_records`

本阶段未采用。  
这样能更快被检索消费，但会改变当前查询语义和结果构成，不符合 Task 7.2 “保持现有 QueryMemory 契约兼容”的边界。

### Alternative C: 只把候选 facts 拼进 summary 文本

未采用。  
这无法满足“facts 可独立存储”的验收标准，也不利于后续独立 retention 与补偿。
