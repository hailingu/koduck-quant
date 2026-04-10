# ADR-0007: SSE 事件模型与高水位断点续流

- Status: Accepted
- Date: 2026-04-11
- Issue: #730

## Context

`koduck-ai` 的 `POST /api/v1/ai/chat/stream` 已经具备基础 SSE 输出能力，但当前实现仍然停留在“请求内直接透传”阶段：

1. **事件模型分散**：SSE 事件结构直接写在 `api/mod.rs` 中，尚未形成独立的流式传输模型
2. **断点续流缺失**：客户端断连后即丢失后续事件，`Last-Event-ID` 与 `from_sequence_num` 仅在设计文档中定义，尚未落地
3. **去重语义不稳定**：当前 done 事件使用固定大序号，无法为客户端的高水位去重提供稳定依据
4. **后续任务依赖**：Task 4.2（串行队列/背压）与 Task 4.3（cancel/generation 防护）都需要一个可缓存、可重放、可追踪的流式会话抽象

### 约束

- 需遵循 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md` 中的事件字段规范
- 构建验证必须通过容器方式完成，不依赖本地 cargo
- 当前阶段优先支持单会话单活动流的恢复语义，为后续队列化演进预留接口

## Decision

### 1. 抽取独立的 SSE 流模型模块

在 `src/stream/sse.rs` 中集中定义：

- `StreamEventData`：统一事件载荷，固定字段为 `event_id/sequence_num/event_type/payload/request_id/session_id`
- `PendingStreamEvent`：内部待归档事件，用于将上游原始事件标准化后再写入会话缓存
- `ResumeCursor`：统一封装 `Last-Event-ID` 与 `from_sequence_num`
- `StreamRegistry` / `StreamSession`：管理活动流、事件缓存与订阅关系

这使 SSE 事件模型从 API handler 中解耦，为后续 queue / lifecycle / cancel 模块复用提供基础。

### 2. 采用“按 session_id 维护活动流 + 会话级事件缓存”方案

为每个活动 `session_id` 维护一个 `StreamSession`：

- 首次请求创建会话并启动后台 producer
- producer 将 delta/done/error 事件依次写入内存缓存
- 客户端连接或重连时，先重放高水位之后的缓存事件，再订阅 live 事件

当前实现假设一个 `session_id` 在同一时刻仅有一个活动生成请求。新的非续流请求会替换旧会话。

### 3. 使用高水位策略处理续流与去重

恢复点按如下规则解析：

1. 优先读取请求体中的 `from_sequence_num`
2. 若存在 `Last-Event-ID`，则解析其尾部数字作为序号
3. 若无法从 `Last-Event-ID` 直接解析，则回查当前会话缓存中的 `event_id -> sequence_num`
4. 取两者最大值作为高水位，只重放 `sequence_num > high_watermark` 的事件

这样客户端只需维护“已消费最大序号”，即可天然去重。

### 4. 序号由服务端归一化，保证单调递增

对上游传入的 `sequence_num` 进行归一化：

- 若上游序号大于当前高水位，则保留
- 否则自动提升为 `current_high_watermark + 1`

`done`/`error` 事件也走相同的序号分配逻辑，不再使用固定哨兵值。

## Consequences

### 正向影响

1. **可恢复**：客户端人工断连后，可使用 `Last-Event-ID` / `from_sequence_num` 从最近高水位继续消费
2. **可去重**：所有事件序号单调递增，客户端按高水位过滤即可避免重复消费
3. **职责更清晰**：SSE 事件构造、缓存、重放逻辑不再散落在 API handler 中
4. **为后续任务铺路**：Task 4.2 可以在 `StreamSession` 基础上叠加串行队列/背压，Task 4.3 可以在 session 粒度增加 generation/cancel 防护

### 代价与风险

1. **内存占用增加**：活动流事件会暂存在进程内存中
2. **当前粒度较粗**：以 `session_id` 作为活动流键，暂不支持同一会话多并发生成
3. **跨进程恢复暂不支持**：缓存仅存在单实例内存中，实例切换后无法续流

### 缓解措施

1. 当前只保存活动会话的事件窗口，后续在 Task 4.2 引入更明确的排空与清理策略
2. 在 ADR 中明确“单会话单活动流”是假设，后续若需要多并发生成，再引入 `request_id + generation` 维度
3. 保持 `StreamRegistry` 抽象，后续可替换为 Redis / persistent queue 等跨实例实现

### 兼容性影响

- **北向 API 兼容**：接口路径和事件字段保持不变，新增的是可工作的断点续流语义
- **客户端兼容**：旧客户端仍可直接消费事件；新客户端可额外使用 `Last-Event-ID` 与 `from_sequence_num`
- **与后续 Phase 4 兼容**：该方案不与队列、背压、cancel 设计冲突，反而提供了共享状态容器

## Alternatives Considered

### 1. 断连后重新发起一条全新生成请求

- **优点**：实现简单，无需事件缓存
- **拒绝理由**：会导致重复生成、重复计费，且无法满足 Task 4.1 的“断点续流”要求

### 2. 仅靠 `Last-Event-ID` 做客户端本地去重，不在服务端保留任何缓存

- **优点**：服务端无状态
- **拒绝理由**：断连期间产生的事件无法补发，本质上仍不具备续流能力

### 3. 直接以 `request_id` 作为活动流唯一键

- **优点**：能天然区分并发请求
- **拒绝理由**：续流请求本身会生成新的 HTTP request_id；若没有额外映射，客户端仅凭 `session_id + Last-Event-ID` 难以恢复原流

## Verification

- 新增 `src/stream/sse.rs` 单元测试覆盖：
  - 序号单调递增
  - 高水位重放
  - live 事件去重
  - `Last-Event-ID` / `from_sequence_num` 联合解析
- `docker build -t koduck-ai:dev ./koduck-ai` 构建成功

## References

- 设计文档: [ai-decoupled-architecture.md](../../../docs/design/koduckai-rust-server/ai-decoupled-architecture.md)
- API 定义: [koduck-ai-api.yaml](../../../docs/design/koduckai-rust-server/koduck-ai-api.yaml)
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../../../docs/implementation/koduck-ai-rust-grpc-tasks.md)
- 前置 ADR: [ADR-0001](0001-init-rust-grpc-project-structure.md)
- Issue: [#730](https://github.com/hailingu/koduck-quant/issues/730)
