# ADR-0126: Strategy 领域模块迁移

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #566

## 背景

作为 Core 模块迁移（Phase 2）的一部分，需要将 Strategy（策略）和 Backtest（回测）领域从 koduck-core 迁移到独立的模块。Strategy 领域依赖 Market 领域的数据（如行情数据、K线数据），需要通过 ACL 接口进行访问。

当前 koduck-core 包含了策略管理和回测执行的业务逻辑，代码量较大且与其他领域耦合。通过模块拆分，可以实现：
- 策略模块独立开发、测试、部署
- 清晰的领域边界
- 通过 ACL 控制跨模块依赖

## 决策

创建独立的 koduck-strategy 模块，包含 koduck-strategy-api 和 koduck-strategy-impl 两个子模块，遵循 API/Impl 分离的架构原则。

### 架构设计

```
koduck-strategy/
├── koduck-strategy-api/           # 接口与 DTO
│   ├── api/
│   │   ├── StrategyQueryService.java
│   │   ├── StrategyCommandService.java
│   │   ├── BacktestQueryService.java
│   │   └── BacktestCommandService.java
│   ├── acl/
│   │   └── StrategyQueryService.java    # 供 AI 模块使用
│   ├── dto/
│   │   ├── StrategyDto.java
│   │   ├── StrategySummaryDto.java
│   │   ├── BacktestRequestDto.java
│   │   ├── BacktestResultDto.java
│   │   └── BacktestSummaryDto.java
│   ├── vo/
│   │   ├── StrategySnapshot.java
│   │   └── BacktestResultSummary.java
│   ├── event/
│   │   ├── StrategyCreatedEvent.java
│   │   └── BacktestCompletedEvent.java
│   └── exception/
│       ├── StrategyException.java
│       └── BacktestException.java
└── koduck-strategy-impl/          # 实现
    ├── service/
    │   ├── StrategyServiceImpl.java
    │   └── BacktestServiceImpl.java
    ├── repository/
    │   ├── StrategyRepository.java
    │   └── BacktestRepository.java
    └── entity/
        ├── Strategy.java
        └── BacktestRecord.java
```

### 依赖关系

```
koduck-strategy-api
    ├── koduck-common (工具类、基础异常)
    ├── koduck-market-api (通过 ACL 获取行情数据)
    └── spring-context (领域事件)

koduck-strategy-impl
    ├── koduck-strategy-api
    ├── koduck-market-api (ACL 接口)
    ├── koduck-infrastructure (Repository 实现)
    └── koduck-common
```

### ACL 接口设计

Strategy 模块为 AI 模块提供 ACL 接口：

```java
public interface StrategyQueryService {
    // 获取用户的策略列表
    List<StrategySnapshot> getUserStrategies(Long userId);
    
    // 获取策略详情
    Optional<StrategySnapshot> getStrategy(Long strategyId);
    
    // 获取策略的回测结果摘要
    List<BacktestResultSummary> getStrategyBacktests(Long strategyId);
    
    // 获取回测详情
    Optional<BacktestResultSummary> getBacktestSummary(Long backtestId);
}
```

Strategy 模块通过 ACL 访问 Market 数据：

```java
public interface BacktestService {
    // 内部使用 MarketDataAcl 获取历史行情
    BacktestResult executeBacktest(BacktestRequest request);
}
```

## 权衡

### 替代方案

1. **保留在 koduck-core**: 不迁移 Strategy 领域
   - ❌ koduck-core 继续膨胀
   - ❌ 无法独立部署策略服务
   - ❌ 策略变更影响整个 Core 模块

2. **合并到 koduck-ai**: 将策略和 AI 合并
   - ❌ 策略和 AI 是不同的领域
   - ❌ 策略可以被社区、回测等模块使用
   - ❌ 职责不清晰

3. **创建独立服务**: 拆分为微服务
   - ✅ 完全独立部署
   - ❌ 当前阶段过度设计
   - ❌ 增加运维复杂度
   - ⏸️ 未来可考虑，当前使用模块化

### 选择当前方案的理由

1. **渐进式演进**: 从模块化开始，未来可演进为微服务
2. **清晰边界**: Strategy 领域独立，通过 ACL 与其他模块交互
3. **可测试性**: 独立模块易于单元测试和集成测试
4. **复用性**: 策略可以被 AI、Community 等模块使用

## 影响

### 兼容性影响

- **koduck-core**: 移除 Strategy 和 Backtest 相关代码
- **koduck-ai**: 后续通过 Strategy ACL 访问策略数据
- **koduck-bootstrap**: 添加 koduck-strategy-impl 依赖

### 数据模型

Strategy 领域包含以下核心实体：
- **Strategy**: 策略定义（名称、描述、参数、策略代码）
- **BacktestRecord**: 回测记录（策略ID、时间范围、结果指标）
- **BacktestTrade**: 回测交易记录（买入/卖出、价格、数量）

### 跨模块依赖

| 调用方 | 被调用方 | ACL 接口 | 用途 |
|--------|----------|----------|------|
| Strategy | Market | `MarketDataAcl` | 获取历史行情数据 |
| AI | Strategy | `StrategyQueryService` | 获取策略列表和回测结果 |
| Community | Strategy | `StrategyQueryService` | 显示信号关联的策略 |

## 实施计划

### Phase 1: 创建 koduck-strategy-api 模块
1. 创建模块目录结构
2. 创建 pom.xml（依赖 koduck-common, koduck-market-api）
3. 创建 Service 接口（StrategyQueryService, StrategyCommandService, BacktestQueryService, BacktestCommandService）
4. 创建 DTO（StrategyDto, BacktestRequestDto, BacktestResultDto 等）
5. 创建 ACL 接口（供 AI 模块使用）
6. 创建值对象（StrategySnapshot, BacktestResultSummary）
7. 创建领域事件和异常

### Phase 2: 创建 koduck-strategy-impl 模块
1. 创建模块目录结构
2. 创建 pom.xml（依赖 koduck-strategy-api, koduck-infrastructure）
3. 从 koduck-core 迁移 StrategyServiceImpl
4. 从 koduck-core 迁移 BacktestServiceImpl
5. 从 koduck-core 迁移 Entity 和 Repository
6. 实现 ACL 接口

### Phase 3: 质量检查
1. 编译检查
2. Checkstyle 检查
3. SpotBugs 检查
4. 单元测试覆盖率检查

### Phase 4: 更新依赖
1. 更新 koduck-bootstrap 依赖
2. 从 koduck-core 移除 Strategy 代码
3. 验证整体编译

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
- ADR-0121: Market 领域实现模块迁移
- ADR-0122: Portfolio 领域实现模块迁移
