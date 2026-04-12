# Koduck Memory 对接 Koduck AI 实施任务清单

> 对应设计文档：
> [`/Users/guhailin/Git/koduck-quant/docs/design/koduck-memory-for-koduck-ai.md`](/Users/guhailin/Git/koduck-quant/docs/design/koduck-memory-for-koduck-ai.md)
>
> 状态：待执行  
> 创建日期：2026-04-11

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
|------|------|------|--------|
| Phase 1 | 基础设施与项目骨架 | - | P0 |
| Phase 2 | 契约与数据基线 | Phase 1 | P0 |
| Phase 3 | Session 真值能力 | Phase 2 | P0 |
| Phase 4 | L0 写入与 append 语义 | Phase 3 | P0 |
| Phase 5 | L1 索引与默认检索路径 | Phase 4 | P0 |
| Phase 6 | Koduck AI 集成与治理 | Phase 3, 4, 5 | P0 |
| Phase 7 | 异步摘要与长期事实 | Phase 4, 5 | P1 |
| Phase 8 | 部署、观测与灰度 | Phase 6, 7 | P1 |

---

## Phase 1: 基础设施与项目骨架

### Task 1.1: 建立 `koduck-memory` 服务骨架
**详细要求:**
1. 建立目录：`proto/`, `src/{app,api,capability,session,memory,retrieve,summary,store,index,config,reliability,observe}`
2. 建立启动流程：配置加载、gRPC server、metrics、优雅停机
3. 建立 `build.rs`

**验收标准:**
- [x] 服务可启动并输出版本、环境、监听地址
- [x] 最小构建校验通过
- [x] 目录结构与设计文档一致

### Task 1.2: 配置与 Secret 管理
**详细要求:**
1. 支持配置文件 + 环境变量覆盖
2. 覆盖关键配置：
   - `SERVER__GRPC_ADDR`
   - `SERVER__METRICS_ADDR`
   - `POSTGRES__DSN`
   - `OBJECT_STORE__ENDPOINT`
   - `OBJECT_STORE__BUCKET`
   - `OBJECT_STORE__ACCESS_KEY`
   - `OBJECT_STORE__SECRET_KEY`
   - `OBJECT_STORE__REGION`
   - `CAPABILITIES__TTL_SECS`
   - `SUMMARY__ASYNC_ENABLED`
3. Secret 自动脱敏

**验收标准:**
- [x] 配置覆盖可用
- [x] Secret 不在日志明文输出
- [x] 配置校验失败时快速失败

### Task 1.3: PostgreSQL 与健康检查
**详细要求:**
1. 接通 PostgreSQL 连接池
2. 提供 readiness / liveness
3. 暴露基础 metrics

**验收标准:**
- [x] 数据库连接成功可观测
- [x] readiness 仅在依赖就绪后成功
- [x] metrics 可被 Prometheus 抓取

### Task 1.4: MinIO 对象存储基础设施
**详细要求:**
1. 在 dev 环境增加 MinIO pod / service / pvc
2. 准备 bucket 初始化流程
3. 为服务配置对象存储 secret 与 endpoint

**验收标准:**
- [x] dev 环境存在可用 MinIO
- [x] `koduck-memory` 可访问 bucket
- [x] L0 对象存储前置基础就绪

---

## Phase 2: 契约与数据基线

### Task 2.1: 冻结 `memory.v1` 契约
**详细要求:**
1. 复核并冻结：
   - `GetCapabilities`
   - `UpsertSessionMeta`
   - `GetSession`
   - `QueryMemory`
   - `AppendMemory`
   - `SummarizeMemory`
2. 明确 `RequestMeta` 必填字段
3. 预留可扩展 protobuf tag

**验收标准:**
- [x] `memory.v1` 明确为长期 southbound contract
- [x] proto 编号与语义评审通过

### Task 2.2: 生成 server/client stub
**详细要求:**
1. 使用 `tonic-build` 生成 stub
2. 统一模块暴露
3. proto 变更可触发重编译

**验收标准:**
- [x] server/client stub 生成成功
- [x] 空 server 可注册启动

### Task 2.3: 数据库 migration 基线
**详细要求:**
1. 建立：
   - `memory_sessions`
   - `memory_entries`
   - `memory_index_records`
   - `memory_summaries`
   - `memory_facts`
   - `memory_idempotency_keys`
2. 建立主键、唯一约束与高频索引
3. 不引入数据库外键
4. 通过应用层维护逻辑关联

**验收标准:**
- [x] 初始 migration 可执行
- [x] 表结构与设计文档一致
- [x] 主键、唯一约束、索引齐全

### Task 2.4: Capabilities 协议实现
**详细要求:**
1. 实现 `GetCapabilities`
2. 返回 `service/contract_versions/features/limits`

**验收标准:**
- [x] `service = memory`
- [x] `contract_versions` 至少包含 `memory.v1`
- [x] features / limits 可被 `koduck-ai` 正常解析

---

## Phase 3: Session 真值能力

### Task 3.1: 实现 Session Repository
**详细要求:**
1. 实现 `memory_sessions` DAO
2. 支持按 `tenant_id + session_id` 查询
3. 支持 `parent_session_id / forked_from_session_id`
4. 支持 `title/status/last_message_at/extra` 更新

**验收标准:**
- [x] session 元数据可落库
- [x] 更新操作幂等
- [x] session lineage 可被正确记录

### Task 3.2: 实现 `GetSession`
**详细要求:**
1. 按 `tenant_id + session_id` 查询会话
2. 不存在时返回 `RESOURCE_NOT_FOUND`

**验收标准:**
- [x] 已存在 session 可查询
- [x] 不存在返回统一错误语义

### Task 3.3: 实现 `UpsertSessionMeta`
**详细要求:**
1. 支持 create / update 合并语义
2. 正确更新 `last_message_at`
3. 支持 `extra` 扩展字段

**验收标准:**
- [x] create / update 都可成功
- [x] 不产生重复 session
- [x] 会话真值以 `koduck-memory` 为准

---

## Phase 4: L0 写入与 append 语义

### Task 4.1: 建立 `memory_entries` 存储模型
**详细要求:**
1. 持久化 `tenant_id/session_id/sequence_num/role/raw_content_ref/l0_uri`
2. 支持按 `tenant_id + session_id` 和时间范围查询
3. 为同一 `session_id` 预留顺序写入约束

**验收标准:**
- [x] user / assistant 记忆可保存
- [x] 同一 session 的写入顺序可校验
- [x] 索引有效

### Task 4.2: 实现 `AppendMemory`
**详细要求:**
1. 支持批量追加 `entries`
2. 建立 `idempotency_key` 去重机制
3. 引入 `session_id + sequence_num` 或等价顺序控制
4. 将主写路径与索引/摘要解耦

**验收标准:**
- [x] 重复请求不会重复写入
- [x] `appended_count` 返回正确
- [x] 并发写入不破坏顺序语义

### Task 4.3: L0 原始材料写入对象存储
**详细要求:**
1. 将原始材料写入 S3/MinIO
2. L0 采用 JSONL event log 或等价事件对象组织
3. 支持回放、审计与离线排障

**验收标准:**
- [x] 每条记忆具备可追溯 L0 来源
- [x] 不触发单对象重写竞争
- [x] 对象 key 符合租户前缀组织

**实现 PR:** #816

---

## Phase 5: L1 索引与默认检索路径

### Task 5.1: 建立 `memory_index_records`
**详细要求:**
1. 生成包含 `memory_kind/domain_class/summary/snippet/source_uri` 的 L1 材料
2. 建立高频查询索引

**验收标准:**
- [x] QueryMemory 可直接消费 L1
- [x] L1 与 L0 可关联追溯

**实现 PR:** #818

### Task 5.2: 实现 `DOMAIN_FIRST`
**详细要求:**
1. 定义粗粒度 `domain_class`
2. 先按 `domain_class` 过滤候选集
3. 支持 session 范围限制

**验收标准:**
- [x] domain-first 路径可工作
- [x] `match_reasons` 包含 `domain_class_hit/session_scope_hit`

**实现 PR:** #820

### Task 5.3: 实现 `SUMMARY_FIRST`
**详细要求:**
1. 在 `domain_class` 候选集内使用 summary 排除不合适候选
2. 无 summary 时回退结构化原文索引
3. summary 不作为最终选中条件

**验收标准:**
- [x] summary 排除路径可工作
- [x] `match_reasons` 包含 `summary_hit`

**实现 PR:** #822

### Task 5.4: 保留 `HYBRID` 为后续扩展
**详细要求:**
1. 文档、配置、代码中不把 `HYBRID` 作为默认策略
2. V1 主链路不依赖 `HYBRID`

**验收标准:**
- [x] `HYBRID` 不影响 V1 主链路
- [x] 后续扩展不破坏统一契约

**实现 PR:** #824

---

## Phase 6: Koduck AI 集成与治理

### Task 6.1: 接通 `koduck-ai -> koduck-memory`
**详细要求:**
1. 接入 `GetSession / UpsertSessionMeta / QueryMemory / AppendMemory`
2. southbound 统一经 APISIX gRPC route
3. 透传 `RequestMeta`
4. 透传 `session_id` 与 lineage 字段

**验收标准:**
- [x] `koduck-ai` 不再自己持有会话真值
- [x] `request_id/session_id/trace_id/tenant_id` 全链路透传

### Task 6.2: fail-open 策略落地
**详细要求:**
1. `QueryMemory` 失败时主 chat 继续
2. `AppendMemory` 失败时记录结构化错误
3. `GetSession / UpsertSessionMeta` 错误有告警与 fallback

**验收标准:**
- [x] memory 故障不阻塞主 chat
- [x] 失败路径可在日志和指标中观测

### Task 6.3: capability 协商接入
**详细要求:**
1. 启动时拉取 `GetCapabilities`
2. 校验 `memory.v1`
3. TTL 后台刷新 capability

**验收标准:**
- [x] 版本不兼容时有明确信号
- [x] capability 可缓存与刷新

---

## Phase 7: 异步摘要与长期事实

### Task 7.1: 实现 `SummarizeMemory` 异步任务
**详细要求:**
1. `SummarizeMemory` 只负责任务投递
2. 结果落到 `memory_summaries`
3. 输出 `summary` 与 `domain_class`

**验收标准:**
- [ ] summary 可生成并持久化
- [ ] `domain_class` 可被 `DOMAIN_FIRST` 消费

### Task 7.2: 实现 facts 提炼
**详细要求:**
1. 生成候选长期 facts
2. 落到 `memory_facts`
3. 保持与当前 QueryMemory 契约兼容

**验收标准:**
- [ ] facts 可独立存储
- [ ] 主链路不因 facts 任务阻塞

### Task 7.3: 重试与补偿
**详细要求:**
1. 为 summary / facts / index refresh 增加重试
2. 增加补偿与失败记录

**验收标准:**
- [ ] 任务失败可重试
- [ ] 主链路延迟不因后台任务上升

---

## Phase 8: 部署、观测与灰度

### Task 8.1: APISIX gRPC route 与治理
**详细要求:**
1. 配置 `memory-grpc` upstream / route
2. 增加超时、轻重试、trace 透传和 access log

**验收标准:**
- [ ] `koduck-ai` 通过 APISIX 成功访问 memory-service
- [ ] route 具备统一治理能力

### Task 8.2: 集成 `k8s/deploy.sh` / `k8s/uninstall.sh`
**详细要求:**
1. `deploy.sh` 创建 secret、安装 MinIO 与 memory-service、初始化 bucket
2. `uninstall.sh` 清理 deployment/service/secret/pvc/job
3. dev / prod 共用同一脚本入口

**验收标准:**
- [ ] `./k8s/deploy.sh dev install` 可完成安装
- [ ] `./k8s/uninstall.sh dev` 可完成清理

### Task 8.3: 观测与 SLO
**详细要求:**
1. 为关键 RPC 增加 metrics
2. 增加结构化日志字段
3. 定义基础 SLO 与错误预算

**验收标准:**
- [ ] `GetSession / QueryMemory / AppendMemory` 可观察
- [ ] latency / error rate 可统计

### Task 8.4: 灰度与回滚演练
**详细要求:**
1. 先在 dev 验证 southbound 链路
2. 验证 fail-open
3. 演练 route 回滚与版本回滚

**验收标准:**
- [ ] 新版本 memory-service 可灰度接入 `koduck-ai`
- [ ] 故障时 `koduck-ai` 主链路仍可继续
