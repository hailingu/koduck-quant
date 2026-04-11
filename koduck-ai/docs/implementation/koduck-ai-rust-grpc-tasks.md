# Koduck AI Rust + gRPC 实施任务清单

> 本文档基于 `koduck-ai/docs/design/ai-decoupled-architecture.md` 拆分，提供 step-by-step 可执行任务。
>
> **状态**: 待执行
> **创建日期**: 2026-04-10
> **对应设计文档**: [ai-decoupled-architecture.md](../design/ai-decoupled-architecture.md)

---

## 执行阶段概览

| 阶段 | 名称 | 预计工作量 | 依赖 | 优先级 |
|------|------|------------|------|--------|
| Phase 1 | 项目骨架与基础设施 | 1-2 天 | - | P0 |
| Phase 2 | gRPC 契约与代码生成 | 1-2 天 | Phase 1 | P0 |
| Phase 3 | 核心编排与客户端接入 | 3-4 天 | Phase 2 | P0 |
| Phase 4 | SSE 可靠性与取消语义 | 2-3 天 | Phase 3 | P0 |
| Phase 5 | 错误码/降级/重试预算 | 2 天 | Phase 3 | P0 |
| Phase 6 | APISIX gRPC 治理接入 | 1-2 天 | Phase 3, 5 | P1 |
| Phase 7 | 观测、SLO 与压测基线 | 2-3 天 | Phase 4, 5, 6 | P1 |
| Phase 8 | 迁移、灰度与回滚演练 | 2-3 天 | Phase 7 | P1 |

---

## Phase 1: 项目骨架与基础设施

### Task 1.1: 建立 `koduck-ai` Rust 项目骨架
**执行命令:**
```bash
cargo new --bin koduck-ai
cd koduck-ai
```

**详细要求:**
1. 建立目录结构：`proto/`, `src/{app,api,orchestrator,llm,auth,clients,stream,reliability,observe,config}`
2. 添加 `build.rs`，用于 proto 编译
3. 建立 `src/main.rs` 启动流程：配置加载、服务启动、优雅停机

**验收标准:**
- [x] 目录结构与设计文档第 10 节一致
- [x] `cargo check` 成功（通过 `docker build` 验证）
- [x] 启动日志输出版本、环境、监听端口

---

### Task 1.2: 配置与 Secret 管理
**文件:** `src/config/mod.rs`

**详细要求:**
1. 实现配置结构体并支持环境变量注入
2. 覆盖关键配置：
   - `KODUCK_AI__MEMORY__GRPC_TARGET`
   - `KODUCK_AI__TOOLS__GRPC_TARGET`
   - `KODUCK_AI__LLM__ADAPTER_GRPC_TARGET`
   - `KODUCK_AI__LLM__DEFAULT_PROVIDER`
   - `KODUCK_AI__LLM__TIMEOUT_MS`
   - `KODUCK_AI__STREAM__MAX_DURATION_MS`
3. 敏感信息使用 Secret 类型封装，禁止明文日志输出

**验收标准:**
- [x] 支持配置文件 + 环境变量覆盖
- [x] Secret 字段在日志中自动脱敏
- [x] 配置校验失败时启动快速失败

---

### Task 1.3: 统一错误框架骨架
**文件:** `src/reliability/error.rs`

**详细要求:**
1. 建立设计文档附录 A 的错误码枚举
2. 建立统一错误对象：`code/message/request_id/retryable/degraded/upstream/retry_after_ms`
3. 完成 gRPC status 与 HTTP 状态码映射工具函数（供北向 API 层使用）

**验收标准:**
- [x] 所有 V1 错误码可构造并序列化
- [x] gRPC/HTTP 映射单元测试通过
- [x] 下游原始错误不透传

---

## Phase 2: gRPC 契约与代码生成

### Task 2.1: 冻结 proto 契约 v1
**文件:**
- `proto/shared.proto`
- `proto/memory/v1/memory.proto`
- `proto/tool/v1/tool.proto`
- `proto/llm/v1/llm.proto`（迁移期可选）

**详细要求:**
1. 按设计文档第 6.4/6.5 与附录 B 完成 rpc/message 定义
2. 统一请求元信息：`request_id/session_id/user_id/tenant_id/trace_id/idempotency_key/deadline_ms/api_version`
3. 为可选字段和后续兼容预留 tag
4. 明确 `memory/tool` 为长期契约，`llm.proto` 仅用于迁移期独立 Adapter / Bridge

**验收标准:**

- [x] proto 能通过 lint（若接入 buf 则通过 `buf lint`）（通过 `docker build` 验证编译通过）
- [x] 字段编号与命名规范通过 review
- [x] v1 契约评审通过并冻结（ADR-0004）

---

### Task 2.2: build.rs 与代码生成
**文件:** `build.rs`

**详细要求:**
1. 使用 `tonic-build` 生成 server/client stub
2. 输出模块统一挂在 `src/clients/proto` 或 `OUT_DIR` 后由 `mod.rs` 暴露
3. 打通 CI 中 proto 变更自动触发编译

**验收标准:**
- [x] `cargo build` 能生成全部 stub（通过 `docker build` 验证）
- [x] memory/tool 的 client trait 可直接注入 orchestrator；`llm` stub 仅在兼容模式下启用
- [x] proto 变更可被编译器检测（`cargo:rerun-if-changed` 已配置）

---

### Task 2.3: Capabilities 协商协议实现
**详细要求:**
1. 为 memory/tool client 实现 `GetCapabilities` 拉取与 TTL 缓存
2. 若启用独立 LLM Adapter，再为 llm client 启用对应协商
3. 启动阶段做版本兼容校验
4. 不兼容时 fail-fast 并输出结构化告警

**验收标准:**
- [x] 能打印已协商的 `contract_versions`
- [x] 版本不兼容时服务拒绝启动
- [x] capability 刷新不会阻塞主请求线程

---

## Phase 3: 核心编排与客户端接入

### Task 3.1: Chat/Stream 编排主链路
**文件:** `src/orchestrator/chat_orchestrator.rs`

**详细要求:**
1. 建立统一编排流程：鉴权 -> 上下文装配 -> memory 查询 -> LLM 调用 -> 输出
2. Tool-loop 通过 tool gRPC client 调用，不内嵌工具实现
3. 每次请求都携带 `RequestMeta`

**验收标准:**
- [ ] 非流式与流式均可完成最小对话闭环
- [ ] 下游调用全部通过 gRPC client
- [ ] 请求链路字段完整透传

---

### Task 3.2: Memory first-class 集成
**详细要求:**
1. 接入 `QueryMemory/AppendMemory/UpsertSessionMeta`
2. 读取策略支持：`keyword_first/summary_first/hybrid`
3. 会话元数据真值仅来自 memory-service

**验收标准:**
- [ ] session 查询与写入走 memory contract
- [ ] ai-server 不再落地会话元数据真值
- [ ] 不同检索策略可配置切换

---

### Task 3.3: LLM Provider 集成
**详细要求:**
1. 在 `koduck-ai` 内实现 provider-native `Generate/StreamGenerate/CountTokens/ListModels`
2. 支持多 provider 配置路由
3. 将供应商错误归一到统一错误码
4. 若迁移期保留独立 LLM Adapter，则通过兼容开关选择 `direct` 或 `adapter` 模式

**验收标准:**
- [ ] 流式 token 正常输出并带 sequence
- [ ] 429 能携带 `retry_after_ms`
- [ ] provider 切换不影响上层编排代码

### Task 3.3.1: 定义 Rust LLM Provider 抽象
**文件:** `src/llm/provider.rs`, `src/llm/types.rs`

**详细要求:**
1. 定义统一 `LlmProvider` trait：`generate/stream_generate/list_models/count_tokens`
2. 定义统一请求/响应/usage/stream event 类型
3. 约束上层 orchestrator 仅依赖 trait，不感知厂商 HTTP/JSON 差异

**验收标准:**
- [x] trait 与类型定义能覆盖 chat/stream 主链路
- [x] 不暴露 provider-specific JSON 结构到 orchestrator
- [x] 支持 `direct` 与 `adapter` 共用同一套上层抽象

### Task 3.3.2: 构建通用 HTTP 基础设施
**文件:** `src/llm/http.rs`, `src/llm/errors.rs`

**详细要求:**
1. 使用 `reqwest` 构建统一 HTTP client，不依赖 OpenAI SDK
2. 实现公共 header、deadline timeout、body 序列化、stream chunk 解析
3. 实现厂商 HTTP 状态码与错误 body 到统一错误语义的映射辅助

**验收标准:**
- [ ] 统一 client 支持连接复用与 rustls
- [ ] 429/5xx/timeout/EOF 等异常路径可被标准化处理
- [ ] stream 解析工具可被三个 provider 复用

### Task 3.3.3: 实现首批三个 Provider Adapter
**文件:** `src/llm/minimax.rs`, `src/llm/openai.rs`, `src/llm/deepseek.rs`

**详细要求:**
1. 实现 `minimax` provider-native HTTP 适配
2. 实现 `openai` provider-native HTTP 适配
3. 实现 `deepseek` provider-native HTTP 适配
4. 在各自 adapter 内收敛 provider-specific 字段和行为差异

**验收标准:**
- [ ] 三个 provider 均可完成非流式生成
- [ ] 三个 provider 均可完成流式增量输出
- [ ] 厂商差异不泄漏到公共 trait 和 orchestrator

### Task 3.3.4: 实现 Router 与模式切换
**文件:** `src/llm/router.rs`, `src/config/mod.rs`

**详细要求:**
1. 引入 `llm.mode = direct | adapter` 配置
2. 实现按 provider/model/default_provider 选择 adapter 的路由逻辑
3. `direct` 作为默认模式，`adapter` 仅作迁移兼容与回滚开关
4. 增加按 provider 独立配置：`api_key/base_url/default_model`

**验收标准:**
- [ ] `direct` 模式默认可用
- [ ] `adapter` 模式可回退到现有 `llm.proto` 链路
- [ ] provider fallback 不会静默发生

### Task 3.3.5: 接入主链路并完成能力探活
**文件:** `src/api/mod.rs`, `src/llm/router.rs`, `src/clients/capability.rs`

**详细要求:**
1. 将 chat/stream 主链路改为调用 Rust provider adapter
2. `memory/tool` 保持 `GetCapabilities` 协商；`llm` 在 `direct` 模式下改为本地静态 capability + 启动探活
3. `llm.proto` capability 协商仅在 `adapter` 模式启用

**验收标准:**
- [ ] chat/stream 不再默认依赖 `LlmServiceClient`
- [ ] `direct` 模式下启动期可校验 provider 配置与可用性
- [ ] `adapter` 模式下现有兼容链路仍可工作

---

## Phase 4: SSE 可靠性与取消语义

### Task 4.1: SSE 事件模型与断点续流
**文件:** `src/stream/sse.rs`

**详细要求:**
1. 统一事件字段：`event_id/sequence_num/event_type/payload/request_id/session_id`
2. 支持 `Last-Event-ID` + `from_sequence_num` 断点续流
3. 客户端侧去重依据高水位策略

**验收标准:**
- [x] 人工断连重连后可继续流式响应
- [x] 不出现重复序号消费
- [x] 序号单调递增

---

### Task 4.2: 串行队列、背压与优雅停机
**文件:** `src/stream/queue.rs`, `src/app/lifecycle.rs`

**详细要求:**
1. 建立单请求串行发送队列
2. 处理背压、超时、队列排空
3. 优雅停机流程：拒新流量 -> 排空 -> cleanup -> failsafe

**验收标准:**
- [x] 背压场景下无内存失控增长
- [x] 停机时无半包/乱序事件
- [x] 超时后能强制退出并记录事件

---

### Task 4.3: cancel/interrupt 与 generation 防护
**文件:** `src/orchestrator/cancel.rs`

**详细要求:**
1. 引入 `request_id` + generation 保护
2. 旧请求完成事件不得覆盖新请求状态
3. 统一 `AbortSignal + timeout + cleanup` 封装

**验收标准:**
- [x] 并发中断场景无状态污染
- [x] 清理逻辑无资源泄漏
- [x] 关键路径有并发单测

---

## Phase 5: 错误码/降级/重试预算

### Task 5.1: 错误归一落地
**文件:** `src/reliability/error_mapper.rs`

**详细要求:**
1. 落地附录 A 全量错误码映射
2. 对 memory/tool 以及 provider-native LLM 错误分别映射下游错误
3. 返回统一错误对象，不泄漏下游内部细节

**验收标准:**
- [x] 各类下游失败均落到标准错误码
- [x] 错误码映射回归测试通过
- [x] 线上日志可按 `code` 聚合

---

### Task 5.2: 降级开关与策略
**文件:** `src/reliability/degrade.rs`

**详细要求:**
1. 实现降级总开关与按路由开关
2. 触发条件：上游超时、预算耗尽、熔断打开
3. 降级响应强制 `degraded=true`

**验收标准:**
- [x] 降级策略可灰度配置
- [x] 降级与完整成功语义可区分
- [x] 降级命中率可观测

---

### Task 5.3: 重试预算与超时预算
**文件:** `src/reliability/retry_budget.rs`

**详细要求:**
1. 定义最大重试次数、总预算、白名单错误
2. 对 429 优先遵循 `retry_after_ms`
3. 与 APISIX 网关重试解耦，避免叠加风暴

**验收标准:**
- [x] 可重试/不可重试路径行为正确
- [x] 预算耗尽后快速失败
- [x] 退避策略有单测覆盖

---

## Phase 6: APISIX gRPC 治理接入

### Task 6.1: gRPC 路由与上游配置
**交付物:** APISIX route/upstream 配置（IaC）

**详细要求:**
1. 建立 ai->memory/tool 的 gRPC upstream
2. 若启用兼容模式，再建立 ai->llm 的可选 gRPC upstream
3. 按附录 C 配置 connect/send/read timeout
4. 配置 keepalive、轻重试、熔断阈值

**验收标准:**
- [x] memory/tool 的 gRPC 请求全部经过 APISIX
- [x] `llm` 的 gRPC 路由仅在兼容模式下保留
- [x] 超时与重试符合基线值
- [x] 路由变更可回滚

---

### Task 6.2: 网关插件基线
**详细要求:**
1. 接入 `limit-req/limit-count`, `prometheus`, `opentelemetry`, `access-log`
2. 统一日志字段：`request_id/session_id/user_id/trace_id`
3. `grpc-transcode` 仅迁移窗口可选开启

**验收标准:**
- [x] 网关侧限流生效
- [x] 指标与 trace 可串起全链路
- [x] 迁移完成后可关闭 transcode

---

## Phase 7: 观测、SLO 与压测基线

### Task 7.1: 指标埋点与仪表盘
**文件:** `src/observe/metrics.rs`

**详细要求:**
1. 输出关键指标：
   - `latency_p95_ms`
   - `first_token_p95_ms`
   - `stream_interrupt_rate`
   - `shed_count`
   - `timeout_count`
   - `slo_violation_count`
2. 建立 Grafana dashboard 与阈值告警

**验收标准:**
- [ ] 指标可按 tenant/route/provider 维度查看
- [ ] P1/P2 告警规则可触发
- [ ] 告警链路可达值班系统

---

### Task 7.2: 容量压测与基线确认
**执行建议:** k6/ghz + 真实模型流量回放

**详细要求:**
1. 验证目标：
   - chat P95 <= 8s
   - stream 首 token P95 <= 3s
   - 流中断率 <= 1%
2. 验证并发 SSE 上限与单请求 token 上限保护

**验收标准:**
- [ ] 形成压测报告与瓶颈分析
- [ ] 与设计文档 SLO 目标一致
- [ ] 明确扩容阈值与容量手册

---

## Phase 8: 迁移、灰度与回滚演练

### Task 8.1: 灰度发布计划
**详细要求:**
1. 按租户或流量比例灰度（5% -> 20% -> 50% -> 100%）
2. 每阶段观测 30-60 分钟
3. 保留旧路径兜底开关

**验收标准:**
- [ ] 每阶段有准入/退出标准
- [ ] 灰度期间核心指标无恶化
- [ ] 100% 切换后稳定运行

---

### Task 8.2: 自动回滚与复盘机制
**详细要求:**
1. 按附录 C 回滚条件接入自动回滚
2. 保留变更窗口内 trace/request 采样
3. 建立标准复盘模板

**验收标准:**
- [ ] 可在演练中自动回滚成功
- [ ] 复盘信息可复现问题路径
- [ ] 回滚后错误率快速恢复

---

## 关键里程碑（建议）

- M1（Phase 1-2 完成）：契约冻结，可生成可用 stub
- M2（Phase 3-5 完成）：主链路可跑通，错误与降级闭环
- M3（Phase 6-7 完成）：网关治理与 SLO 观测闭环
- M4（Phase 8 完成）：生产灰度与回滚机制验证完成

---

## 任务执行规范

1. 每个 Task 必须对应 PR，PR 标题遵循 Conventional Commits。
2. 任何 proto 破坏性变更必须走 ADR + 版本升级评审。
3. 每个 Phase 完成后更新本文件任务状态（`[ ]` -> `[x]`）并附链接。
4. 所有跨服务联调必须保留调用链路样例（request_id/trace_id）。
