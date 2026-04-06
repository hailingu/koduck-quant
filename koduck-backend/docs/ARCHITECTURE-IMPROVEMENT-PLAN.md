# Koduck Backend 架构改进计划

> **版本**: 1.0.0  
> **日期**: 2026-04-05  
> **状态**: 规划中  
> **关联文档**: [ARCHITECTURE-EVALUATION.md](./ARCHITECTURE-EVALUATION.md)

---

## 一、改进目标

### 1.1 核心目标

| 目标 | 描述 | 验收标准 |
|------|------|----------|
| **消除上帝模块** | 将 `koduck-core` 拆分为独立的领域模块 | `koduck-core` 不再包含业务逻辑，仅保留跨领域协调 |
| **建立清晰依赖层级** | 实现严格的分层架构 | 通过 ArchUnit 测试验证依赖方向 |
| **模块独立可测试** | 每个领域模块可独立编译、测试、运行 | 各模块拥有独立的单元测试和集成测试套件 |
| **防腐层全覆盖** | 所有跨模块调用通过 ACL 接口 | 无直接 Repository/Service 跨模块依赖 |

### 1.2 目标架构（DDD 分层风格）

```
koduck-bootstrap (启动/配置)
    ├── koduck-application (用例编排，可选)
    │       └── 依赖: koduck-market-api, koduck-portfolio-api, ...
    │
    ├── koduck-market (领域实现)
    │       ├── koduck-market-api (接口/DTO) ← 被其他模块依赖
    │       └── koduck-market-impl (实现)
    │
    ├── koduck-portfolio (领域实现)
    │       ├── koduck-portfolio-api
    │       └── koduck-portfolio-impl
    │
    ├── koduck-strategy (领域实现)
    │       ├── koduck-strategy-api
    │       └── koduck-strategy-impl
    │
    ├── koduck-community (领域实现)
    │       ├── koduck-community-api
    │       └── koduck-community-impl
    │
    ├── koduck-ai (领域实现)
    │       ├── koduck-ai-api
    │       └── koduck-ai-impl
    │
    ├── koduck-auth (认证/授权)
    │       └── koduck-auth-api (被所有模块依赖)
    │
    ├── koduck-infrastructure (技术实现)
    │       └── 实现各 api 模块定义的 Repository/Cache/MQ 接口
    │
    └── koduck-common (共享工具)
            └── 被所有模块依赖（无业务逻辑）
```

**依赖规则**:
1. `*-api` 模块只包含接口、DTO、异常，**不依赖任何其他模块**
2. `*-impl` 模块实现 `*-api` 接口，**可依赖其他 `*-api` 模块**
3. `koduck-infrastructure` 实现技术细节，**依赖所有 `*-api` 模块**
4. `koduck-common` 被所有模块依赖，**不包含业务逻辑**
5. **禁止** `*-impl` 模块之间的直接依赖

---

## 二、改进路线图

### Phase 1: 基础设施准备（2 周）

#### Week 1-2: 建立 API 模块和依赖治理

| 任务 | 负责人 | 输出物 | 验收标准 |
|------|--------|--------|----------|
| 1.1 创建 `koduck-market-api` | TBD | 新模块 | 包含 Market 领域所有接口和 DTO |
| 1.2 创建 `koduck-portfolio-api` | TBD | 新模块 | 包含 Portfolio 领域所有接口和 DTO |
| 1.3 创建 `koduck-strategy-api` | TBD | 新模块 | 包含 Strategy 领域所有接口和 DTO |
| 1.4 创建 `koduck-community-api` | TBD | 新模块 | 包含 Community 领域所有接口和 DTO |
| 1.5 创建 `koduck-ai-api` | TBD | 新模块 | 包含 AI 领域所有接口和 DTO |
| 1.6 引入 ArchUnit 测试 | TBD | 测试代码 | 编写包依赖规则和分层规则测试 |
| 1.7 更新父 POM 依赖管理 | TBD | pom.xml | 统一声明所有 `*-api` 模块依赖 |

**关键决策**:
- 是否保留 `koduck-core` 作为协调层？→ **建议保留但瘦身**，仅保留跨领域事务协调
- API 模块粒度？→ **按领域边界划分**，与现有模块一一对应

---

### Phase 2: 逐步迁移 Core 模块（4 周）

#### Week 3-4: Market 领域迁移

| 任务 | 详细步骤 | 风险 |
|------|----------|------|
| 2.1 提取 Market 接口 | 将 `MarketService` 等接口移至 `koduck-market-api` | 确保向后兼容 |
| 2.2 迁移 Market 实现 | 将 `MarketServiceImpl` 移至 `koduck-market-impl` | 测试覆盖 |
| 2.3 更新依赖关系 | `koduck-core` 改为依赖 `koduck-market-api` | 循环依赖检查 |
| 2.4 迁移 Market 相关 Entity/Repository | 移至 `koduck-market-impl` | 数据库迁移脚本 |
| 2.5 补充 Market 模块测试 | 独立的单元测试和集成测试 | - |

#### Week 5-6: Portfolio 领域迁移

| 任务 | 详细步骤 | 依赖 |
|------|----------|------|
| 3.1 提取 Portfolio 接口 | 移至 `koduck-portfolio-api` | 依赖 2.x 完成 |
| 3.2 迁移 Portfolio 实现 | 移至 `koduck-portfolio-impl` | - |
| 3.3 建立 Portfolio ACL | 为 AI 模块提供 `PortfolioQueryService` 接口 | - |
| 3.4 更新 AI 模块依赖 | 改为依赖 `koduck-portfolio-api` | - |
| 3.5 补充 Portfolio 模块测试 | 独立测试套件 | - |

#### Week 7-8: Strategy & Community 领域迁移

| 任务 | 详细步骤 | 备注 |
|------|----------|------|
| 4.1 Strategy 领域迁移 | 类似 Portfolio 流程 | 回测引擎核心逻辑 |
| 4.2 Community 领域迁移 | 类似 Portfolio 流程 | 信号系统 |
| 4.3 建立跨领域 ACL | `BacktestQueryService`, `StrategyQueryService` 等 | 供 AI 模块使用 |
| 4.4 更新 AI 模块 | 改为依赖各 `*-api` 模块 | - |

---

### Phase 3: 基础设施和 Core 瘦身（2 周）

#### Week 9-10: 重构 Infrastructure 和 Core

| 任务 | 详细步骤 | 输出物 |
|------|----------|--------|
| 5.1 重构 `koduck-infrastructure` | 实现各 `*-api` 定义的 Repository/Cache 接口 | 技术适配器 |
| 5.2 瘦身 `koduck-core` | 移除所有业务逻辑，仅保留跨领域协调 | 协调服务 |
| 5.3 建立领域事件机制 | 引入 Spring Events 或外部 MQ 解耦 | 事件总线 |
| 5.4 统一配置管理 | 各模块独立配置，bootstrap 仅做组装 | 配置文件 |

---

### Phase 4: 质量加固和优化（2 周）

#### Week 11-12: 测试和性能优化

| 任务 | 详细步骤 | 验收标准 |
|------|----------|----------|
| 6.1 ArchUnit 架构守护 | 编写全面的包依赖规则测试 | CI 拦截违规依赖 |
| 6.2 补充模块独立测试 | 各模块单元测试覆盖率 ≥ 60% | JaCoCo 报告 |
| 6.3 性能基准测试 | JMH 测试关键路径 | 基线报告 |
| 6.4 解决 N+1 查询 | `PortfolioPriceService` 批量查询接口 | 性能提升 |
| 6.5 优化 Dockerfile | 多阶段构建适配多模块 | 镜像构建成功 |

---

## 三、详细技术方案

### 3.1 API 模块设计规范

#### 模块结构

```
koduck-market-api/
├── pom.xml
└── src/main/java/com/koduck/market/
    ├── api/                          # 服务接口
    │   ├── MarketQueryService.java
    │   ├── MarketCommandService.java
    │   └── MarketDataProvider.java
    ├── dto/                          # 数据传输对象
    │   ├── MarketDataDto.java
    │   ├── KlineDto.java
    │   └── IndicatorDto.java
    ├── event/                        # 领域事件
    │   └── MarketDataUpdatedEvent.java
    ├── exception/                    # 领域异常
    │   └── MarketDataException.java
    └── acl/                          # 防腐层接口（供其他模块使用）
        └── MarketDataAcl.java
```

#### 编码规范

1. **接口命名**: `XxxQueryService`（查询）、`XxxCommandService`（命令）
2. **DTO 不可变**: 使用 Java Record 或 Lombok `@Value`
3. **异常层次**: 继承 `KoduckException`（定义在 `koduck-common`）
4. **无 Spring 依赖**: API 模块尽量不依赖 Spring，便于复用

### 3.2 依赖治理方案

#### 当前问题依赖

```
koduck-core
    ├── koduck-auth           ✓ 正常
    ├── koduck-portfolio      ✗ 领域模块间依赖（违规）
    └── koduck-infrastructure  ✓ 正常

koduck-market
    └── koduck-core           ✗ 反向依赖（违规）
```

#### 目标依赖

```
koduck-bootstrap
    ├── koduck-market-impl
    │       └── koduck-market-api
    ├── koduck-portfolio-impl
    │       └── koduck-portfolio-api
    ├── koduck-core (瘦身版)
    │       ├── koduck-market-api      ✓ 仅依赖 API
    │       ├── koduck-portfolio-api   ✓ 仅依赖 API
    │       └── koduck-infrastructure
    └── koduck-infrastructure
            └── 实现所有 Repository/Cache 接口
```

### 3.3 防腐层（ACL）设计

#### 当前实现（AI 模块）

```java
// koduck-ai 模块通过 ACL 访问 Portfolio
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl {
    private final PortfolioQueryService portfolioQueryService; // ACL 接口
    
    public AnalysisResult analyze(Long portfolioId) {
        PortfolioSnapshot snapshot = portfolioQueryService.getSnapshot(portfolioId);
        // ... 分析逻辑
    }
}
```

#### 扩展 ACL 到所有跨模块调用

| 调用方 | 被调用方 | ACL 接口 | 数据载体 |
|--------|----------|----------|----------|
| AI | Portfolio | `PortfolioQueryService` | `PortfolioSnapshot` (Record) |
| AI | Strategy | `StrategyQueryService` | `StrategySnapshot` (Record) |
| AI | Backtest | `BacktestQueryService` | `BacktestResultSummary` (Record) |
| Community | Portfolio | `PortfolioQueryService` | `PortfolioBasicInfo` (Record) |
| Strategy | Market | `MarketDataAcl` | `MarketDataDto` (Record) |

### 3.4 ArchUnit 架构守护规则

```java
@ArchTest
static final ArchRule api_modules_should_not_depend_on_anything =
    noClasses()
        .that()
        .resideInAPackage("..api..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage("..impl..", "..infrastructure..");

@ArchTest
static final ArchRule domain_modules_should_not_depend_on_each_other =
    noClasses()
        .that()
        .resideInAPackage("com.koduck.market..")
        .should()
        .dependOnClassesThat()
        .resideInAPackage("com.koduck.portfolio..");

@ArchTest
static final ArchRule infrastructure_should_implement_api_interfaces =
    classes()
        .that()
        .resideInAPackage("..infrastructure..")
        .and()
        .haveNameMatching(".*RepositoryImpl")
        .should()
        .implement(resideInAPackage("..api.."));
```

---

## 四、风险评估与应对

### 4.1 高风险项

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 循环依赖难以解开 | 迁移停滞 | 中 | 引入临时适配层，逐步替换 |
| 数据库迁移复杂 | 数据丢失 | 低 | Flyway 脚本 + 备份 + 回滚方案 |
| 测试覆盖率下降 | 质量风险 | 中 | 每阶段强制补充测试 |
| 团队理解成本 | 进度延迟 | 中 | ADR 文档 + 代码评审 |

### 4.2 回滚策略

每个 Phase 完成后：
1. 创建 Git Tag（`v0.1.0-phase1`, `v0.1.0-phase2`...）
2. 保留原始模块作为 `koduck-core-legacy`（临时）
3. 使用 Feature Flag 控制新/旧实现切换

---

## 五、成功指标

### 5.1 量化指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|----------|
| koduck-core 代码行数 | ~15,000 | < 1,000 | `cloc` |
| 模块间循环依赖数 | 3+ | 0 | ArchUnit |
| 独立可测试模块比例 | 20% | 100% | 模块计数 |
| 跨模块直接依赖数 | 10+ | 0 | 依赖分析 |
| 平均模块代码行数 | ~5,000 | ~2,000 | `cloc` |

### 5.2 质量指标

| 指标 | 目标 | 检查方式 |
|------|------|----------|
| 各模块单元测试覆盖率 | ≥ 60% | JaCoCo |
| ArchUnit 测试通过率 | 100% | CI |
| 构建时间增幅 | < 20% | CI 计时 |
| 启动时间增幅 | < 10% | 手动测试 |

---

## 六、任务清单

### Phase 1: 基础设施准备

- [x] 1.1 创建 `koduck-market-api` 模块
- [x] 1.2 创建 `koduck-portfolio-api` 模块
- [x] 1.3 创建 `koduck-strategy-api` 模块
- [x] 1.4 创建 `koduck-community-api` 模块
- [x] 1.5 创建 `koduck-ai-api` 模块
- [x] 1.6 引入 ArchUnit 依赖和基础规则
- [x] 1.7 更新父 POM 依赖管理
- [x] 1.8 编写 API 模块编码规范文档

### Phase 2: Core 模块迁移

- [x] 2.1 Market 领域接口提取
- [x] 2.2 Market 领域实现迁移
- [x] 2.3 Portfolio 领域接口提取
- [x] 2.4 Portfolio 领域实现迁移
- [x] 2.5 Strategy 领域接口提取
- [x] 2.6 Strategy 领域实现迁移
- [x] 2.7 Community 领域接口提取
- [x] 2.8 Community 领域实现迁移
- [x] 2.9 AI 领域接口提取
- [x] 2.10 AI 领域实现迁移

### Phase 3: 基础设施重构

- [x] 3.1 重构 `koduck-infrastructure` 实现层
- [x] 3.2 瘦身 `koduck-core`
- [x] 3.3 建立领域事件机制
- [x] 3.4 统一配置管理

### Phase 4: 质量加固

- [x] 4.1 完善 ArchUnit 架构守护测试
- [x] 4.2 补充各模块独立测试
- [x] 4.3 建立性能基准测试
- [x] 4.4 优化 N+1 查询问题
- [x] 4.5 更新 Dockerfile

---

## 七、附录

### A. 参考文档

- [ARCHITECTURE-EVALUATION.md](./ARCHITECTURE-EVALUATION.md) - 架构评估报告
- [DDD 分层架构](https://ddd-practitioners.com/layered-architecture) - 领域驱动设计参考
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) - 架构测试工具

### B. 术语表

| 术语 | 说明 |
|------|------|
| ACL | Anti-Corruption Layer，防腐层，用于隔离不同领域模型 |
| API 模块 | 仅包含接口和 DTO 的 Maven 模块，作为模块契约 |
| Impl 模块 | 实现 API 模块定义接口的 Maven 模块 |
| ArchUnit | Java 架构测试框架，用于验证依赖规则 |
| DDD | Domain-Driven Design，领域驱动设计 |

---

> **下一步行动**: 召开技术评审会议，确认本计划后创建对应的 GitHub Issues 和里程碑。
