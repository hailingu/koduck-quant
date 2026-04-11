# ADR-0001: 初始化 koduck-memory Rust + gRPC 项目目录结构

- Status: Accepted
- Date: 2026-04-12
- Issue: #788

## Context

根据 `docs/design/koduck-memory-for-koduck-ai.md` 与
`docs/implementation/koduck-memory-koduck-ai-tasks.md`，`koduck-memory` 需要作为
`koduck-ai` 的 southbound first-class service，统一承接会话元数据真值、记忆写入、
检索、摘要与长期事实提炼。

Task 1.1 的目标不是直接实现 Memory 全量业务，而是先建立一套与 `koduck-ai` /
`koduck-auth` 风格一致、可独立构建、可在 dev 集群滚动发布的服务骨架，为后续
Task 1.2 及之后的契约、数据与检索能力提供落脚点。

### 约束

1. 目录结构必须与设计文档保持一致。
2. 启动流程必须覆盖配置加载、gRPC server、metrics 与优雅停机。
3. 服务必须能通过 `docker build -t koduck-memory:dev ./koduck-memory`。
4. dev overlay 需要具备最小可 rollout 的部署清单。

## Decision

### 项目结构

建立独立 Rust 服务目录：

```text
koduck-memory/
├── Cargo.toml
├── Cargo.lock
├── build.rs
├── Dockerfile
├── .dockerignore
├── config/
│   └── default.toml
├── proto/
│   └── koduck/
│       ├── contract/v1/shared.proto
│       └── memory/v1/memory.proto
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── app/
│   ├── api/
│   ├── capability/
│   ├── session/
│   ├── memory/
│   ├── retrieve/
│   ├── summary/
│   ├── store/
│   ├── index/
│   ├── config/
│   ├── reliability/
│   └── observe/
└── docs/adr/
```

### 启动模型

采用与现有 Rust 服务一致的双监听模式：

1. 启动时加载 `config/default.toml`，并允许 `KODUCK_MEMORY__...` 环境变量覆盖。
2. 启动结构化日志，输出服务名、版本、环境、gRPC 地址、metrics 地址。
3. 暴露 gRPC server，注册 `MemoryService`、gRPC health 与 reflection。
4. 在 metrics 端口暴露 `/healthz` 与 `/metrics`。
5. 使用 `tokio::select!` + `Ctrl+C` 完成优雅停机。

### 契约处理

在 Phase 1 仅复制并编译 `shared.proto` 与 `memory.proto`，通过 `build.rs`
生成 tonic server/client stub，但仅实现：

- `GetCapabilities` 返回最小可用 capability 信息
- 其余 RPC 返回结构化 `NOT_IMPLEMENTED` 占位响应

这样可以保证：

1. southbound contract 编译链路已经打通
2. 服务在 Task 1.1 就具备“可注册、可启动、可探活”的基础能力
3. 不会提前锁死后续 Task 2-5 的具体实现细节

## Consequences

### 正向影响

1. `koduck-memory` 从仓库层面正式成为独立服务，后续任务不再需要从零初始化。
2. 目录和启动流程与 `koduck-ai` / `koduck-auth` 对齐，降低维护成本。
3. Docker 与 dev k8s overlay 同步接入，后续可直接在集群中继续迭代。
4. 通过 gRPC health + reflection，让后续联调和调试门槛更低。

### 代价与权衡

1. 当前大部分业务模块仍是占位 `mod.rs`，短期内看起来“文件多、逻辑少”。
2. Task 1.1 暂不引入 PostgreSQL、MinIO、异步摘要任务，因此 `/metrics` 只提供最小静态指标。
3. 复制 proto 到服务目录会带来短期重复，但换来独立 Docker 构建与发布能力。

### 兼容性影响

1. 与现有 `koduck-ai` 使用的 `memory.v1` 契约保持一致，不额外引入破坏性差异。
2. 新服务在 dev 中使用独立 Deployment/Service，不影响已有 `koduck-auth`、
   `koduck-user`、`koduck-ai` 的端口和部署。
3. 现阶段仅增加新资源，不修改现有 northbound API 行为。

## Alternatives Considered

### 1. 直接在 `koduck-ai` 内嵌 Memory 骨架

- 拒绝理由：与解耦设计目标冲突，无法形成独立 southbound service。

### 2. Phase 1 不编译 proto，只创建空目录

- 拒绝理由：这样无法验证 `build.rs`、gRPC server 注册链路与 Docker 构建，风险会被推迟到后续阶段。

### 3. 只做代码骨架，不接入 k8s

- 拒绝理由：不满足本任务要求的 dev rollout 验收标准，部署问题会滞后暴露。

## Verification

- `cargo check --manifest-path koduck-memory/Cargo.toml`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl apply -k k8s/overlays/dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 参考实现: `koduck-ai/`, `koduck-auth/`
- Issue: [#788](https://github.com/hailingu/koduck-quant/issues/788)
