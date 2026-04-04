# ADR-0095: 拆分 koduck-market 模块 (Phase 1) - 修订版

- Status: Accepted
- Date: 2026-04-04
- Issue: #487

## Context

根据 REALISTIC-MODULE-SPLIT-PLAN.md 和 ARCHITECTURE-EVALUATION.md 的评估，koduck-core 模块目前承载了所有业务逻辑，已成为一个"大泥球"：

- 318+ 个 Java 源文件
- 27+ Service 实现
- 15+ Controller
- 30+ Repository

其中，**行情数据 (Market) 领域**代码边界相对清晰，但深入分析后发现存在以下依赖关系：

1. **BacktestServiceImpl** → `KlineDataDto`, `KlineService`
2. **WatchlistServiceImpl** → `StockRealtime`, `StockRealtimeRepository`
3. **MonitoringServiceImpl** → `StockRealtime`, `DataSourceStatus`
4. **TechnicalIndicatorService** → `KlineDataDto`
5. **PortfolioServiceImpl** → `KlineService`

这些依赖表明，Market 领域的 Entity、Repository、DTO 被 koduck-core 中的多个其他领域共享。

## Decision

### 调整后的拆分策略

采用**渐进式拆分**：只迁移 Controller 和 Service 实现到 koduck-market，保留 Entity、Repository、DTO 在 koduck-core 作为共享基础设施。

### 模块内容

```
koduck-market/
├── controller/
│   ├── KlineController
│   ├── MarketController
│   ├── MarketAdvancedController
│   ├── TechnicalIndicatorController
│   ├── SentimentController
│   └── KlineAdminController
├── service/
│   ├── KlineServiceImpl
│   ├── MarketServiceImpl
│   ├── MarketBreadthServiceImpl
│   ├── MarketFlowServiceImpl
│   ├── MarketSectorNetFlowServiceImpl
│   ├── MarketSentimentServiceImpl
│   ├── TechnicalIndicatorServiceImpl
│   ├── StockCacheServiceImpl
│   ├── StockSubscriptionServiceImpl
│   ├── SyntheticTickServiceImpl
│   ├── TickStreamServiceImpl
│   ├── PricePushServiceImpl
│   └── KlineSyncServiceImpl
└── provider/
    ├── MarketDataProvider
    ├── ProviderFactory
    ├── AKShareDataProvider
    ├── USStockProvider
    ├── HKStockProvider
    ├── ForexProvider
    ├── FuturesProvider
    └── support/
```

### 保留在 koduck-core 的共享组件

```
koduck-core/
├── entity/market/
│   ├── KlineData
│   ├── StockBasic
│   ├── StockRealtime
│   ├── StockTickHistory
│   ├── MarketDailyBreadth
│   ├── MarketDailyNetFlow
│   ├── MarketSectorNetFlow
│   └── DataSourceStatus
├── repository/market/
│   ├── KlineDataRepository
│   ├── StockBasicRepository
│   ├── StockRealtimeRepository
│   ├── StockTickHistoryRepository
│   ├── MarketDailyBreadthRepository
│   ├── MarketDailyNetFlowRepository
│   ├── MarketSectorNetFlowRepository
│   └── DataSourceStatusRepository
├── dto/market/
│   ├── KlineDataDto
│   ├── PriceQuoteDto
│   ├── MarketIndexDto
│   └── ... (所有 market DTO)
├── mapper/
│   ├── KlineDataDtoMapper
│   └── MarketDataMapper
├── messaging/
│   └── PricePushRabbitListener
└── market/
    ├── MarketType
    ├── model/
    ├── config/
    ├── provider/ (接口)
    └── util/
```

### 依赖关系

```
koduck-bootstrap
    ├── koduck-market → koduck-core (使用共享 Entity/DTO/Repository)
    └── koduck-core (包含所有共享基础设施)
        ├── koduck-auth
        └── koduck-common
```

## Consequences

### 正向影响

1. **编译效率提升**: 修改 Market Controller/Service 实现无需重新编译整个 koduck-core
2. **职责分离**: Market 业务逻辑与基础设施分离
3. **团队并行**: 不同团队可独立开发 koduck-market 的 Controller 和 Service
4. **为未来完全拆分奠定基础**: 当其他领域不再直接依赖 Market Entity 时，可进一步拆分

### 代价与影响

1. **Entity/Repository 仍在 koduck-core**: 未达到完全模块隔离
2. **双向感知**: koduck-market 依赖 koduck-core 的基础设施
3. **部分代码仍在 koduck-core**: 需要后续 Phase 继续迁移

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 路径、请求/响应格式保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 部署兼容 | ✅ 无变化 | 最终产出仍为单个可执行 JAR |

## Alternatives Considered

### 1. 完全拆分（包括 Entity/Repository/DTO）
- **拒绝**: 需要修改大量 koduck-core 中的代码（BacktestServiceImpl、WatchlistServiceImpl 等）
- **当前方案**: 先拆分 Controller/Service，保留共享基础设施

### 2. 保持现状，不拆分
- **拒绝**: 无法解决 koduck-core 单体过重问题
- **当前方案**: 通过渐进式拆分降低风险

### 3. 引入防腐层 (ACL) 解耦
- **暂不采用**: 当前阶段过于复杂，会增加不必要的抽象层
- **未来演进**: 若需要完全独立部署，可引入 ACL

## Implementation

### Phase 1: 创建 koduck-market 模块
1. 更新 koduck-market/pom.xml
2. 创建目录结构

### Phase 2: 迁移 Controller
1. 迁移所有 Market 相关 Controller
2. 保持 package 结构不变

### Phase 3: 迁移 Service 实现
1. 迁移所有 Market 相关 ServiceImpl
2. 保持 Service 接口在 koduck-core

### Phase 4: 迁移 Provider
1. 迁移 MarketDataProvider 及其实现
2. 迁移相关 support 类

### Phase 5: 验证
1. mvn clean compile 编译通过
2. ./scripts/quality-check.sh 全绿
3. mvn checkstyle:check 无异常

## Future Work

### Phase 2（未来）
- 将 Market Entity/Repository/DTO 迁移到 koduck-market
- 在 koduck-core 中引入防腐层接口
- 其他领域通过防腐层访问 Market 数据

### Phase 3（未来）
- koduck-market 可独立部署
- 通过 HTTP API 或消息队列与其他模块通信

## Verification

- [ ] koduck-market 模块创建完成
- [ ] Controller 迁移完成
- [ ] Service 实现迁移完成
- [ ] Provider 迁移完成
- [ ] mvn clean compile 编译通过
- [ ] ./scripts/quality-check.sh 全绿
- [ ] mvn checkstyle:check 无异常
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过

## References

- REALISTIC-MODULE-SPLIT-PLAN.md
- ADR-0082: Maven 多模块重构
- ADR-0093: 重新评估业务模块拆分策略
- ADR-0055: 按业务域拆分 koduck-core 模块
- ARCHITECTURE-EVALUATION.md
- Issue: #487
