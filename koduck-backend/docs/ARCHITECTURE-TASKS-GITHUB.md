# 架构改进计划 - GitHub Issues 格式

> 本文档可直接用于创建 GitHub Issues  
> 使用命令: `gh issue create --title "..." --body "..." --label "..."`

---

## Issue #1: [Phase 1] 创建 koduck-market-api 模块

**标签**: `architecture`, `phase-1`, `api-module`, `P0`

**描述**:
创建 Market 领域的 API 模块，作为架构改进计划 Phase 1 的第一个任务。

**任务清单**:
- [ ] 创建 `koduck-backend/koduck-market/koduck-market-api/` 目录结构
- [ ] 创建 `pom.xml`，继承 `koduck-backend-parent`
- [ ] 从 `koduck-core` 提取 `MarketService` 接口，拆分为 `MarketQueryService` + `MarketCommandService`
- [ ] 提取相关 DTO：`MarketDataDto`, `KlineDto`, `IndicatorDto`, `RealTimePriceDto`
- [ ] 创建防腐层接口 `MarketDataAcl`
- [ ] 创建领域事件 `MarketDataUpdatedEvent`
- [ ] 创建领域异常 `MarketDataException`

**验收标准**:
1. `mvn clean compile` 成功
2. 不包含任何 Spring 依赖（除 `spring-context` 用于事件）
3. 所有 DTO 使用 Java Record 或 `@Value`
4. 接口方法有完整 Javadoc

**预估工期**: 2 天

**依赖**: 无

---

## Issue #2: [Phase 1] 创建 koduck-portfolio-api 模块

**标签**: `architecture`, `phase-1`, `api-module`, `P0`

**描述**:
创建 Portfolio 领域的 API 模块，定义投资组合管理的核心接口。

**任务清单**:
- [ ] 创建 `koduck-portfolio/koduck-portfolio-api/` 目录
- [ ] 创建 `pom.xml`
- [ ] 提取 `PortfolioService` → `PortfolioQueryService` + `PortfolioCommandService`
- [ ] 提取 `PositionService` → `PositionQueryService` + `PositionCommandService`
- [ ] 提取 DTO：`PortfolioDto`, `PortfolioSummaryDto`, `PositionDto`, `TransactionDto`
- [ ] 创建 ACL 接口 `PortfolioQueryService`（供 AI 模块使用）
- [ ] 创建值对象 `PortfolioSnapshot`（不可变）

**验收标准**:
1. 编译成功
2. DTO 全部不可变
3. ACL 接口只暴露必要查询方法

**预估工期**: 2 天

**依赖**: #1（参考结构）

---

## Issue #3: [Phase 1] 创建 koduck-strategy-api 模块

**标签**: `architecture`, `phase-1`, `api-module`, `P0`

**描述**:
创建 Strategy 领域的 API 模块，包含策略管理和回测相关接口。

**任务清单**:
- [ ] 提取 `StrategyService` 接口
- [ ] 提取 `BacktestService` 接口
- [ ] 提取 DTO：`StrategyDto`, `BacktestRequestDto`, `BacktestResultDto`, `BacktestSummaryDto`
- [ ] 创建 ACL 接口 `StrategyQueryService` + `BacktestQueryService`
- [ ] 创建值对象 `StrategySnapshot`, `BacktestResultSummary`

**预估工期**: 2 天

**依赖**: #1

---

## Issue #4: [Phase 1] 创建 koduck-community-api 模块

**标签**: `architecture`, `phase-1`, `api-module`, `P1`

**描述**:
创建 Community 领域的 API 模块。

**任务清单**:
- [ ] 提取 `SignalService`, `CommentService` 等接口
- [ ] 提取 DTO：`SignalDto`, `CommentDto`, `LikeDto`
- [ ] 创建 ACL 接口（如需要访问 Portfolio 数据）

**预估工期**: 1 天

**依赖**: #1

---

## Issue #5: [Phase 1] 创建 koduck-ai-api 模块

**标签**: `architecture`, `phase-1`, `api-module`, `P1`

**描述**:
创建 AI 领域的 API 模块。

**任务清单**:
- [ ] 提取 `AiAnalysisService` 接口
- [ ] 提取 DTO：`AiAnalysisRequestDto`, `AiAnalysisResultDto`
- [ ] AI 模块主要消费其他模块的 ACL，对外暴露较少接口

**预估工期**: 1 天

**依赖**: #1

---

## Issue #6: [Phase 1] 引入 ArchUnit 架构测试

**标签**: `architecture`, `phase-1`, `testing`, `P0`

**描述**:
引入 ArchUnit 框架，编写架构守护测试，确保改进后的架构不被破坏。

**任务清单**:
- [ ] 在父 POM 添加 ArchUnit 依赖
- [ ] 创建 `koduck-bootstrap/src/test/java/com/koduck/architecture/` 目录
- [ ] 编写 `ApiModuleRulesTest` - API 模块不依赖实现
- [ ] 编写 `DomainDependencyRulesTest` - 领域模块间不循环依赖
- [ ] 编写 `LayeredArchitectureTest` - 分层架构规则
- [ ] 编写 `NamingConventionTest` - 命名规范
- [ ] 创建 `ArchitectureConstants.java` 定义包结构常量

**验收标准**:
1. ArchUnit 测试在 CI 中运行
2. 所有现有代码通过基础规则检查
3. 规则有清晰的中文注释说明

**预估工期**: 2 天

**依赖**: #1-#5 完成结构定义

---

## Issue #7: [Phase 1] 更新父 POM 依赖管理

**标签**: `architecture`, `phase-1`, `build`, `P0`

**描述**:
统一声明所有 API 模块依赖，简化子模块配置。

**任务清单**:
- [ ] 在 `koduck-backend/pom.xml` 的 `dependencyManagement` 中添加所有 `*-api` 模块
- [ ] 更新 `koduck-bom/pom.xml`
- [ ] 检查并删除子模块中重复声明的依赖版本

**验收标准**:
1. 所有子模块无需声明版本号
2. `mvn dependency:tree` 无冲突

**预估工期**: 1 天

**依赖**: #1-#5

---

## Issue #8: [Phase 1] 编写 API 模块编码规范文档

**标签**: `architecture`, `phase-1`, `documentation`, `P1`

**描述**:
编写 API 模块的编码规范和最佳实践文档。

**任务清单**:
- [ ] 创建 `docs/api-module-guidelines.md`
- [ ] 模块结构规范
- [ ] 接口命名约定
- [ ] DTO 设计规范（不可变、Record 使用）
- [ ] 异常设计规范
- [ ] ACL 设计原则
- [ ] 版本管理策略

**验收标准**:
1. 文档通过团队评审
2. 包含代码示例

**预估工期**: 1 天

**依赖**: #1

---

## Issue #9: [Phase 2] 迁移 Market 领域 - 接口提取

**标签**: `architecture`, `phase-2`, `market`, `P0`

**描述**:
将 Market 相关接口从 koduck-core 提取到 koduck-market-api。

**任务清单**:
- [ ] 在 `koduck-market-api` 中创建 `MarketQueryService`
- [ ] 创建 `MarketCommandService`
- [ ] 创建 `MarketDataProvider`
- [ ] 提取 DTO 类到 `com.koduck.market.dto`
- [ ] 保持包名和类名一致
- [ ] 添加 `@Deprecated` 到 koduck-core 的原接口

**验收标准**:
1. 新接口编译通过
2. 原接口标记为 Deprecated
3. 无业务逻辑变更

**预估工期**: 2 天

**依赖**: #1, #6

---

## Issue #10: [Phase 2] 迁移 Market 领域 - 实现迁移

**标签**: `architecture`, `phase-2`, `market`, `P0`

**描述**:
创建 koduck-market-impl 模块，迁移实现代码。

**任务清单**:
- [ ] 创建 `koduck-market/koduck-market-impl/` 模块
- [ ] 迁移 `MarketServiceImpl`
- [ ] 迁移 Market 相关的 Repository 接口和实现
- [ ] 迁移 Market 相关的 Entity
- [ ] 更新 `koduck-market-impl/pom.xml` 依赖
- [ ] 确保实现类实现新 API 接口
- [ ] 补充单元测试（覆盖率 ≥ 60%）

**验收标准**:
1. `mvn clean test` 通过
2. 单元测试覆盖率 ≥ 60%
3. 无编译错误

**预估工期**: 3 天

**依赖**: #9

---

## Issue #11: [Phase 2] 迁移 Portfolio 领域 - 接口提取

**标签**: `architecture`, `phase-2`, `portfolio`, `P0`

**描述**:
提取 Portfolio 领域接口到 koduck-portfolio-api。

**任务清单**:
- [ ] 创建 `PortfolioQueryService` 接口（供 AI 模块使用）
- [ ] 创建 `PortfolioCommandService` 接口
- [ ] 提取 DTO：`PortfolioDto`, `PositionDto`, `TransactionDto`
- [ ] 创建 ACL 专用值对象 `PortfolioSnapshot`

**验收标准**:
1. ACL 接口只暴露只读方法
2. Snapshot 对象不可变

**预估工期**: 2 天

**依赖**: #2

---

## Issue #12: [Phase 2] 迁移 Portfolio 领域 - 实现迁移

**标签**: `architecture`, `phase-2`, `portfolio`, `P0`

**描述**:
创建 koduck-portfolio-impl 模块。

**任务清单**:
- [ ] 创建 `koduck-portfolio-impl` 模块
- [ ] 迁移 `PortfolioServiceImpl`（424 行，需适当拆分）
- [ ] 迁移 `PositionServiceImpl`
- [ ] 迁移 Entity 和 Repository
- [ ] 实现 ACL 接口 `PortfolioQueryService`
- [ ] 补充单元测试

**验收标准**:
1. 服务实现拆分合理（单类 < 200 行）
2. 单元测试覆盖主要逻辑

**预估工期**: 3 天

**依赖**: #11

---

## Issue #13: [Phase 2] 更新 AI 模块依赖 - Portfolio ACL

**标签**: `architecture`, `phase-2`, `ai`, `acl`, `P0`

**描述**:
将 AI 模块对 Portfolio 的依赖改为通过 ACL。

**任务清单**:
- [ ] 在 `koduck-ai` 模块中删除直接依赖 `koduck-portfolio`
- [ ] 添加依赖 `koduck-portfolio-api`
- [ ] 修改 `AiAnalysisServiceImpl`，注入 `PortfolioQueryService`
- [ ] 替换所有直接 Repository 访问
- [ ] 验证 `PortfolioSnapshot` 包含 AI 分析所需字段
- [ ] 功能测试

**验收标准**:
1. AI 模块不再直接依赖 Portfolio Repository
2. 所有跨模块查询通过 ACL
3. 功能测试通过

**预估工期**: 2 天

**依赖**: #11

---

## Issue #14: [Phase 2] 迁移 Strategy 领域

**标签**: `architecture`, `phase-2`, `strategy`, `P1`

**描述**:
迁移 Strategy 和 Backtest 领域。

**任务清单**:
- [ ] 创建 `koduck-strategy-api` 模块
- [ ] 创建 `koduck-strategy-impl` 模块
- [ ] 迁移 `StrategyServiceImpl`
- [ ] 迁移 `BacktestServiceImpl`
- [ ] 迁移回测相关 Entity
- [ ] 创建 ACL 接口供 AI 模块使用
- [ ] 补充测试

**验收标准**:
1. 回测功能完整迁移
2. AI 模块通过 ACL 访问回测数据

**预估工期**: 4 天

**依赖**: #9（Market 作为依赖）

---

## Issue #15: [Phase 2] 迁移 Community 领域

**标签**: `architecture`, `phase-2`, `community`, `P1`

**描述**:
迁移 Community 领域（信号系统）。

**任务清单**:
- [ ] 创建 `koduck-community-api` 模块
- [ ] 创建 `koduck-community-impl` 模块
- [ ] 迁移信号相关 Service
- [ ] 迁移 Comment、Like 相关 Service
- [ ] 信号通过 ACL 查询 Portfolio 信息
- [ ] 补充测试

**预估工期**: 3 天

**依赖**: #11（Portfolio ACL）

---

## Issue #16: [Phase 2] 更新 koduck-core 依赖

**标签**: `architecture`, `phase-2`, `core`, `P0`

**描述**:
将 koduck-core 的依赖改为仅依赖各 api 模块。

**任务清单**:
- [ ] 修改 `koduck-core/pom.xml`，移除 `koduck-portfolio` 依赖
- [ ] 添加 `koduck-portfolio-api` 依赖
- [ ] 同样修改 Market、Strategy、Community 的依赖
- [ ] 更新 koduck-core 中的代码，通过接口调用

**验收标准**:
1. koduck-core 不再依赖任何 `*-impl` 模块
2. 编译通过

**预估工期**: 2 天

**依赖**: #10, #12, #14, #15

---

## Issue #17: [Phase 2] 迁移 AI 领域

**标签**: `architecture`, `phase-2`, `ai`, `P1`

**描述**:
迁移 AI 领域模块。

**任务清单**:
- [ ] 创建 `koduck-ai-api` 模块（接口较少）
- [ ] 创建 `koduck-ai-impl` 模块
- [ ] 迁移 `AiAnalysisServiceImpl`（397 行，需拆分）
- [ ] 迁移 LLM Provider 相关代码
- [ ] 确保所有外部依赖通过 ACL
- [ ] 补充测试

**验收标准**:
1. AI 分析功能完整
2. 所有外部依赖通过 ACL

**预估工期**: 3 天

**依赖**: #13

---

## Issue #18: [Phase 2] 各模块补充独立测试

**标签**: `architecture`, `phase-2`, `testing`, `P1`

**描述**:
为每个领域模块补充独立的单元测试和集成测试。

**各模块测试要求**:
- koduck-market-impl: Service 层测试, Repository 测试, 覆盖率 ≥ 60%
- koduck-portfolio-impl: Service 层测试, Repository 测试, 覆盖率 ≥ 60%
- koduck-strategy-impl: 回测逻辑测试, 覆盖率 ≥ 60%
- koduck-community-impl: Service 层测试, 覆盖率 ≥ 50%
- koduck-ai-impl: LLM 调用测试（Mock）, 覆盖率 ≥ 50%

**验收标准**:
1. 各模块 `mvn test` 独立通过
2. JaCoCo 报告达到覆盖率目标

**预估工期**: 5 天（分散在各任务中）

**依赖**: 各模块迁移完成

---

## Issue #19: [Phase 3] 重构 koduck-infrastructure 实现层

**标签**: `architecture`, `phase-3`, `infrastructure`, `P0`

**描述**:
重构基础设施模块，实现各 API 定义的技术接口。

**任务清单**:
- [ ] 分析 `koduck-infrastructure` 当前结构
- [ ] 创建 Repository 实现类，实现各 `*-api` 定义的接口
- [ ] 缓存实现迁移到对应模块
- [ ] 确保 `koduck-infrastructure` 依赖所有 `*-api` 模块

**验收标准**:
1. 所有 Repository 接口有实现
2. 无循环依赖

**预估工期**: 3 天

**依赖**: Phase 2 完成

---

## Issue #20: [Phase 3] 瘦身 koduck-core

**标签**: `architecture`, `phase-3`, `core`, `P0`

**描述**:
移除 koduck-core 中的所有业务逻辑，仅保留跨领域协调。

**任务清单**:
- [ ] 迁移剩余业务代码到对应领域模块
- [ ] 保留跨领域事务协调服务
- [ ] 保留全局配置（如需要）
- [ ] 删除已迁移的 Service、Repository、Entity
- [ ] 更新 `koduck-core/pom.xml`，移除不需要的依赖

**验收标准**:
1. koduck-core 代码行数 < 1,000
2. 仅保留协调逻辑
3. 编译通过，测试通过

**预估工期**: 3 天

**依赖**: #19

---

## Issue #21: [Phase 3] 建立领域事件机制

**标签**: `architecture`, `phase-3`, `event-driven`, `P1`

**描述**:
引入领域事件机制，解耦跨模块通信。

**任务清单**:
- [ ] 在 `koduck-common` 创建基础事件类 `DomainEvent`
- [ ] 在各 `*-api` 模块定义领域事件
- [ ] 在 `koduck-infrastructure` 配置 Spring Event 或 RabbitMQ
- [ ] 选择一个场景试点事件驱动（如信号发布通知）

**验收标准**:
1. 事件发布/订阅机制运行正常
2. 至少一个业务场景使用事件驱动

**预估工期**: 2 天

**依赖**: #20

---

## Issue #22: [Phase 3] 统一配置管理

**标签**: `architecture`, `phase-3`, `configuration`, `P1`

**描述**:
各模块独立管理配置，bootstrap 仅做组装。

**任务清单**:
- [ ] 为每个 `*-impl` 模块创建 `application-{module}.yml`
- [ ] 提取模块专属配置（缓存 TTL、Provider 配置等）
- [ ] 更新 `koduck-bootstrap` 的 `application.yml`
- [ ] 配置外部化：将 `DEFAULT_LLM_PROVIDER` 等常量移到配置

**验收标准**:
1. 各模块配置独立
2. 无硬编码配置值
3. 启动时配置加载正确

**预估工期**: 2 天

**依赖**: #20

---

## Issue #23: [Phase 4] 完善 ArchUnit 架构守护测试

**标签**: `architecture`, `phase-4`, `testing`, `P0`

**描述**:
编写全面的 ArchUnit 测试，防止架构退化。

**任务清单**:
- [ ] 编写包依赖规则测试
- [ ] 编写分层架构规则测试
- [ ] 编写命名规范规则测试
- [ ] 编写循环依赖检测规则测试

**验收标准**:
1. 所有 ArchUnit 测试通过
2. CI 中 ArchUnit 测试失败会阻断构建

**预估工期**: 2 天

**依赖**: Phase 3 完成

---

## Issue #24: [Phase 4] 补充各模块独立测试

**标签**: `architecture`, `phase-4`, `testing`, `P0`

**描述**:
确保各模块有完整的测试套件。

**任务清单**:
- [ ] 检查各模块测试覆盖率
- [ ] 补充缺失的单元测试
- [ ] 为每个模块创建独立的集成测试
- [ ] 创建模块级测试配置

**验收标准**:
1. 各模块独立 `mvn test` 通过
2. 整体覆盖率 ≥ 60%

**预估工期**: 3 天

**依赖**: #23

---

## Issue #25: [Phase 4] 建立性能基准测试

**标签**: `architecture`, `phase-4`, `performance`, `P1`

**描述**:
使用 JMH 建立关键路径的性能基准。

**任务清单**:
- [ ] 添加 JMH 依赖
- [ ] 编写 `MarketDataQueryBenchmark`
- [ ] 编写 `PortfolioCalculationBenchmark`
- [ ] 编写 `BacktestExecutionBenchmark`
- [ ] 创建性能测试报告模板

**验收标准**:
1. 关键路径有性能基线
2. 性能退化可检测

**预估工期**: 2 天

**依赖**: #24

---

## Issue #26: [Phase 4] 优化 N+1 查询问题

**标签**: `architecture`, `phase-4`, `performance`, `P0`

**描述**:
解决 Portfolio 模块的 N+1 查询问题。

**任务清单**:
- [ ] 在 `koduck-portfolio-api` 添加批量查询接口 `getLatestPrices`
- [ ] 在 `PortfolioServiceImpl` 中批量查询价格
- [ ] 使用 `@Query` 优化 JPQL
- [ ] 添加缓存注解

**验收标准**:
1. 组合查询 SQL 数量从 N+1 减少到 2
2. 性能测试验证提升

**预估工期**: 2 天

**依赖**: #12

---

## Issue #27: [Phase 4] 更新 Dockerfile

**标签**: `architecture`, `phase-4`, `deployment`, `P0`

**描述**:
重写 Dockerfile 适配多模块结构。

**任务清单**:
- [ ] 修改 `koduck-backend/Dockerfile`，先复制所有 pom.xml
- [ ] 优化构建层缓存
- [ ] 测试镜像构建

**验收标准**:
1. `docker build` 成功
2. 镜像大小合理（< 200MB）
3. 启动正常

**预估工期**: 1 天

**依赖**: Phase 3 完成

---

## 里程碑设置建议

| 里程碑 | 包含 Issues | 截止日期 |
|--------|-------------|----------|
| **Phase 1 完成** | #1-#8 | Week 2 结束 |
| **Phase 2 完成** | #9-#18 | Week 8 结束 |
| **Phase 3 完成** | #19-#22 | Week 10 结束 |
| **Phase 4 完成** | #23-#27 | Week 12 结束 |
| **架构改进完成** | #1-#27 | Week 12 结束 |

---

## 快速创建 Issues 脚本

```bash
#!/bin/bash
# create-architecture-issues.sh

# Phase 1
gh issue create --title "[Phase 1] 创建 koduck-market-api 模块" --body-file - --label "architecture,phase-1,P0" << 'EOF'
创建 Market 领域的 API 模块...
EOF

# 或使用批量创建
for i in {1..27}; do
  gh issue create --title "[ARCH-$i] $(cat issue-$i-title.txt)" \
                  --body "$(cat issue-$i-body.txt)" \
                  --label "architecture"
done
```

---

> 提示：创建 Issue 后，建议使用 GitHub Projects 进行看板管理。
