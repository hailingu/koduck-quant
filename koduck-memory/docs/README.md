# koduck-memory Docs

## Design Baseline

- [koduck-memory-service-design.md](./design/koduck-memory-service-design.md)
- `koduck-memory` 与 `koduck-ai` 的 southbound 一体化设计入口，
  统一收敛到 `ADR-0005` 与 `ADR-0019`
- `memory.v1` 是长期 southbound contract，`session_id`、`tenant_id`、
  `user_id`、`parent_session_id`、`forked_from_session_id` 等字段语义已冻结
- 会话真值、记忆索引、摘要与长期事实提炼由 `koduck-memory` 管理，`koduck-ai` 只负责 orchestration

## Implementation

- [koduck-memory-service-tasks.md](./implementation/koduck-memory-service-tasks.md)

## Storage And Retrieval

- L0 原始材料对象存储：`ADR-0014`
- L1 索引模型：`ADR-0015`
- 默认检索策略 `DOMAIN_FIRST`：`ADR-0016`
- `SUMMARY_FIRST` 排除策略：`ADR-0017`
- `HYBRID` 仅保留为未来扩展：`ADR-0018`
- `多锚点与 memory_unit 检索架构`：`ADR-0025`

## Integration

- `koduck-ai` 对接入口：`ADR-0019`
- fail-open 策略：`ADR-0020-memory-fail-open-strategy.md`
- 异步摘要与长期事实：`ADR-0020-async-summary-task-materialization.md`、`ADR-0021-async-facts-extraction.md`
- 重试补偿、APISIX gRPC 治理、观测与灰度：`ADR-0022`、`ADR-0023`、`ADR-0024`

## Notes

- 原先位于仓库根目录的 `koduck-memory` 设计与任务清单，
  现已并入本目录的 design / implementation 入口以及 `koduck-ai`
  的接入文档，不再单独维护。

## Decisions

- See [adr/](./adr/)
