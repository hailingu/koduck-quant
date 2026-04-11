# Koduck Memory Service 对接 Koduck AI 实施任务清单

> 本文档基于 `docs/design/koduck-memory-service-for-koduck-ai.md` 拆分，提供 step-by-step 可执行任务。
>
> **状态**: 待执行
> **创建日期**: 2026-04-11
> **对应设计文档**: [koduck-memory-service-for-koduck-ai.md](../design/koduck-memory-service-for-koduck-ai.md)

---

## 执行阶段概览

| 阶段 | 名称 | 预计工作量 | 依赖 | 优先级 |
|------|------|------------|------|--------|
| Phase 1 | 项目骨架与基础设施 | 1-2 天 | - | P0 |
| Phase 2 | gRPC 契约与代码生成 | 1 天 | Phase 1 | P0 |
| Phase 3 | Session 元数据能力 | 1-2 天 | Phase 2 | P0 |
| Phase 4 | Memory 写入与幂等 | 1-2 天 | Phase 3 | P0 |
| Phase 5 | QueryMemory 检索能力 | 2-3 天 | Phase 4 | P0 |
| Phase 6 | Koduck AI 集成与 fail-open | 2 天 | Phase 3, 4, 5 | P0 |
| Phase 7 | 摘要、标签与长期记忆 | 2-3 天 | Phase 4, 5 | P1 |
| Phase 8 | APISIX、观测与灰度演练 | 2-3 天 | Phase 6, 7 | P1 |

---

## Phase 1: 项目骨架与基础设施

### Task 1.1: 建立 `koduck-memory-service` 项目骨架
**详细要求:**
1. 建立服务目录结构：`proto/`, `src/{app,api,capability,session,memory,retrieve,summary,store,index,config,reliability,observe}`
2. 建立启动流程：配置加载、gRPC server、metrics、优雅停机
3. 建立 `build.rs`，用于 proto 编译

**验收标准:**
- [ ] 目录结构与设计文档第 8 节一致
- [ ] 服务可启动并输出版本、环境、监听地址
- [ ] 最小构建校验通过

---

### Task 1.2: 配置与 Secret 管理
**文件:** `src/config/mod.rs`

**详细要求:**
1. 实现配置结构体并支持配置文件 + 环境变量覆盖
2. 覆盖关键配置：
   - `SERVER__GRPC_ADDR`
   - `SERVER__METRICS_ADDR`
   - `POSTGRES__DSN`
   - `OBJECT_STORE__ENDPOINT`
   - `INDEX__MODE`
   - `CAPABILITIES__TTL_SECS`
3. Secret 字段自动脱敏

**验收标准:**
- [ ] 配置文件 + 环境变量覆盖可用
- [ ] Secret 不会在日志中明文输出
- [ ] 配置校验失败时快速失败

---

### Task 1.3: 基础依赖与健康检查
**详细要求:**
1. 接通 PostgreSQL 连接池
2. 提供基础健康检查和 readiness
3. metrics 路径可暴露基础进程指标

**验收标准:**
- [ ] 数据库连接成功可观测
- [ ] readiness 仅在依赖就绪后返回成功
- [ ] metrics 可被 Prometheus 抓取

---

## Phase 2: gRPC 契约与代码生成

### Task 2.1: 冻结 `memory.v1` 契约
**文件:** `koduck-ai/proto/koduck/memory/v1/memory.proto`

**详细要求:**
1. 复核并冻结以下 RPC：
   - `GetCapabilities`
   - `UpsertSessionMeta`
   - `GetSession`
   - `QueryMemory`
   - `AppendMemory`
   - `SummarizeMemory`
2. 确认 `RequestMeta` 字段满足 `koduck-ai` 透传要求
3. 对可扩展字段预留 protobuf tag

**验收标准:**
- [ ] proto 命名、字段编号与语义评审通过
- [ ] `memory.v1` 明确为长期 southbound contract
- [ ] 契约冻结后进入代码生成阶段

---

### Task 2.2: build.rs 与 stub 生成
**文件:** `build.rs`

**详细要求:**
1. 使用 `tonic-build` 生成 server/client stub
2. 统一输出模块暴露方式
3. 让 proto 变更能自动触发重编译

**验收标准:**
- [ ] server/client stub 生成成功
- [ ] proto 变更后编译器能检测
- [ ] gRPC server 能注册空实现

---

### Task 2.3: Capabilities 协议实现
**详细要求:**
1. 实现 `GetCapabilities`
2. 返回 `service/contract_versions/features/limits`
3. 为 `koduck-ai` 启动协商提供固定输出

**验收标准:**
- [ ] `service = memory`
- [ ] `contract_versions` 至少包含 `memory.v1`
- [ ] features / limits 可被 `koduck-ai` 正常解析

---

## Phase 3: Session 元数据能力

### Task 3.1: 实现 Session Repository
**详细要求:**
1. 建立 `memory_sessions` 表与 DAO
2. 支持按 `session_id` / `user_id` 查询
3. 支持 `title/status/last_message_at/extra` 更新

**验收标准:**
- [ ] session 元数据可落库
- [ ] 更新操作幂等
- [ ] 不同用户 session 不串读

---

### Task 3.2: 实现 `GetSession`
**详细要求:**
1. 按 `session_id` 查询会话
2. 不存在时返回标准 `RESOURCE_NOT_FOUND`
3. 返回 `SessionInfo`

**验收标准:**
- [ ] 已存在 session 可查询
- [ ] 不存在 session 返回统一错误语义
- [ ] `request_id` 正确回传

---

### Task 3.3: 实现 `UpsertSessionMeta`
**详细要求:**
1. 支持 create / update 合并语义
2. 更新 `last_message_at`
3. 支持 `extra` 扩展字段

**验收标准:**
- [ ] create / update 都可成功
- [ ] 不产生重复 session
- [ ] 元数据真值以 memory-service 为准

---

## Phase 4: Memory 写入与幂等

### Task 4.1: 建立 `memory_entries` 存储模型
**详细要求:**
1. 建立 `memory_entries` 表
2. 持久化 `role/content/timestamp/metadata/l0_uri`
3. 支持按 `session_id` 和时间范围查询

**验收标准:**
- [ ] user / assistant 记忆可保存
- [ ] 元数据字段可透传保存
- [ ] 基础查询索引有效

---

### Task 4.2: 实现 `AppendMemory`
**详细要求:**
1. 支持批量追加 `entries`
2. 建立 `idempotency_key` 去重表或等价机制
3. 将写路径与后续索引构建解耦

**验收标准:**
- [ ] 重复请求不会重复写入
- [ ] `appended_count` 返回正确
- [ ] 写入失败时错误语义统一

---

### Task 4.3: L0 / L1 材料生成骨架
**详细要求:**
1. 为每次写入生成可追溯 L0 标识
2. 为检索准备 L1 结构化材料
3. 先支持 PostgreSQL 内部落地，后续再扩对象存储

**验收标准:**
- [ ] 每条记忆具备可追溯来源
- [ ] QueryMemory 可直接消费 L1 材料
- [ ] 不阻塞 AppendMemory 主路径

---

## Phase 5: QueryMemory 检索能力

### Task 5.1: 实现 `KEYWORD_FIRST`
**详细要求:**
1. 支持 title / content / tags 关键词匹配
2. 支持 session 范围限制
3. 引入 recent-first 的轻量排序因子

**验收标准:**
- [ ] keyword query 能返回结果
- [ ] `match_reasons` 包含 `keyword_hit/session_scope_hit/tag_hit`
- [ ] `top_k` 和分页可用

---

### Task 5.2: 实现 `SUMMARY_FIRST`
**详细要求:**
1. 若 summary 存在则优先检索 summary
2. 若 summary 不存在则回退原文检索
3. 保持与 `KEYWORD_FIRST` 同一返回结构

**验收标准:**
- [ ] summary 命中路径可工作
- [ ] 无 summary 时能自动回退
- [ ] `match_reasons` 含 `summary_hit`

---

### Task 5.3: 实现 `HYBRID`
**详细要求:**
1. 合并 keyword / summary 候选集
2. 使用统一 score 排序
3. 保留可解释的 `match_reasons`

**验收标准:**
- [ ] hybrid 路径可输出稳定排序
- [ ] 返回结果不重复
- [ ] `QueryMemory` 对 `koduck-ai` 保持统一结构

---

## Phase 6: Koduck AI 集成与 fail-open

### Task 6.1: 接通 `koduck-ai -> memory-service` gRPC client
**详细要求:**
1. 在 `koduck-ai` 中接入 `GetSession / UpsertSessionMeta / QueryMemory / AppendMemory`
2. Southbound 调用统一经 APISIX gRPC route
3. 透传 `RequestMeta`

**验收标准:**
- [ ] `koduck-ai` 不再自己持有会话元数据真值
- [ ] 南向 memory 调用可打通
- [ ] `request_id/session_id/trace_id` 全链路透传

---

### Task 6.2: fail-open 策略落地
**详细要求:**
1. `QueryMemory` 失败时主 chat 流程继续
2. `AppendMemory` 失败时记录结构化错误
3. `GetSession / UpsertSessionMeta` 错误有明确告警与 fallback

**验收标准:**
- [ ] memory 故障不阻塞 `koduck-ai` 主 chat
- [ ] 失败路径可在日志和指标中观测
- [ ] 不会吞掉 southbound 错误上下文

---

### Task 6.3: capability 协商接入
**详细要求:**
1. `koduck-ai` 启动时拉取 `GetCapabilities`
2. 校验 `memory.v1`
3. TTL 刷新 capability

**验收标准:**
- [ ] 版本不兼容时有明确信号
- [ ] capability 可缓存且后台刷新
- [ ] feature/limits 可用于后续策略开关

---

## Phase 7: 摘要、标签与长期记忆

### Task 7.1: 实现 `SummarizeMemory`
**详细要求:**
1. 先实现同步占位版本
2. 输出 `summary`
3. 将结果落到 `memory_summaries`

**验收标准:**
- [ ] 指定 session 可生成 summary
- [ ] summary 可被 `SUMMARY_FIRST` 消费
- [ ] 错误不会阻塞主对话

---

### Task 7.2: 标签与候选 facts
**详细要求:**
1. 生成 topic tags
2. 生成候选长期记忆 facts
3. 设计可演进的数据结构

**验收标准:**
- [ ] summary 结果可附带 tags
- [ ] facts 可独立存储
- [ ] 不破坏现有 QueryMemory 契约

---

### Task 7.3: 异步任务化演进
**详细要求:**
1. 将 summary / facts 提炼改为异步任务
2. 将主写路径和摘要任务解耦
3. 引入重试和补偿机制

**验收标准:**
- [ ] AppendMemory 不等待摘要完成
- [ ] 摘要任务失败可重试
- [ ] 主链路延迟不因摘要任务上升

---

## Phase 8: APISIX、观测与灰度演练

### Task 8.1: APISIX gRPC route 与治理
**详细要求:**
1. 配置 `memory-grpc` upstream / route
2. 增加超时、轻重试、trace 透传和 access log
3. 支持 dev / prod 环境一致治理

**验收标准:**
- [ ] `koduck-ai` 通过 APISIX 成功访问 memory-service
- [ ] route 具备统一治理能力
- [ ] 灰度与回滚配置具备可操作性

---

### Task 8.2: 观测与 SLO 基线
**详细要求:**
1. 为关键 RPC 增加 metrics
2. 增加结构化日志字段
3. 定义基础 SLO 与错误预算

**验收标准:**
- [ ] `GetSession / QueryMemory / AppendMemory` 可观察
- [ ] latency / error rate 可统计
- [ ] southbound 故障可快速定位

---

### Task 8.3: 灰度与回滚演练
**详细要求:**
1. 先在 dev 验证 southbound 链路
2. 在灰度环境验证 fail-open
3. 演练 route 回滚与版本回滚

**验收标准:**
- [ ] 新版本 memory-service 可灰度接入 `koduck-ai`
- [ ] 回滚不需要改 northbound API
- [ ] 故障时 `koduck-ai` 主链路仍可继续
