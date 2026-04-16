# ADR-0039: 异步摘要任务与摘要物化

- Status: Accepted
- Date: 2026-04-12
- Issue: #831

## Context

`koduck-memory` 之前已经完成了会话元数据、原始记忆写入和基础检索路径，
但 `SummarizeMemory` 仍然只是占位实现。按照设计文档，
Task 7.1 需要满足三件事：

1. `SummarizeMemory` 只负责投递任务，不阻塞主链路。
2. 摘要结果要落到 `memory_summaries`。
3. 生成出来的 `domain_class` 需要能被 `DOMAIN_FIRST` 检索消费。

如果只把摘要文本写入 `memory_summaries`，而不把它物化进当前检索路径，
那么 session 级摘要就无法参与现有 `QueryMemory`。反过来，如果把摘要同步生成，
又会违背“主链路 fail-open、摘要异步化”的要求。

## Decision

我们决定采用“异步投递 + 双写物化”的最小闭环：

1. `SummarizeMemory` RPC 只负责：
   - 校验 `RequestMeta`
   - 基于 `idempotency_key` 去重
   - 投递后台 `tokio::spawn` 任务
   - 立即返回 accepted 响应
2. 后台任务通过 `SummaryTaskRunner` 执行：
   - 读取 `memory_entries`
   - 结合 session 标题与最近消息生成确定性摘要文本
   - 推断粗粒度 `domain_class`
   - 将结果写入 `memory_summaries`
3. 每次摘要完成后，再额外生成一条 `memory_index_records`：
   - `memory_kind = "summary"`
   - `domain_class =` 推断结果
   - `summary/snippet =` 生成的摘要文本
   - `source_uri = memory-summary://...`

## Consequences

正面影响：

1. `SummarizeMemory` 真正变成任务投递接口，不再阻塞主链路。
2. `memory_summaries` 成为摘要真值表，后续 facts / retry / compensation 可以继续叠加。
3. `DOMAIN_FIRST` 不需要改协议和主逻辑，就能直接消费摘要物化结果。

代价与权衡：

1. 当前摘要生成仍是规则化实现，不依赖 LLM，因此质量优先保证稳定和可解释，而不是语义最优。
2. 摘要会同时存在于 `memory_summaries` 和 `memory_index_records`，带来可接受的冗余。
3. 失败处理目前先靠日志告警；系统化重试和补偿留给 Task 7.3。

## Compatibility Impact

1. 不修改 `memory.v1` protobuf tag，也不引入 breaking change。
2. `SummarizeMemoryResponse.summary` 现在返回 accepted 文案，而不是占位错误，属于向前兼容增强。
3. `QueryMemory` 继续走既有的 `memory_index_records`，不需要额外 northbound 适配。

## Alternatives Considered

### Alternative A: 直接同步生成摘要并在 RPC 中返回结果

未采用。  
这会直接把摘要生成延迟暴露到主链路，违背设计文档对异步任务化的约束。

### Alternative B: 只写 `memory_summaries`，不写 `memory_index_records`

未采用。  
这样虽然有了摘要真值，但现有 `DOMAIN_FIRST` 路径无法消费 `domain_class` 结果，
Task 7.1 的第二条验收标准无法成立。

### Alternative C: 引入独立任务表/队列系统

本阶段未采用。  
这是更完整的长期方向，但会把 Task 7.1 扩大成任务系统建设。
当前先用进程内后台任务完成“最小可运行闭环”，后续在 Task 7.3 再补重试与补偿。
