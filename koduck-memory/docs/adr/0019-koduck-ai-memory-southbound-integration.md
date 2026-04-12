# ADR-0019: Koduck AI 通过 APISIX 接入 Koduck Memory

- Status: Accepted
- Date: 2026-04-12
- Issue: #825

## Context

`koduck-memory` 在前序任务中已经完成了 `GetSession`、`UpsertSessionMeta`、
`QueryMemory`、`AppendMemory` 的 contract、存储基线和默认检索路径，
但 `koduck-ai` 仍然没有把这些能力真正接入主 chat / stream 链路。

这会带来三个问题：

1. `koduck-ai` 仍然在入口层隐式持有 session 真值，无法保证与 memory service 一致。
2. `request_id/session_id/trace_id/tenant_id` 没有以统一 southbound contract 透传到 memory。
3. Memory 检索结果没有进入 prompt，append 也没有跟随真实对话 turn 落库。

同时，网关层虽然已经存在面向 memory/tool 的 southbound gRPC route，
但 northbound AI 路由和 southbound gRPC 路由都还没有把 `X-Tenant-Id`
作为统一头部透传的一部分。

## Decision

我们决定采用以下集成方式：

1. `koduck-ai` 每次新 chat / stream 请求都先通过 APISIX gRPC route 调用
   `GetSession`、`UpsertSessionMeta`、`QueryMemory`。
2. `koduck-ai` 不再把 session 元数据作为本地真值保存；
   本地只保留 `session_id` 作为请求上下文，session 真值以 `koduck-memory` 返回为准。
3. `QueryMemory` 命中的 snippet 会被组装成一条独立 system message 注入 LLM prompt，
   仅作为相关上下文使用，不直接替代模型回答。
4. 每次成功的 turn 在 `koduck-ai` 侧以 user / assistant entries 形式调用
   `AppendMemory` 落库，并透传 `request_id/session_id/user_id/tenant_id/trace_id`。
5. `parent_session_id`、`forked_from_session_id`、`title`、`status`
   从 northbound request metadata 透传到 `UpsertSessionMeta`。
6. APISIX 的 northbound AI 路由和 southbound memory/tool gRPC 路由统一增加
   `X-Tenant-Id` 透传，并把 `x-tenant-id` 加入 OTel header attributes。

## Consequences

正面影响：

1. `koduck-ai` 和 `koduck-memory` 的职责边界变得明确：
   `koduck-ai` 负责 orchestration，`koduck-memory` 负责 session / memory truth。
2. `RequestMeta` 全链路透传真正落地，为后续 6.2 的 fail-open、
   8.x 的观测和灰度提供稳定上下文。
3. APISIX 继续作为统一 southbound gRPC 治理入口，没有在 `koduck-ai`
   内引入直连 memory 的旁路。

代价与约束：

1. chat / stream 入口增加了 memory 预处理 RPC，链路复杂度和请求延迟会上升。
2. stream 场景需要在完成后再回写 assistant entry，代码路径比非流式更复杂。
3. 当前阶段先实现“同步接入 + 严格依赖”，memory 故障下的 fail-open 行为
   仍需要在 Task 6.2 中继续收口。

## Compatibility Impact

1. 这次变更不修改 `memory.v1` protobuf tag，也不引入 breaking contract change。
2. `koduck-ai` 的 northbound HTTP API 保持兼容；
   新增的 lineage / retrieve metadata 仍通过原有 `metadata` 扩展字段承载。
3. APISIX 路由新增 `X-Tenant-Id` 透传属于向后兼容增强：
   老调用方无需改动，但缺失 tenant 上下文的请求会在 `koduck-ai`
   认证阶段被拒绝，而不是带着空 tenant 进入 memory。

## Alternatives Considered

### Alternative A: `koduck-ai` 继续本地维护 session 真值，仅把 append/query 下沉

未采用。  
这会形成“双真值”结构，违背本文档与主设计文档中“session truth 属于 memory service”的约束。

### Alternative B: `koduck-ai` 直连 `koduck-memory` gRPC，不经过 APISIX

未采用。  
这会绕过 southbound 统一治理入口，丢失限流、重试、trace header 和统一路由策略。

### Alternative C: 先只接 `QueryMemory`，把 `GetSession / UpsertSessionMeta / AppendMemory` 留到后续

未采用。  
Task 6.1 的目标就是建立完整 southbound 主链路；
只接检索无法证明 `koduck-ai` 已经放弃本地 session truth。
