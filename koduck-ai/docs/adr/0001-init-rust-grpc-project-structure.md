# ADR-0001: 初始化 koduck-ai Rust + gRPC 项目目录结构

- Status: Accepted
- Date: 2026-04-10
- Issue: #717

## Context

根据解耦架构设计文档 `docs/design/koduckai-rust-server/ai-decoupled-architecture.md`，`koduck-ai` 需要从"内聚过多能力的 AI 服务"收敛为"AI Gateway / Orchestrator"。其核心职责包括：

1. **AI 编排网关**：chat / stream 编排、上下文拼装
2. **南向 gRPC 客户端**：调用 memory / tool / llm 能力服务
3. **北向 HTTP API**：对前端提供 chat / stream 接口
4. **流式可靠性**：SSE 传输、断点续流、背压控制
5. **统一错误与降级**：错误码归一、重试预算、降级语义

### 技术选型决策

| 领域 | 技术选择 | 理由 |
|------|----------|------|
| 语言 | Rust 1.88+ | 高性能、内存安全、团队已有 Rust 基础 |
| HTTP 框架 | axum 0.7 | 基于 tokio 和 tower，与 koduck-auth 保持一致 |
| gRPC | tonic 0.11 | Rust 主流 gRPC 实现，南向客户端调用 |
| 异步运行时 | tokio 1.x | Rust 事实标准异步运行时 |
| 日志 | tracing + tracing-subscriber | 结构化日志，支持 JSON 输出 |
| 配置 | config + secrecy | 环境变量注入 + Secret 脱敏 |
| 构建 | Docker 多阶段构建 | 与 koduck-auth 保持一致的 CI/CD 流程 |

## Decision

### 项目目录结构

遵循设计文档第 10 节目录建议，按职责分层：

```
koduck-ai/
├── Cargo.toml              # 项目配置和依赖
├── build.rs                # tonic-build 编译 proto
├── Dockerfile              # 多阶段构建镜像
├── .dockerignore           # Docker 构建排除规则
├── proto/                  # gRPC proto 定义（预留，Phase 2 填充）
│   └── koduck/
│       └── contract/
│           └── v1/
│               └── shared.proto
├── src/
│   ├── main.rs             # 服务入口：配置加载、服务启动、优雅停机
│   ├── lib.rs              # 库入口：模块声明
│   ├── app/                # 启动与生命周期管理
│   │   └── mod.rs
│   ├── api/                # chat/stream handler（北向 API）
│   │   └── mod.rs
│   ├── orchestrator/       # 编排核心
│   │   └── mod.rs
│   ├── llm/                # 提供商适配与路由
│   │   └── mod.rs
│   ├── auth/               # auth 适配（对接 koduck-auth）
│   │   └── mod.rs
│   ├── clients/            # 南向 gRPC 客户端
│   │   ├── mod.rs
│   │   ├── memory/         # memory service client
│   │   │   └── mod.rs
│   │   ├── tool/           # tool service client
│   │   │   └── mod.rs
│   │   └── llm/            # llm adapter client
│   │       └── mod.rs
│   ├── stream/             # SSE/WS transport 与队列
│   │   └── mod.rs
│   ├── reliability/        # retry/circuit/degrade
│   │   └── mod.rs
│   ├── observe/            # logging/trace/metrics
│   │   └── mod.rs
│   └── config/             # 配置与 secret 解析
│       └── mod.rs
└── docs/
    └── adr/                # 架构决策记录
```

### 端口规划

| 端口 | 用途 | 协议 |
|------|------|------|
| 8083 | 北向 HTTP API (chat/stream/healthz) | HTTP/1.1, HTTP/2 |
| 50051 | gRPC Server（预留，供内部服务调用） | HTTP/2 |
| 9090 | Metrics (Prometheus) | HTTP/1.1 |

### 启动流程

```
加载配置 → 初始化日志 → 启动 HTTP Server → 启动 Metrics Server → 等待信号 → 优雅停机
```

启动日志输出：版本号、运行环境（dev/staging/prod）、监听端口列表。

## Consequences

### 正向影响

1. **架构清晰**：按设计文档职责分层，与 koduck-auth 保持一致的工程规范
2. **可扩展性**：目录结构预留了 Phase 2-8 所需的所有模块位置
3. **容器化构建**：Docker 多阶段构建，与现有 CI/CD 流程兼容
4. **快速启动**：最小骨架可独立编译和运行，为后续开发提供基础

### 代价与风险

1. **空模块开销**：首期创建大量空 mod.rs 文件，但这是必要的结构预留
2. **构建时间**：Rust 编译时间较长，通过 Docker 层缓存和增量编译缓解
3. **proto 暂为占位**：build.rs 和 proto 目录在 Phase 2 才填充完整契约

### 兼容性影响

- **API 兼容性**：北向 API 路径（`/api/v1/ai/chat`、`/api/v1/ai/chat/stream`、`/healthz`）与现有前端保持一致
- **端口规划**：HTTP 8083 不与 koduck-auth(8081) / koduck-user(8082) 冲突
- **技术栈一致**：与 koduck-auth 使用相同的 Rust 版本和核心依赖，降低维护成本

## Alternatives Considered

### 1. 使用 Go 实现

- **拒绝理由**：团队已有 Rust 基础（koduck-auth），且 Rust 在内存安全和零成本抽象方面更优

### 2. 本地 cargo 构建

- **拒绝理由**：团队约定使用容器构建，确保环境一致性

### 3. 嵌套在 koduck-backend 内

- **拒绝理由**：设计文档明确 koduck-ai 为独立服务，与其他微服务平级

## Verification

- `docker build -t koduck-ai:dev ./koduck-ai` 构建成功
- 启动后日志输出版本、环境、监听端口
- 优雅停机（Ctrl+C）正常工作
- 目录结构与设计文档第 10 节一致

## References

- 设计文档: [ai-decoupled-architecture.md](../../../docs/design/koduckai-rust-server/ai-decoupled-architecture.md)
- API 定义: [koduck-ai-api.yaml](../../../docs/design/koduckai-rust-server/koduck-ai-api.yaml)
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../../../docs/implementation/koduck-ai-rust-grpc-tasks.md)
- 参考: koduck-auth 项目结构
- Issue: [#717](https://github.com/hailingu/koduck-quant/issues/717)
