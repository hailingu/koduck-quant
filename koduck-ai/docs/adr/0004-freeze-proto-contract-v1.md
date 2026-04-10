# ADR-0004: 冻结 Proto 契约 v1

- Status: Accepted
- Date: 2026-04-10
- Issue: #723

## Context

`koduck-ai` 作为 AI Gateway/Orchestrator，需要通过 gRPC 与三个下游服务通信：`koduck-memory-service`、`koduck-tool-service`、LLM Adapter。在进入代码生成和客户端集成之前，必须先冻结 v1 版本的 proto 契约。

### 问题

1. **多服务契约统一**：memory/tool/llm 三个服务共享统一的请求元信息（RequestMeta），需要定义一致的协议骨架
2. **跨语言兼容**：proto 契约可能被 Go/Java 等多语言服务消费，需要规范的 package 命名和 go_package 选项
3. **向后兼容保障**：v1 契约冻结后，字段编号和命名不得随意变更，需要建立兼容性规则
4. **可扩展性**：为后续 v2 契约预留演进空间，字段编号需要合理规划

### 现有参考

- 设计文档 §6.4 定义了可插拔交互协议（memory/tool）
- 设计文档 §6.5 定义了 LLM Contract（provider-agnostic）
- 设计文档 §15 附录 B 提供了完整的 Proto 契约草案
- `koduck-auth/proto/koduck/auth/v1/auth.proto` 提供了项目内的 proto 编写参考
- `koduck-ai/proto/koduck/contract/v1/shared.proto` 已定义 RequestMeta/ErrorDetail/Capability

## Decision

### 1. Proto 文件组织

```
proto/koduck/
  contract/v1/shared.proto      # 公共消息（已存在）
  memory/v1/memory.proto        # Memory 服务契约（新增）
  tool/v1/tool.proto            # Tool 服务契约（新增）
  llm/v1/llm.proto              # LLM 适配服务契约（新增）
```

每个服务使用独立的 package（`koduck.memory.v1`、`koduck.tool.v1`、`koduck.llm.v1`），通过 import 引用 shared.proto 中的公共消息。

### 2. Memory 服务契约

定义 `MemoryService`，包含以下 RPC：
- `GetCapabilities` — 能力发现与版本协商
- `UpsertSessionMeta` — 创建/更新会话元数据
- `GetSession` — 获取会话信息
- `QueryMemory` — 记忆检索（支持 keyword_first/summary_first/hybrid 策略）
- `AppendMemory` — 追加记忆
- `SummarizeMemory` — 记忆摘要（可异步）

### 3. Tool 服务契约

定义 `ToolService`，包含以下 RPC：
- `GetCapabilities` — 能力发现与版本协商
- `ListTools` — 列出可用工具及其 schema
- `ValidateToolInput` — 校验工具输入（可选）
- `ExecuteTool` — 同步执行工具
- `ExecuteToolStream` — 流式执行工具（可选）

### 4. LLM 适配服务契约

定义 `LlmService`，包含以下 RPC：
- `GetCapabilities` — 能力发现与版本协商
- `ListModels` — 列出可用模型（可选）
- `CountTokens` — Token 计数
- `Generate` — 非流式生成
- `StreamGenerate` — 流式生成（返回 stream StreamGenerateEvent）

### 5. 兼容性规则

- 字段新增只能追加新 tag，不得复用或重排已有 tag
- 删除字段采用 `reserved` 保留 tag 与名称
- 非破坏升级允许新增 optional/repeated 字段；破坏升级必须提升大版本（v2）
- 每个 RPC 请求必须包含 `RequestMeta meta` 字段用于统一请求追踪

### 6. 编码规范

- `go_package` 选项格式：`github.com/hailingu/koduck-quant/proto/koduck/{service}/v1;{service}v1`
- 字段命名使用 snake_case
- 枚举值使用 UPPER_SNAKE_CASE，首值以 `_UNSPECIFIED` 结尾
- 每个 message 和 field 添加注释说明用途

## Consequences

### 正向影响

1. **契约先行**：先稳定接口契约，再拆分实现，符合设计原则
2. **多语言兼容**：规范的 package 和 go_package 选项确保跨语言生成代码的一致性
3. **可观测性**：统一的 RequestMeta 确保全链路 request_id/trace_id 透传
4. **可扩展性**：合理的字段编号规划为 v2 演进预留空间

### 代价与风险

1. **冻结约束**：v1 契约冻结后，破坏性变更需要走 ADR 评审并升级版本号
2. **跨服务协调**：memory/tool/llm 三个服务的 proto 变更需要同步协调
3. **import 路径**：shared.proto 的 import 路径在编译时需要正确配置 include 目录

### 兼容性影响

- **API 兼容性**：v1 契约一旦冻结，后续变更必须遵守兼容性规则
- **构建系统**：build.rs 需要更新以编译所有 proto 文件
- **下游服务**：koduck-memory-service、koduck-tool-service、LLM Adapter 需要基于此契约实现对应接口

## Alternatives Considered

### 1. 所有服务合并到单个 proto 文件

- **优点**：管理简单，单个文件包含所有定义
- **缺点**：违反单一职责原则，任何服务变更都需要重新编译全部 stub
- **结论**：按服务拆分 proto 文件，保持独立演进能力

### 2. 不使用 shared.proto，每个服务独立定义元信息

- **优点**：服务完全解耦
- **缺点**：元信息定义重复，不一致风险高，跨服务请求追踪困难
- **结论**：使用 shared.proto 作为公共依赖，确保元信息一致性

### 3. 使用 buf 构建 proto 而非 tonic-build

- **优点**：buf 提供 lint、format、breaking change detection 等工具链
- **缺点**：引入额外工具依赖，当前阶段 tonic-build 已满足需求
- **结论**：首期使用 tonic-build，后续可引入 buf 作为 proto 管理工具链

## Verification

- proto 文件语法正确，`docker build` 编译通过
- 字段编号连续且无冲突
- RequestMeta 在所有 RPC 请求中正确引用
- import 路径在 build.rs 中正确配置

## References

- 设计文档: [ai-decoupled-architecture.md](../../../docs/design/koduckai-rust-server/ai-decoupled-architecture.md) §6.4, §6.5, §15
- 任务清单: [koduck-ai-rust-grpc-tasks.md](../../../docs/implementation/koduck-ai-rust-grpc-tasks.md) Task 2.1
- 前置 ADR: [ADR-0001](0001-init-rust-grpc-project-structure.md), [ADR-0002](0002-config-and-secret-management.md), [ADR-0003](0003-unified-error-framework.md)
- 参考: `koduck-auth/proto/koduck/auth/v1/auth.proto`
- Issue: [#723](https://github.com/hailingu/koduck-quant/issues/723)
