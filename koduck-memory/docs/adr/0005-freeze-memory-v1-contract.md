# ADR-0005: 冻结 memory.v1 southbound contract

- Status: Accepted
- Date: 2026-04-12
- Issue: #796

## Context

Task 2.1 的目标是把 `koduck-ai` 与 `koduck-memory` 之间的 `memory.v1` southbound contract
从“可工作的初稿”收敛为“后续阶段可以持续依赖的长期契约”。

在本次冻结前，proto 仍有几个明显问题：

1. `QueryMemory` 仍保留 `tags` 与 `KEYWORD_FIRST` 语义，但设计文档已经定稿为
   `domain_class` 与 `DOMAIN_FIRST`。
2. 会话链路字段如 `parent_session_id`、`forked_from_session_id`、`tenant_id`、`user_id`
   还没有完整进入 message 结构。
3. `RequestMeta` 里的必填约束没有在契约注释与服务校验中明确下来。
4. proto 没有预留明确扩展位，后续继续演化容易破坏 tag 稳定性。

Task 2.2 之后会基于这份契约生成 stub，Task 3/4/5 会继续在这个 tag 布局上实现真实语义，
所以本阶段必须先把编号、字段语义和默认检索策略定稳。

## Decision

### 将 memory.v1 明确为长期 southbound contract

在 `koduck-ai/proto` 与 `koduck-memory/proto` 两处 proto 中增加冻结说明，明确：

1. `memory.v1` 是 `koduck-ai -> koduck-memory` 的长期 southbound contract
2. 现有 tag 编号在 V1 生命周期内保持稳定
3. 扩展优先使用已预留的 tag 段，而不是重排既有字段

### 对齐 QueryMemory 的 V1 语义

把 `QueryMemoryRequest` 中的 `tags` 改为 `domain_class`，并把检索策略枚举改为：

1. `RETRIEVE_POLICY_DOMAIN_FIRST`
2. `RETRIEVE_POLICY_SUMMARY_FIRST`
3. `RETRIEVE_POLICY_HYBRID`

不再把 `KEYWORD_FIRST` 保留为 V1 正式语义，避免和设计文档冲突。

### 补齐会话真值与 lineage 相关字段

在 `UpsertSessionMetaRequest` / `SessionInfo` 中显式冻结以下字段：

1. `tenant_id`
2. `user_id`
3. `parent_session_id`
4. `forked_from_session_id`
5. `last_message_at`

这样 Task 3 的 session truth 实现可以直接基于稳定字段展开。

### 明确 RequestMeta 必填规则

将以下字段明确为所有 `memory.v1` RPC 的基础必填项：

1. `request_id`
2. `session_id`
3. `user_id`
4. `tenant_id`
5. `trace_id`
6. `deadline_ms`
7. `api_version`

同时把 `idempotency_key` 明确为 `UpsertSessionMeta`、`AppendMemory`、
`SummarizeMemory` 这类写/任务投递路径的必填项，并在 `koduck-memory` 的 skeleton
校验逻辑中同步执行。

### 为 V1 预留扩展 tag

在 `RequestMeta` 和各个关键 message / enum 中预留小范围 tag 段，给后续：

1. more retrieval filters
2. richer memory metadata
3. backward-compatible capability expansion

留下演进空间，而不破坏已冻结布局。

## Consequences

### 正向影响

1. Task 2.2 生成的 server/client stub 将基于更稳定的字段布局。
2. Task 3 的 session truth 和 lineage 语义不再依赖临时字段或额外解释。
3. `QueryMemory` 的默认路径正式切换为设计定稿的 `DOMAIN_FIRST`。
4. `RequestMeta` 校验范围更明确，后续错误语义更容易统一。

### 权衡与代价

1. 这是一次 pre-freeze 的 breaking alignment，会让当前早期 proto 与最初 skeleton 有差异。
2. 仓库中 `koduck-ai` 与 `koduck-memory` 双份 proto 需要保持同步，短期内有维护成本。
3. 目前只是冻结字段与语义，不代表业务实现已经完成；真实功能仍由后续任务承接。

### 兼容性影响

1. `RETRIEVE_POLICY_KEYWORD_FIRST` 不再作为 `memory.v1` 的正式 V1 策略。
2. `QueryMemoryRequest.tags` 被 `domain_class` 取代，后续调用方必须按新字段语义生成请求。
3. 写路径缺少 `idempotency_key` 时，`koduck-memory` skeleton 会更早返回参数错误。

## Alternatives Considered

### 1. 保持当前 proto 不动，只在 ADR 中声明真实语义

- 未采用理由：字段和设计分离会把 Task 2.2 之后的 stub 建立在错误契约上。

### 2. 等 Task 3/4 开始实现时再一起修 proto

- 未采用理由：那时会把契约冻结与业务实现耦合，回滚和评审成本更高。

### 3. 只更新 koduck-memory 本地 proto，不同步 koduck-ai

- 未采用理由：会让 southbound 调用方和服务端对同一契约拥有不同事实来源。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`
- `kubectl logs deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0004-minio-bootstrap-and-bucket-init.md](./0004-minio-bootstrap-and-bucket-init.md)
- Issue: [#796](https://github.com/hailingu/koduck-quant/issues/796)
