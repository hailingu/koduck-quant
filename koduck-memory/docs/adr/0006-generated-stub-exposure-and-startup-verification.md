# ADR-0006: 统一暴露 generated stubs 并验证空 server 可启动

- Status: Accepted
- Date: 2026-04-12
- Issue: #798

## Context

Task 2.1 已经冻结了 `memory.v1` southbound contract，但 Task 2.2 要解决的是另外一层问题：

1. `tonic-build` 虽然已经在工作，但生成结果仍主要通过 `include_proto!` 的内部路径被零散引用。
2. server/client message types 没有统一的对外暴露入口，调用方需要知道较深的 generated module 结构。
3. 当前没有直接证明“空 server 使用生成的 stubs 可以注册并启动”的测试。

在进入 Task 2.4 和后续 `koduck-ai -> koduck-memory` 集成前，需要先把 generated stub 的
使用入口和启动基线稳定下来。

## Decision

### 继续使用 tonic-build 作为 stub 生成器

保留现有 `build.rs` 的 `tonic-build` 方案，继续生成：

1. contract stubs
2. memory service stubs
3. file descriptor set

同时保留 `cargo:rerun-if-changed=proto/...` 声明，确保 proto 变更会触发重编译。

### 在 api 层提供统一暴露入口

新增：

1. `api::contract`
2. `api::memory`

并在 `api::mod` 中统一 re-export：

1. request / response messages
2. `MemoryServiceClient`
3. `MemoryServiceServer`
4. `MemoryService` trait
5. `FILE_DESCRIPTOR_SET`

这样调用侧只依赖 `crate::api::...`，不必直接耦合 `include_proto!` 生成路径。

### 用启动测试验证空 server 可注册

新增异步测试：

1. 在临时端口上启动 `MemoryServiceServer`
2. 用 `MemoryServiceClient` 建连
3. 调用 `GetCapabilities`
4. 验证 service / contract version / default retrieve policy

这条测试证明：

1. generated server stub 可注册
2. generated client stub 可调用
3. 当前空骨架服务可完成最小启动闭环

## Consequences

### 正向影响

1. generated stubs 的使用入口更稳定，后续模块不必再感知 generated namespace 细节。
2. Task 2.4 和 Task 6.1 在接入时可以直接依赖统一的 `api` 模块。
3. “空 server 可注册启动”从隐含事实变成了明确测试保障。

### 权衡与代价

1. `api` 层增加了一层轻量 re-export，模块数稍微变多。
2. 为了做启动测试，引入了 `tokio-stream` 的 `net` feature。
3. 测试仍是最小闭环，只验证 stub 注册与调用，不覆盖真实业务实现。

### 兼容性影响

1. 现有内部引用路径从 `api::proto::memory::...` 收敛到 `api::...`，属于仓内实现整理。
2. 对外 southbound contract 本身没有新增 breaking change。

## Alternatives Considered

### 1. 保持直接引用 include_proto! 生成路径

- 未采用理由：generated namespace 对调用方暴露过深，不利于后续重构和统一使用方式。

### 2. 只依赖编译成功，不增加启动测试

- 未采用理由：编译通过并不能直接证明 server/client stubs 能组成最小运行闭环。

### 3. 把生成代码手动写入仓库

- 未采用理由：会增加 generated artifact 维护成本，也违背当前 `tonic-build` 流程。

## Verification

- `docker run --rm ... cargo test`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`
- `kubectl logs deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 任务清单: [koduck-memory-service-tasks.md](../implementation/koduck-memory-service-tasks.md)
- 前序 ADR: [0005-freeze-memory-v1-contract.md](./0005-freeze-memory-v1-contract.md)
- Issue: [#798](https://github.com/hailingu/koduck-quant/issues/798)
