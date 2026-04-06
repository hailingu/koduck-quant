# 架构改进计划 - 具体任务清单

> **关联文档**: [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)  
> **创建日期**: 2026-04-05  
> **状态**: 待执行

---

## 📋 任务总览

| Phase | 任务数 | 预计工期 | 关键里程碑 |
|-------|--------|----------|------------|
| Phase 1 - 基础设施准备 | 8 | 2 周 | API 模块就绪 |
| Phase 2 - Core 模块迁移 | 10 | 6 周 | 领域模块独立 |
| Phase 3 - 基础设施重构 | 4 | 2 周 | Core 瘦身完成 |
| Phase 4 - 质量加固 | 5 | 2 周 | 架构守护生效 |
| **总计** | **27** | **12 周** | - |

---

## Phase 1: 基础设施准备（Week 1-2）

### Task 1.1: 创建 koduck-market-api 模块

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: 无
- **标签**: `architecture`, `phase-1`, `api-module`

**详细描述**
创建 Market 领域的 API 模块，包含所有对外暴露的接口和 DTO。

**具体步骤**
1. 创建 `koduck-backend/koduck-market/koduck-market-api/` 目录结构
2. 创建 `pom.xml`，继承 `koduck-backend-parent`
3. 从 `koduck-core` 提取以下接口：
   - `MarketService` → 拆分为 `MarketQueryService` + `MarketCommandService`
   - `MarketDataProvider`（已存在，确认是否需要迁移）
4. 提取相关 DTO：
   - `MarketDataDto`
   - `KlineDto`
   - `IndicatorDto`
   - `RealTimePriceDto`
5. 创建防腐层接口 `MarketDataAcl`（供其他模块查询行情数据）
6. 创建领域事件 `MarketDataUpdatedEvent`
7. 创建领域异常 `MarketDataException`

**验收标准**
- [ ] `mvn clean compile` 成功
- [ ] 不包含任何 Spring 依赖（除 `spring-context` 用于事件）
- [ ] 所有 DTO 使用 Java Record 或 `@Value`
- [ ] 接口方法有完整 Javadoc

**输出物**
- `koduck-market-api/pom.xml`
- `koduck-market-api/src/main/java/com/koduck/market/api/*.java`
- `koduck-market-api/src/main/java/com/koduck/market/dto/*.java`

---

### Task 1.2: 创建 koduck-portfolio-api 模块

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 1.1（参考结构）
- **标签**: `architecture`, `phase-1`, `api-module`

**详细描述**
创建 Portfolio 领域的 API 模块。

**具体步骤**
1. 创建 `koduck-portfolio/koduck-portfolio-api/` 目录
2. 从 `koduck-core` 提取：
   - `PortfolioService` → `PortfolioQueryService` + `PortfolioCommandService`
   - `PositionService` → `PositionQueryService` + `PositionCommandService`
3. 提取 DTO：
   - `PortfolioDto`
   - `PortfolioSummaryDto`
   - `PositionDto`
   - `TransactionDto`
4. 创建 ACL 接口 `PortfolioQueryService`（供 AI 模块使用）
5. 创建值对象 `PortfolioSnapshot`（不可变）

**验收标准**
- [ ] 编译成功
- [ ] DTO 全部不可变
- [ ] ACL 接口只暴露必要查询方法

---

### Task 1.3: 创建 koduck-strategy-api 模块

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 1.1
- **标签**: `architecture`, `phase-1`, `api-module`

**详细描述**
创建 Strategy 领域的 API 模块，包含策略管理和回测相关接口。

**具体步骤**
1. 提取 `StrategyService` 接口
2. 提取 `BacktestService` 接口
3. 提取 DTO：
   - `StrategyDto`
   - `BacktestRequestDto`
   - `BacktestResultDto`
   - `BacktestSummaryDto`
4. 创建 ACL 接口 `StrategyQueryService` + `BacktestQueryService`
5. 创建值对象 `StrategySnapshot`, `BacktestResultSummary`

**验收标准**
- [ ] 编译成功
- [ ] 回测相关 DTO 完整

---

### Task 1.4: 创建 koduck-community-api 模块

**基本信息**
- **优先级**: P1
- **工期**: 1 天
- **依赖**: Task 1.1
- **标签**: `architecture`, `phase-1`, `api-module`

**详细描述**
创建 Community 领域的 API 模块。

**具体步骤**
1. 提取 `SignalService`, `CommentService` 等接口
2. 提取 DTO：`SignalDto`, `CommentDto`, `LikeDto`
3. 创建 ACL 接口（如需要访问 Portfolio 数据）

---

### Task 1.5: 创建 koduck-ai-api 模块

**基本信息**
- **优先级**: P1
- **工期**: 1 天
- **依赖**: Task 1.1
- **标签**: `architecture`, `phase-1`, `api-module`

**详细描述**
创建 AI 领域的 API 模块。

**具体步骤**
1. 提取 `AiAnalysisService` 接口
2. 提取 DTO：`AiAnalysisRequestDto`, `AiAnalysisResultDto`
3. AI 模块主要消费其他模块的 ACL，对外暴露较少接口

---

### Task 1.6: 引入 ArchUnit 架构测试

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 1.1-1.5 完成结构定义
- **标签**: `architecture`, `phase-1`, `testing`

**详细描述**
引入 ArchUnit 框架，编写架构守护测试。

**具体步骤**
1. 在父 POM 添加 ArchUnit 依赖：
   ```xml
   <dependency>
       <groupId>com.tngtech.archunit</groupId>
       <artifactId>archunit-junit5</artifactId>
       <version>1.2.1</version>
       <scope>test</scope>
   </dependency>
   ```
2. 创建 `koduck-bootstrap/src/test/java/com/koduck/architecture/` 目录
3. 编写基础规则测试：
   - `ApiModuleRulesTest` - API 模块不依赖实现
   - `DomainDependencyRulesTest` - 领域模块间不循环依赖
   - `LayeredArchitectureTest` - 分层架构规则
   - `NamingConventionTest` - 命名规范
4. 创建 `ArchitectureConstants.java` 定义包结构常量

**验收标准**
- [ ] ArchUnit 测试在 CI 中运行
- [ ] 所有现有代码通过基础规则检查
- [ ] 规则有清晰的中文注释说明

**输出物**
- `koduck-bootstrap/src/test/java/com/koduck/architecture/*Test.java`
- `koduck-bootstrap/src/test/java/com/koduck/architecture/ArchitectureConstants.java`

---

### Task 1.7: 更新父 POM 依赖管理

**基本信息**
- **优先级**: P0
- **工期**: 1 天
- **依赖**: Task 1.1-1.5
- **标签**: `architecture`, `phase-1`, `build`

**详细描述**
统一声明所有 API 模块依赖，简化子模块配置。

**具体步骤**
1. 在 `koduck-backend/pom.xml` 的 `dependencyManagement` 中添加：
   ```xml
   <dependency>
       <groupId>com.koduck</groupId>
       <artifactId>koduck-market-api</artifactId>
       <version>${koduck.version}</version>
   </dependency>
   <!-- 其他 api 模块... -->
   ```
2. 创建 `koduck-bom/pom.xml` 更新，包含所有 api 模块
3. 检查并删除子模块中重复声明的依赖版本

**验收标准**
- [ ] 所有子模块无需声明版本号
- [ ] `mvn dependency:tree` 无冲突

---

### Task 1.8: 编写 API 模块编码规范文档

**基本信息**
- **优先级**: P1
- **工期**: 1 天
- **依赖**: Task 1.1
- **标签**: `architecture`, `phase-1`, `documentation`

**详细描述**
编写 API 模块的编码规范和最佳实践。

**具体步骤**
1. 创建 `docs/api-module-guidelines.md`
2. 包含内容：
   - 模块结构规范
   - 接口命名约定
   - DTO 设计规范（不可变、Record 使用）
   - 异常设计规范
   - ACL 设计原则
   - 版本管理策略

**验收标准**
- [ ] 文档通过团队评审
- [ ] 包含代码示例

---

## Phase 2: Core 模块迁移（Week 3-8）

### Task 2.1: 迁移 Market 领域 - 接口提取

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 1.1, 1.6
- **标签**: `architecture`, `phase-2`, `market`

**详细描述**
将 Market 相关接口从 koduck-core 提取到 koduck-market-api。

**具体步骤**
1. 在 `koduck-market-api` 中创建：
   - `com.koduck.market.api.MarketQueryService`
   - `com.koduck.market.api.MarketCommandService`
   - `com.koduck.market.api.MarketDataProvider`
2. 提取 DTO 类到 `com.koduck.market.dto`
3. 保持包名和类名一致，便于后续迁移
4. 添加 `@Deprecated` 到 koduck-core 的原接口，指向新位置

**验收标准**
- [ ] 新接口编译通过
- [ ] 原接口标记为 Deprecated
- [ ] 无业务逻辑变更

---

### Task 2.2: 迁移 Market 领域 - 实现迁移

**基本信息**
- **优先级**: P0
- **工期**: 3 天
- **依赖**: Task 2.1
- **标签**: `architecture`, `phase-2`, `market`

**详细描述**
创建 koduck-market-impl 模块，迁移实现代码。

**具体步骤**
1. 创建 `koduck-market/koduck-market-impl/` 模块
2. 迁移 `MarketServiceImpl` 到 `koduck-market-impl`
3. 迁移 Market 相关的 Repository 接口和实现
4. 迁移 Market 相关的 Entity
5. 更新 `koduck-market-impl/pom.xml` 依赖：
   - 依赖 `koduck-market-api`
   - 依赖 `koduck-infrastructure`
   - 依赖 `koduck-common`
6. 确保实现类实现新 API 接口

**验收标准**
- [ ] `mvn clean test` 通过
- [ ] 单元测试覆盖率 ≥ 60%
- [ ] 无编译错误

---

### Task 2.3: 迁移 Portfolio 领域 - 接口提取

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 1.2
- **标签**: `architecture`, `phase-2`, `portfolio`

**详细描述**
提取 Portfolio 领域接口到 koduck-portfolio-api。

**具体步骤**
1. 创建 `PortfolioQueryService` 接口（供 AI 模块使用）
2. 创建 `PortfolioCommandService` 接口
3. 提取 DTO：`PortfolioDto`, `PositionDto`, `TransactionDto`
4. 创建 ACL 专用值对象：
   ```java
   public record PortfolioSnapshot(
       Long portfolioId,
       String portfolioName,
       List<PositionSnapshot> positions,
       BigDecimal totalValue,
       BigDecimal totalCost,
       BigDecimal totalReturn
   ) {}
   ```

**验收标准**
- [ ] ACL 接口只暴露只读方法
- [ ] Snapshot 对象不可变

---

### Task 2.4: 迁移 Portfolio 领域 - 实现迁移

**基本信息**
- **优先级**: P0
- **工期**: 3 天
- **依赖**: Task 2.3
- **标签**: `architecture`, `phase-2`, `portfolio`

**详细描述**
创建 koduck-portfolio-impl 模块。

**具体步骤**
1. 创建 `koduck-portfolio-impl` 模块
2. 迁移 `PortfolioServiceImpl`（424 行，需适当拆分）
3. 迁移 `PositionServiceImpl`
4. 迁移 Entity 和 Repository
5. 实现 ACL 接口 `PortfolioQueryService`

**验收标准**
- [ ] 服务实现拆分合理（单类 < 200 行）
- [ ] 单元测试覆盖主要逻辑

---

### Task 2.5: 更新 AI 模块依赖 - Portfolio ACL

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 2.3
- **标签**: `architecture`, `phase-2`, `ai`, `acl`

**详细描述**
将 AI 模块对 Portfolio 的依赖改为通过 ACL。

**具体步骤**
1. 在 `koduck-ai` 模块中：
   - 删除直接依赖 `koduck-portfolio`
   - 添加依赖 `koduck-portfolio-api`
2. 修改 `AiAnalysisServiceImpl`：
   - 注入 `PortfolioQueryService`（ACL 接口）
   - 替换所有直接 Repository 访问
3. 验证 `PortfolioSnapshot` 包含 AI 分析所需的所有字段

**验收标准**
- [ ] AI 模块不再直接依赖 Portfolio Repository
- [ ] 所有跨模块查询通过 ACL
- [ ] 功能测试通过

---

### Task 2.6: 迁移 Strategy 领域

**基本信息**
- **优先级**: P1
- **工期**: 4 天
- **依赖**: Task 2.1（Market 作为依赖）
- **标签**: `architecture`, `phase-2`, `strategy`

**详细描述**
迁移 Strategy 和 Backtest 领域。

**具体步骤**
1. 创建 `koduck-strategy-api`：
   - `StrategyQueryService`, `StrategyCommandService`
   - `BacktestQueryService`, `BacktestCommandService`
   - DTO: `StrategyDto`, `BacktestRequestDto`, `BacktestResultDto`
2. 创建 `koduck-strategy-impl`：
   - 迁移 `StrategyServiceImpl`
   - 迁移 `BacktestServiceImpl`
   - 迁移回测相关 Entity
3. 创建 ACL 接口供 AI 模块使用

**验收标准**
- [ ] 回测功能完整迁移
- [ ] AI 模块通过 ACL 访问回测数据

---

### Task 2.7: 迁移 Community 领域

**基本信息**
- **优先级**: P1
- **工期**: 3 天
- **依赖**: Task 2.3（Portfolio ACL）
- **标签**: `architecture`, `phase-2`, `community`

**详细描述**
迁移 Community 领域（信号系统）。

**具体步骤**
1. 创建 `koduck-community-api`：
   - `SignalQueryService`, `SignalCommandService`
   - `CommentQueryService`, `CommentCommandService`
2. 创建 `koduck-community-impl`：
   - 迁移信号相关 Service
   - 迁移 Comment、Like 相关 Service
3. 信号可能需要通过 ACL 查询 Portfolio 信息

---

### Task 2.8: 更新 koduck-core 依赖

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 2.2, 2.4, 2.6, 2.7
- **标签**: `architecture`, `phase-2`, `core`

**详细描述**
将 koduck-core 的依赖改为仅依赖各 api 模块。

**具体步骤**
1. 修改 `koduck-core/pom.xml`：
   ```xml
   <!-- 删除 -->
   <dependency>
       <groupId>com.koduck</groupId>
       <artifactId>koduck-portfolio</artifactId>
   </dependency>
   
   <!-- 改为 -->
   <dependency>
       <groupId>com.koduck</groupId>
       <artifactId>koduck-portfolio-api</artifactId>
   </dependency>
   ```
2. 同样修改 Market、Strategy、Community 的依赖
3. 更新 koduck-core 中的代码，通过接口调用

**验收标准**
- [ ] koduck-core 不再依赖任何 `*-impl` 模块
- [ ] 编译通过

---

### Task 2.9: 迁移 AI 领域

**基本信息**
- **优先级**: P1
- **工期**: 3 天
- **依赖**: Task 2.5
- **标签**: `architecture`, `phase-2`, `ai`

**详细描述**
迁移 AI 领域模块。

**具体步骤**
1. 创建 `koduck-ai-api`（接口较少，主要是配置）
2. 创建 `koduck-ai-impl`：
   - 迁移 `AiAnalysisServiceImpl`（397 行，需拆分）
   - 迁移 LLM Provider 相关代码
3. AI 模块主要消费其他模块的 ACL

**验收标准**
- [ ] AI 分析功能完整
- [ ] 所有外部依赖通过 ACL

---

### Task 2.10: 各模块补充独立测试

**基本信息**
- **优先级**: P1
- **工期**: 5 天（分散在各任务中）
- **依赖**: 各模块迁移完成
- **标签**: `architecture`, `phase-2`, `testing`

**详细描述**
为每个领域模块补充独立的单元测试和集成测试。

**各模块测试要求**

| 模块 | 单元测试 | 集成测试 | 覆盖率目标 |
|------|----------|----------|------------|
| koduck-market-impl | Service 层测试 | Repository 测试 | 60% |
| koduck-portfolio-impl | Service 层测试 | Repository 测试 | 60% |
| koduck-strategy-impl | 回测逻辑测试 | - | 60% |
| koduck-community-impl | Service 层测试 | - | 50% |
| koduck-ai-impl | LLM 调用测试（Mock） | - | 50% |

**验收标准**
- [ ] 各模块 `mvn test` 独立通过
- [ ] JaCoCo 报告达到覆盖率目标

---

## Phase 3: 基础设施重构（Week 9-10）

### Task 3.1: 重构 koduck-infrastructure 实现层

**基本信息**
- **优先级**: P0
- **工期**: 3 天
- **依赖**: Phase 2 完成
- **标签**: `architecture`, `phase-3`, `infrastructure`

**详细描述**
重构基础设施模块，实现各 API 定义的技术接口。

**具体步骤**
1. 分析 `koduck-infrastructure` 当前结构
2. 创建实现类：
   - `MarketRepositoryImpl` 实现 `MarketRepository`（来自 market-api）
   - `PortfolioRepositoryImpl` 实现 `PortfolioRepository`
   - 其他 Repository 实现...
3. 缓存实现迁移到对应模块
4. 确保 `koduck-infrastructure` 依赖所有 `*-api` 模块

**验收标准**
- [ ] 所有 Repository 接口有实现
- [ ] 无循环依赖

---

### Task 3.2: 瘦身 koduck-core

**基本信息**
- **优先级**: P0
- **工期**: 3 天
- **依赖**: Task 3.1
- **标签**: `architecture`, `phase-3`, `core`

**详细描述**
移除 koduck-core 中的所有业务逻辑，仅保留跨领域协调。

**具体步骤**
1. 迁移剩余业务代码到对应领域模块
2. 保留内容（仅以下）：
   - 跨领域事务协调服务
   - 全局配置（如需要）
   - 共享工具类（考虑移到 common）
3. 删除已迁移的 Service、Repository、Entity
4. 更新 `koduck-core/pom.xml`，移除不需要的依赖

**验收标准**
- [ ] koduck-core 代码行数 < 1,000
- [ ] 仅保留协调逻辑
- [ ] 编译通过，测试通过

---

### Task 3.3: 建立领域事件机制

**基本信息**
- **优先级**: P1
- **工期**: 2 天
- **依赖**: Task 3.2
- **标签**: `architecture`, `phase-3`, `event-driven`

**详细描述**
引入领域事件机制，解耦跨模块通信。

**具体步骤**
1. 在 `koduck-common` 创建基础事件类：
   ```java
   public abstract class DomainEvent {
       private final String eventId;
       private final Instant occurredOn;
   }
   ```
2. 在各 `*-api` 模块定义领域事件：
   - `MarketDataUpdatedEvent`
   - `PortfolioCreatedEvent`
   - `SignalPublishedEvent`
3. 在 `koduck-infrastructure` 配置 Spring Event 或 RabbitMQ
4. 选择一个场景试点事件驱动（如信号发布通知）

**验收标准**
- [ ] 事件发布/订阅机制运行正常
- [ ] 至少一个业务场景使用事件驱动

---

### Task 3.4: 统一配置管理

**基本信息**
- **优先级**: P1
- **工期**: 2 天
- **依赖**: Task 3.2
- **标签**: `architecture`, `phase-3`, `configuration`

**详细描述**
各模块独立管理配置，bootstrap 仅做组装。

**具体步骤**
1. 为每个 `*-impl` 模块创建 `application-{module}.yml`
2. 提取模块专属配置：
   - `koduck-market-impl`: 行情缓存 TTL、Provider 配置
   - `koduck-portfolio-impl`: 组合计算参数
   - `koduck-ai-impl`: LLM Provider 配置（替代硬编码）
3. 更新 `koduck-bootstrap` 的 `application.yml`，使用 `spring.profiles.include`
4. 配置外部化：将 `DEFAULT_LLM_PROVIDER` 等常量移到配置

**验收标准**
- [ ] 各模块配置独立
- [ ] 无硬编码配置值
- [ ] 启动时配置加载正确

---

## Phase 4: 质量加固（Week 11-12）

### Task 4.1: 完善 ArchUnit 架构守护测试

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Phase 3 完成
- **标签**: `architecture`, `phase-4`, `testing`

**详细描述**
编写全面的 ArchUnit 测试，防止架构退化。

**具体步骤**
1. 编写包依赖规则：
   ```java
   @ArchTest
   static final ArchRule api_modules_should_not_depend_on_impl =
       noClasses()
           .that().resideInAPackage("..api..")
           .should().dependOnClassesThat().resideInAPackage("..impl..");
   ```
2. 编写分层规则：
   ```java
   @ArchTest
   static final ArchRule layered_architecture_should_be_respected =
       layeredArchitecture()
           .layer("API").definedBy("..api..")
           .layer("Impl").definedBy("..impl..")
           .layer("Infrastructure").definedBy("..infrastructure..")
           .whereLayer("API").mayNotAccessAnyLayer()
           .whereLayer("Impl").mayOnlyAccessLayers("API", "Infrastructure")
           .whereLayer("Infrastructure").mayOnlyAccessLayers("API");
   ```
3. 编写命名规范规则
4. 编写循环依赖检测规则

**验收标准**
- [ ] 所有 ArchUnit 测试通过
- [ ] CI 中 ArchUnit 测试失败会阻断构建

---

### Task 4.2: 补充各模块独立测试

**基本信息**
- **优先级**: P0
- **工期**: 3 天
- **依赖**: Task 4.1
- **标签**: `architecture`, `phase-4`, `testing`

**详细描述**
确保各模块有完整的测试套件。

**具体步骤**
1. 检查各模块测试覆盖率
2. 补充缺失的单元测试
3. 为每个模块创建独立的集成测试：
   - `@DataJpaTest` 测试 Repository
   - `@WebMvcTest` 测试 Controller
   - `@SpringBootTest` 测试完整流程
4. 创建模块级测试配置

**验收标准**
- [ ] 各模块独立 `mvn test` 通过
- [ ] 整体覆盖率 ≥ 60%

---

### Task 4.3: 建立性能基准测试

**基本信息**
- **优先级**: P1
- **工期**: 2 天
- **依赖**: Task 4.2
- **标签**: `architecture`, `phase-4`, `performance`

**详细描述**
使用 JMH 建立关键路径的性能基准。

**具体步骤**
1. 添加 JMH 依赖
2. 编写基准测试：
   - `MarketDataQueryBenchmark` - 行情查询性能
   - `PortfolioCalculationBenchmark` - 组合计算性能
   - `BacktestExecutionBenchmark` - 回测执行性能
3. 创建性能测试报告模板
4. 将性能测试加入 CI（可选，可能较慢）

**验收标准**
- [ ] 关键路径有性能基线
- [ ] 性能退化可检测

---

### Task 4.4: 优化 N+1 查询问题

**基本信息**
- **优先级**: P0
- **工期**: 2 天
- **依赖**: Task 2.4
- **标签**: `architecture`, `phase-4`, `performance`

**详细描述**
解决 Portfolio 模块的 N+1 查询问题。

**具体步骤**
1. 在 `koduck-portfolio-api` 添加批量查询接口：
   ```java
   public interface PortfolioPriceService {
       Map<String, BigDecimal> getLatestPrices(List<String> symbols);
   }
   ```
2. 在 `PortfolioServiceImpl` 中：
   - 收集所有持仓的 symbol
   - 批量查询价格
   - 映射到各个持仓
3. 使用 `@Query` 优化 JPQL
4. 添加缓存注解

**验收标准**
- [ ] 组合查询 SQL 数量从 N+1 减少到 2
- [ ] 性能测试验证提升

---

### Task 4.5: 更新 Dockerfile

**基本信息**
- **优先级**: P0
- **工期**: 1 天
- **依赖**: Phase 3 完成
- **标签**: `architecture`, `phase-4`, `deployment`

**详细描述**
重写 Dockerfile 适配多模块结构。

**具体步骤**
1. 修改 `koduck-backend/Dockerfile`：
   ```dockerfile
   # 先复制所有 pom.xml
   COPY pom.xml .
   COPY koduck-bom/pom.xml koduck-bom/
   COPY koduck-common/pom.xml koduck-common/
   # ... 复制所有模块的 pom.xml
   
   # 下载依赖（利用缓存层）
   RUN mvn dependency:go-offline -B
   
   # 复制源码
   COPY . .
   
   # 构建
   RUN mvn clean package -DskipTests -B
   ```
2. 优化构建层缓存
3. 测试镜像构建

**验收标准**
- [ ] `docker build` 成功
- [ ] 镜像大小合理（< 200MB）
- [ ] 启动正常

---

## 附录

### A. 任务依赖图

```
Phase 1:
  1.1 ─┬─ 1.6
  1.2 ─┤
  1.3 ─┤
  1.4 ─┤
  1.5 ─┘
  1.7 (依赖 1.1-1.5)
  1.8 (依赖 1.1)

Phase 2:
  2.1 ── 2.2 ─┬─ 2.8
              │
  2.3 ── 2.4 ─┤
       │      │
       └── 2.5 ┘
              │
  2.6 ────────┤
              │
  2.7 ────────┤
              │
  2.9 ────────┘

  2.10 (贯穿各模块)

Phase 3:
  3.1 ── 3.2 ─┬─ 3.3
              └─ 3.4

Phase 4:
  4.1 ── 4.2 ─┬─ 4.3
              ├─ 4.4
              └─ 4.5
```

### B. 风险任务标记

| 任务 | 风险等级 | 风险说明 |
|------|----------|----------|
| 2.2 | 高 | Market 模块核心，影响面广 |
| 2.4 | 高 | PortfolioServiceImpl 代码量大（424行） |
| 2.5 | 高 | AI 模块依赖关系复杂 |
| 3.2 | 高 | Core 瘦身可能影响现有功能 |
| 4.4 | 中 | 需要数据库查询优化经验 |

### C. 代码行数估算

| 模块 | 当前估算 | 目标 | 备注 |
|------|----------|------|------|
| koduck-core | ~15,000 | < 1,000 | 瘦身目标 |
| koduck-market-impl | 0 | ~2,000 | 新模块 |
| koduck-portfolio-impl | 0 | ~3,000 | 新模块（含拆分） |
| koduck-strategy-impl | 0 | ~2,500 | 新模块 |
| koduck-community-impl | 0 | ~1,500 | 新模块 |
| koduck-ai-impl | 0 | ~1,500 | 新模块（含拆分） |

---

> **维护说明**: 本任务清单应随实际执行更新进度和状态。
