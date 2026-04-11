# ADR-0008: 串行流队列与优雅停机生命周期

- Status: Accepted
- Date: 2026-04-11
- Issue: #732

## Context

Task 4.1 已经为 `koduck-ai` 落地了统一 SSE 事件模型、断点续流和高水位去重，但流式写路径仍存在两个明显缺口：

1. **缺少串行发送队列**：producer 任务直接写入 session 状态与广播通道，遇到突发输出或慢消费时，缺乏明确的有界缓冲与超时语义
2. **缺少服务级生命周期管理**：进程收到停机信号后，当前实现只是广播 shutdown，尚未做到“拒新流量 -> 排空队列 -> cleanup -> failsafe”

根据设计文档 7.2，`koduck-ai` 的流式可靠性必须覆盖：

- 顺序与背压：写路径串行批处理，避免乱序与失控堆积
- 生命周期：统一 `AbortSignal + timeout + cleanup` 封装
- 优雅停机：停止新请求、排空队列、有界清理、超时 failsafe 退出

## Decision

### 1. 为每个活动流引入有界串行队列

在 `src/stream/queue.rs` 中新增通用 `StreamQueue<T>` 抽象：

- 使用 `tokio::sync::mpsc` 有界通道控制内存上限
- 通过 `enqueue_timeout` 控制背压等待时间
- 队列满且超时时，返回明确的 `Timeout` 错误

`StreamSession` 不再直接 `append_event`，而是统一通过 `enqueue_event` 入队，再由单 worker 按顺序出队并写入：

- session 历史缓存
- SSE broadcast channel
- 完成态标记

这样可以确保“单请求单写路径”，避免多 producer 直接竞争 session 状态。

### 2. 背压策略采用“有界队列 + 超时失败”

新增流配置：

- `stream.queue_capacity`
- `stream.enqueue_timeout_ms`

当队列已满且超过超时预算时：

- producer 不再无限阻塞
- 当前流会被强制写入一个终止性 error 事件
- 事件 code 使用 `STREAM_TIMEOUT`

该策略的核心目标是防止在慢消费或停机边界场景下，流事件无限堆积导致进程内存失控。

### 3. 引入生命周期管理器统一拒新流量与排空逻辑

在 `src/app/lifecycle.rs` 中新增 `LifecycleManager`：

- 维护 `accepting_requests` 标志
- 跟踪活动流数量
- 在 shutdown 时先切换到 draining 模式
- 等待活动流在 `shutdown_drain_timeout` 内自行排空
- 若超时，则调用 `StreamRegistry::force_shutdown_active(...)`
- 再进入有限 cleanup 窗口；若仍未完成，则记录 failsafe 日志并继续进程终止

北向 `chat` / `chat_stream` 在 draining 模式下统一拒绝新请求，返回 `SERVER_BUSY`。

### 4. 强制终止采用“补写 terminal error + 丢弃后续事件”

当出现两类场景时，session 会被强制进入完成态：

1. 队列背压超时
2. 服务优雅停机排空超时

实现方式：

- 直接向 session 历史和广播通道补写 terminal `error` 事件
- 将 session 标记为 `completed`
- 释放 active stream lease
- 后续 worker 若再收到遗留事件，直接丢弃，不再继续写出

这保证了停机阶段不会出现“终止事件之后又冒出 delta”的乱序行为。

## Consequences

### 正向影响

1. **有界内存**：活动流未发送事件的积压量受 `queue_capacity` 约束
2. **顺序稳定**：所有流事件都走同一条 worker 出队路径，不再由多个 producer 直接写 session
3. **停机更可控**：新请求会在 draining 阶段被拒绝，活动流有明确排空和 cleanup 窗口
4. **失败可观测**：背压超时和停机超时都会留下日志与终止性流事件，便于排查

### 代价与风险

1. **配置项增加**：流式配置比 Task 4.1 多了队列和 shutdown 相关参数
2. **实现复杂度提升**：session 从“直接写状态”升级为“入队 + worker + lifecycle lease”
3. **强制终止可能截断剩余 delta**：在极端背压或停机超时场景下，部分未出队 delta 会被丢弃

### 缓解措施

1. 配置全部提供合理默认值，保证对现有开发环境零额外配置即可运行
2. 强制终止时补写 terminal error，确保客户端能感知异常终止而非无声断流
3. 在 ADR 中明确该策略是可靠性优先的 tradeoff，后续若需要可升级为更细粒度的 per-client queue / durable buffer

### 兼容性影响

- **北向 API 兼容**：chat/chat stream 路径与 SSE 事件字段不变
- **客户端兼容**：旧客户端仍可直接消费；新客户端会在停机或背压失败时收到标准 error 终止事件
- **与 Task 4.3 兼容**：LifecycleManager 和 active stream lease 为后续 generation/cancel 防护提供了共享挂载点

## Alternatives Considered

### 1. 继续直接写 session，不引入队列

- **优点**：实现简单
- **拒绝理由**：无法给背压提供容量与超时边界，也无法保证未来多 producer 演进时的顺序语义

### 2. 使用无界队列

- **优点**：实现更直接，producer 不易失败
- **拒绝理由**：在慢消费或停机边界会导致内存失控增长，不符合 Task 4.2 验收目标

### 3. 收到停机信号后立即硬退出

- **优点**：停机逻辑简单
- **拒绝理由**：会丢失正在发送中的流，不满足“停机时无半包/乱序事件”的目标

## Verification

- `src/stream/queue.rs` 单元测试验证有界队列超时行为
- `src/app/lifecycle.rs` 单元测试验证 active stream 排空等待
- `src/stream/sse.rs` 单元测试覆盖：
  - 顺序出队与单调序号
  - 高水位续流
  - force shutdown 终止态
- `docker build -t koduck-ai:dev ./koduck-ai` 构建成功

## References

- 设计文档: [ai-decoupled-architecture.md](../design/ai-decoupled-architecture.md)
- API 定义: [koduck-ai-api.yaml](../design/koduck-ai-api.yaml)
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../implementation/koduck-ai-rust-grpc-tasks.md)
- 前置 ADR: [ADR-0007](0007-sse-resume-with-high-watermark.md)
- Issue: [#732](https://github.com/hailingu/koduck-quant/issues/732)
