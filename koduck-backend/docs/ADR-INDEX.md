# Koduck Backend ADR 索引

> 本文档对 `koduck-backend/docs/` 下的所有 ADR 进行分类索引，方便快速检索和知识传承。
>
> **分类说明**：
> - **A (Architecture)**：架构决策、模块边界、技术选型、性能优化、安全策略、领域模型设计
> - **C (Code Standard)**：代码规范、Checkstyle/PMD 修复、Javadoc 补全、代码风格统一、冗余清理
>
> **注意**：现有 ADR 文件名保持 `ADR-XXXX` 格式不变，分类仅在索引中标注，避免破坏历史链接和 Git 历史。

---

## 架构决策 (ADR-A)

| 编号 | 标题 | 摘要 |
|------|------|------|
| [ADR-0001](ADR-0001-kline-non-blocking-sync.md) | K-line 查询改为非阻塞同步触发 | 性能优化：避免阻塞主线程 |
| [ADR-0002](ADR-0002-providerfactory-thread-safety.md) | ProviderFactory 注册表线程安全策略 | 并发安全设计 |
| [ADR-0003](ADR-0003-flyway-baseline-rebase.md) | Flyway 迁移重置为新环境单一基线 | 数据库迁移策略 |
| [ADR-0004](ADR-0004-entity-core-field-immutability.md) | Entity 核心字段不可变约定（id / createdAt） | 领域模型约束设计 |
| [ADR-0005](ADR-0005-market-mapper-consolidation.md) | 市场领域 Mapper 合并（减少样板代码） | 领域层架构简化 |
| [ADR-0006](ADR-0006-community-signal-n-plus-one-mitigation.md) | 社区信号查询链路 N+1 风险治理（EntityGraph 预加载） | 性能与数据访问架构 |
| [ADR-0007](ADR-0007-cache-layer-abstraction.md) | 统一缓存访问抽象层（CacheLayer） | 缓存架构设计 |
| [ADR-0010](ADR-0010-demo-user-default-disabled.md) | Demo 用户默认禁用（显式开启） | 安全配置策略 |
| [ADR-0011](ADR-0011-data-service-circuit-breaker.md) | 外部数据服务调用引入 Circuit Breaker（Resilience4j） | 可靠性架构 |
| [ADR-0012](ADR-0012-api-versioning-strategy.md) | 建立 API 版本管理策略（统一路径与升级流程） | API 治理 |
| [ADR-0013](ADR-0013-spring-vault-secret-management-baseline.md) | 补充 API 密钥与敏感信息统一管理方案（Spring Vault） | 安全架构 |
| [ADR-0014](ADR-0014-security-permitall-endpoint-externalization.md) | Security permitAll 端点策略外置配置化 | 安全架构 |
| [ADR-0015](ADR-0015-prod-jwt-secret-vault-enforcement.md) | 生产环境 JWT 密钥强制由 Vault 管理 | 安全架构 |
| [ADR-0016](ADR-0016-market-provider-abstraction-unification.md) | 统一 DataService MarketProvider 抽象与错误处理 | 领域架构统一 |
| [ADR-0017](ADR-0017-jdbc-batch-for-bulk-persistence.md) | 批量持久化启用 JDBC Batch | 数据持久化性能优化 |
| [ADR-0018](ADR-0018-service-layer-exception-standardization.md) | Service 层异常抛出规范统一 | 异常处理架构 |
| [ADR-0019](ADR-0019-architecture-decision-tree-and-key-flow-visualization.md) | 补充架构决策树与关键业务流程可视化文档 | 架构文档化 |
| [ADR-0020](ADR-0020-api-changelog-governance.md) | 建立 API Changelog 记录机制 | API 治理 |
| [ADR-0021](ADR-0021-ddd-domain-boundary-governance.md) | 引入 DDD 领域划分与模块边界治理 | DDD 架构 |
| [ADR-0022](ADR-0022-ddd-phase1-core-service-migration.md) | DDD Phase 1 代码落地（核心服务按领域迁移） | DDD 架构落地 |
| [ADR-0023](ADR-0023-ddd-phase2-remaining-serviceimpl-migration.md) | DDD Phase 2 完成剩余 ServiceImpl 迁移 | DDD 架构落地 |
| [ADR-0050](ADR-0050-service-package-restructure-to-traditional.md) | Service 层包结构重构 - 回归传统分层 | 分层架构调整 |
| [ADR-0054](ADR-0054-batch-industry-query-optimization.md) | 批量行业查询 N+1 问题优化 | 性能与查询架构 |
| [ADR-0055](ADR-0055-websocket-migrate-to-rabbitmq-stomp.md) | WebSocket 迁移到 RabbitMQ STOMP | 消息与实时通信架构 |
| [ADR-0056](ADR-0056-cache-ttl-externalization.md) | 缓存 TTL 外部化配置 | 缓存架构 |
| [ADR-0057](ADR-0057-api-response-immutability-and-exception-precision.md) | ApiResponse 不可变改造与异常捕获精细化 | API 与异常架构 |
| [ADR-0058](ADR-0058-http-client-unification-webclient.md) | HTTP 客户端统一迁移到 WebClient（响应式） | 技术选型与集成架构 |
| [ADR-0061](ADR-0061-controller-business-logic-refactor.md) | Controller 层业务逻辑下沉到 Service 层 | 分层架构治理 |
| [ADR-0062](ADR-0062-controller-repository-entity-package-restructure.md) | Controller/Repository/Entity 按业务子包分组重构 | 包结构架构 |
| [ADR-0063](ADR-0063-entity-package-restructure.md) | Entity 层按业务子包分组 | 包结构架构 |
| [ADR-0064](ADR-0064-extract-fallback-template-method.md) | 提取 withFallback 模板方法统一降级策略 | 可靠性架构 |
| [ADR-0066](ADR-0066-fix-backtest-symbol-hardcode.md) | 修复 BacktestServiceImpl 交易记录 symbol 硬编码问题 | 回测引擎数据正确性 |
| [ADR-0068](ADR-0068-optimize-errorcode-fromcode-map.md) | 将 ErrorCode.fromCode 优化为 Map 缓存查找 | 性能优化 |
| [ADR-0069](ADR-0069-providerfactory-atomic-operations.md) | 使用 ReentrantReadWriteLock 保证 ProviderFactory 跨 Map 操作原子性 | 并发安全架构 |
| [ADR-0070](ADR-0070-optimize-backtest-ma-calculation.md) | 使用滑动窗口预计算 MA 序列优化回测信号生成 | 回测引擎性能优化 |
| [ADR-0071](ADR-0071-enable-http-response-compression.md) | 启用 HTTP 响应压缩（Gzip） | 基础设施性能优化 |
| [ADR-0072](ADR-0072-adr-index-and-classification.md) | 建立 ADR 分类索引页（ADR-INDEX） | 架构文档治理 |

---

## 代码规范 (ADR-C)

| 编号 | 标题 | 摘要 |
|------|------|------|
| [ADR-0008](ADR-0008-exception-javadoc-standardization.md) | Exception 层 Javadoc 规范化 | 文档规范 |
| [ADR-0009](ADR-0009-global-exception-handler-javadoc.md) | GlobalExceptionHandler Javadoc 补全与规范化 | 文档规范 |
| [ADR-0024](ADR-0024-pmd-ratchet-guard.md) | PMD 存量债务引入 Ratchet 守门机制 | 质量门禁 |
| [ADR-0025](ADR-0025-pmd-first-round-governance.md) | PMD 第一轮治理完成（MethodArgumentCouldBeFinal） | 静态分析修复 |
| [ADR-0026](ADR-0026-pre-commit-local-quality-gate.md) | 引入 pre-commit 本地质量门禁 | 工具与流程规范 |
| [ADR-0027](ADR-0027-coverage-gate-60-and-ddd-alignment.md) | 测试覆盖率门禁提升到 60% 并对齐 DDD 包路径 | 测试规范 |
| [ADR-0028](ADR-0028-core-service-coverage-gate-60-40.md) | 核心服务覆盖率门禁提升至 60/40 | 测试规范 |
| [ADR-0029](ADR-0029-alibaba-checkstyle-and-test-classification.md) | 接入 Alibaba Checkstyle 并统一测试分类规范 | 代码规范与工具 |
| [ADR-0030](ADR-0030-dto-code-style-fix.md) | DTO 代码风格告警修复 | Checkstyle 修复 |
| [ADR-0031](ADR-0031-test-checkstyle-fix.md) | 测试文件 Checkstyle 告警修复 | Checkstyle 修复 |
| [ADR-0032](ADR-0032-dto-checkstyle-fix-batch2.md) | DTO 文件 Checkstyle 告警修复（Batch 2） | Checkstyle 修复 |
| [ADR-0033](ADR-0033-multi-module-checkstyle-fix-batch3.md) | Entity、Service、Controller 等模块 Checkstyle 告警修复（Batch 3） | Checkstyle 修复 |
| [ADR-0034](ADR-0034-compile-error-and-test-checkstyle-fix.md) | 编译错误修复与测试文件 Checkstyle 告警修复 | 编译与规范修复 |
| [ADR-0035](ADR-0035-apiresponse-checkstyle-fix.md) | ApiResponse Checkstyle 代码风格修复 | Checkstyle 修复 |
| [ADR-0036](ADR-0036-risk-assessment-response-checkstyle-fix.md) | RiskAssessmentResponse Checkstyle 代码风格修复 | Checkstyle 修复 |
| [ADR-0037](ADR-0037-indicator-response-checkstyle-fix.md) | IndicatorResponse Checkstyle 代码风格修复 | Checkstyle 修复 |
| [ADR-0038](ADR-0038-dto-checkstyle-fix-batch3.md) | DTO Checkstyle 代码风格修复（Batch 3） | Checkstyle 修复 |
| [ADR-0039](ADR-0039-dto-checkstyle-fix-batch4.md) | DTO Checkstyle 代码风格修复（Batch 4） | Checkstyle 修复 |
| [ADR-0040](ADR-0040-support-provider-checkstyle-fix.md) | Support/Provider 类 Checkstyle 代码风格修复 | Checkstyle 修复 |
| [ADR-0041](ADR-0041-test-checkstyle-fix-batch2.md) | 测试文件 Checkstyle 告警修复 - Batch 2 | Checkstyle 修复 |
| [ADR-0042](ADR-0042-backend-core-checkstyle-fix-batch3.md) | 后端核心文件 Checkstyle 告警修复 - Batch 3 | Checkstyle 修复 |
| [ADR-0043](ADR-0043-backend-dto-repository-checkstyle-fix-batch4.md) | 后端 DTO 与 Repository Checkstyle 告警修复 - Batch 4 | Checkstyle 修复 |
| [ADR-0044](ADR-0044-backend-multi-module-checkstyle-fix-batch5.md) | 后端多模块 Checkstyle 告警修复 - Batch 5 | Checkstyle 修复 |
| [ADR-0045](ADR-0045-dto-redundancy-elimination.md) | DTO 层冗余类消除 | 代码清理 |
| [ADR-0046](ADR-0046-controller-redundancy-elimination.md) | Controller 层冗余消除 | 代码清理 |
| [ADR-0047](ADR-0047-repository-redundancy-elimination.md) | Repository 层冗余消除 | 代码清理 |
| [ADR-0048](ADR-0048-service-redundancy-elimination.md) | Service 层冗余消除 | 代码清理 |
| [ADR-0049](ADR-0049-entity-redundancy-elimination.md) | Entity 层冗余消除 | 代码清理 |
| [ADR-0051](ADR-0051-exception-redundancy-elimination.md) | Exception 包冗余类消除 | 代码清理 |
| [ADR-0052](ADR-0052-constant-redundancy-elimination.md) | Constant 层冗余消除 | 代码清理 |
| [ADR-0053](ADR-0053-entity-redundancy-elimination.md) | Entity 层冗余消除 | 代码清理 |
| [ADR-0059](ADR-0059-extract-index-constant.md) | 提取 INDEX 硬编码字符串为 MarketConstants 常量 | 常量规范化 |
| [ADR-0060](ADR-0060-exception-catch-refinement.md) | Service 层异常捕获精细化 | 异常处理规范 |
| [ADR-0065](ADR-0065-exception-catch-refinement-batch2.md) | Service 层异常捕获精细化（Batch 2） | 异常处理规范 |
| [ADR-0067](ADR-0067-extract-market-magic-strings.md) | 提取市场类型魔法字符串为 MarketConstants 常量 | 常量规范化 |

---

## 快速统计

- **架构决策 (A)**：35 个
- **代码规范 (C)**：36 个
- **总计**：71 个（截至 ADR-0072）

## 使用建议

1. **新成员 onboarding**：优先阅读 **ADR-A** 中的架构决策（如 ADR-0021 DDD、ADR-0012 API 版本管理、ADR-0007 缓存抽象）
2. **排查历史设计原因**：通过标题关键词在本文档中定位，再跳转具体 ADR
3. **新增 ADR 时**：请在本文档对应分类表格末尾追加一行，保持索引同步
