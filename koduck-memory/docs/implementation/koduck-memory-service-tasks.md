# Koduck Memory 对接 Koduck AI 实施任务清单

> 对应设计文档： [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
>
> 状态：执行中
> 创建日期：2026-04-11

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
| ---- | ---- | ---- | ------ |
| Phase 1 | 基础设施与项目骨架 | - | P0 |
| Phase 2 | 契约与数据基线 | Phase 1 | P0 |
| Phase 3 | Session 真值能力 | Phase 2 | P0 |
| Phase 4 | L0 写入与 append 语义 | Phase 3 | P0 |
| Phase 5 | L1 索引与默认检索路径 | Phase 4 | P0 |
| Phase 6 | Koduck AI 集成与治理 | Phase 3, Phase 4, Phase 5 | P0 |
| Phase 7 | 异步摘要与长期事实 | Phase 4, Phase 5 | P1 |
| Phase 8 | 部署、观测与灰度 | Phase 6, Phase 7 | P1 |

## Phase 1 到 Phase 5：服务内能力基线

已由以下 ADR 收口：

- Phase 1：`ADR-0001` 到 `ADR-0004`
- Phase 2：`ADR-0005` 到 `ADR-0008`
- Phase 3：`ADR-0009` 到 `ADR-0011`
- Phase 4：`ADR-0012` 到 `ADR-0014`
- Phase 5：`ADR-0015` 到 `ADR-0018`

这些阶段覆盖：

- 服务骨架、配置、PostgreSQL、MinIO 基础设施
- `memory.v1` 契约冻结、stub 生成、迁移基线与 capabilities
- session repository、`GetSession`、`UpsertSessionMeta`
- `memory_entries`、`AppendMemory`、L0 对象存储
- `memory_index_records` 与 `DOMAIN_FIRST` / `SUMMARY_FIRST` / `HYBRID` 语义

## Phase 6：Koduck AI 集成与治理

当前要求：

1. 通过 APISIX southbound gRPC route 与 `koduck-ai` 对接。
2. 保证 `request_id/session_id/user_id/tenant_id/trace_id` 全链路透传。
3. 支持 `koduck-ai` 在 chat / stream 主链路中调用 `GetSession`、`UpsertSessionMeta`、`QueryMemory`、`AppendMemory`。
4. 将 `X-Tenant-Id` 纳入 northbound / southbound 路由统一透传与 OTel attributes。

设计与执行入口：

- `ADR-0019-koduck-ai-memory-southbound-integration.md`
- `ADR-0020-capability-negotiation-integration.md`
- `ADR-0023-apisix-grpc-route-governance.md`

## Phase 7：异步摘要与长期事实

当前要求：

1. `SummarizeMemory` 采用异步任务化实现。
2. 结果落库到 `memory_summaries` 与 `memory_facts`。
3. 不阻塞 `AppendMemory` 主路径。
4. 失败路径具备补偿、重试与可观测能力。

设计与执行入口：

- `ADR-0020-async-summary-task-materialization.md`
- `ADR-0021-async-facts-extraction.md`
- `ADR-0022-retry-and-compensation.md`

## Phase 8：部署、观测与灰度

当前要求：

1. 完成 K8s 部署、secret 与 bucket/DB 依赖接入。
2. 建立 API / gRPC / 对象存储 / 异步任务的观测基线与 SLO。
3. 形成 canary、rollback 与 drill 文档。

设计与执行入口：

- `ADR-0023-apisix-grpc-route-governance.md`
- `ADR-0024-observability-and-slo.md`
- `ADR-0024-canary-and-rollback-drill.md`
- `../../docs/adr/4001-koduck-memory-k8s-deploy-integration.md`
