# Koduck-Core 现实可拆分方案

> **文档状态**: 草案  
> **创建日期**: 2026-04-04  
> **背景**: 解决 ADR-0082 与 ADR-0093 之间的冲突

## 问题分析

### 当前状况

根据 ARCHITECTURE-EVALUATION.md 和 ADR-0093 的分析，`koduck-core` 目前是一个"大泥球"：

- 318+ 个 Java 源文件
- 27+ Service 实现
- 15+ Controller
- 30+ Repository
- 32+ Entity
- 99+ DTO

### ADR-0093 指出的拆分障碍

| 障碍类型 | 具体问题 | 影响范围 |
|---------|---------|---------|
| **深度耦合的 Support 类** | `AiConversationSupport` → `MemoryService`, `TechnicalIndicatorService` | AI 模块无法独立 |
| **工具类依赖实体** | `EntityCopyUtils` → `User`, `CommunitySignal`, `SignalComment` | 工具类无法迁移 |
| **Service 间交叉依赖** | `PortfolioService` → `KlineService` | Portfolio 模块依赖 Market 模块 |
| **跨领域 Repository 引用** | `BacktestService` → `StrategyRepository` | Backtest 模块依赖 Strategy 模块 |

### 与 koduck-auth 成功拆分的对比

`koduck-auth` 能成功拆分的原因是：
1. ✅ 无外部业务依赖（纯基础模块）
2. ✅ 无复杂 support 类
3. ✅ 工具类（`JwtUtil`）独立，不依赖业务实体
4. ✅ 纯认证逻辑，不依赖 Email、RateLimiter 等外部服务

## 现实可拆分方案

### 核心思路

**不是"拆分 koduck-core"，而是"从 koduck-core 中剥离可独立模块"**

采用**洋葱模型**，保留 koduck-core 作为"内核"，将外围可独立业务逐步迁出。

### 模块依赖架构（调整后）

```
koduck-bootstrap (启动入口)
    ├── koduck-ai (可选，可独立部署)
    ├── koduck-market (核心业务，但可独立演进)
    ├── koduck-portfolio (依赖 market)
    ├── koduck-strategy (依赖 market)
    ├── koduck-community (依赖 user)
    └── koduck-core (内核)
        ├── koduck-auth (已拆分)
        └── koduck-common (已拆分)
```

### 可拆分模块分析

#### 1. koduck-market (行情数据) - ✅ 高可行性

**为什么可以拆分：**
- Market 领域是**被依赖方**，不依赖其他业务域（除了基础工具）
- `KlineService` 是核心服务，被 Portfolio、Backtest、TechnicalIndicator 依赖
- 拆分后其他模块通过接口依赖，符合依赖倒置原则

**包含内容：**
```
koduck-market/
├── controller/
│   ├── KlineController
│   ├── MarketController
│   ├── MarketAdvancedController
│   ├── TechnicalIndicatorController
│   └── SentimentController
├── service/
│   ├── KlineService (接口保留在 core，实现迁移)
│   ├── MarketService
│   ├── MarketBreadthService
│   ├── MarketFlowService
│   ├── MarketSectorNetFlowService
│   ├── MarketSentimentService
│   ├── TechnicalIndicatorService
│   ├── StockCacheService
│   ├── StockSubscriptionService
│   ├── SyntheticTickService
│   ├── TickStreamService
│   ├── PricePushService
│   └── KlineSyncService
├── repository/
│   ├── KlineDataRepository
│   ├── StockBasicRepository
│   ├── StockRealtimeRepository
│   ├── StockTickHistoryRepository
│   ├── MarketDailyBreadthRepository
│   ├── MarketDailyNetFlowRepository
│   └── MarketSectorNetFlowRepository
├── entity/
│   ├── KlineData
│   ├── StockBasic
│   ├── StockRealtime
│   ├── StockTickHistory
│   ├── MarketDailyBreadth
│   ├── MarketDailyNetFlow
│   └── MarketSectorNetFlow
├── dto/market/
│   └── (所有 market 相关 DTO)
└── provider/ (市场数据提供者)
    ├── MarketDataProvider
    ├── ProviderFactory
    ├── AKShareDataProvider
    ├── USStockProvider
    ├── HKStockProvider
    ├── ForexProvider
    ├── FuturesProvider
    └── support/
```

**依赖关系：**
- 依赖：`koduck-common`, `koduck-auth` (User 信息)
- 被依赖：通过 `KlineService` 接口

**迁移步骤：**
1. 在 `koduck-core` 中保留 `KlineService` 接口
2. 创建 `koduck-market` 模块，实现 `KlineService`
3. 其他模块通过接口使用 `KlineService`，无需改动
4. 逐步迁移其他 market 相关服务

#### 2. koduck-ai (AI 分析) - ⚠️ 中等可行性

**拆分难点：**
- `AiAnalysisServiceImpl` 依赖 `BacktestResultRepository`, `PortfolioPositionRepository`, `StrategyRepository`
- `AiConversationSupport` 依赖 `MemoryService`, `TechnicalIndicatorService`

**解决方案：引入防腐层 (ACL)**

```
koduck-ai/
├── controller/
│   └── AiAnalysisController
├── service/
│   ├── AiAnalysisService (接口)
│   ├── AiAnalysisServiceImpl
│   ├── MemoryService (接口)
│   └── MemoryServiceImpl
├── acl/ (防腐层)
│   ├── BacktestQueryService (接口，由 koduck-core 实现)
│   ├── PortfolioQueryService (接口，由 koduck-core 实现)
│   ├── StrategyQueryService (接口，由 koduck-core 实现)
│   └── MarketDataQueryService (接口，由 koduck-market 实现)
├── entity/ai/
│   ├── MemoryChatMessage
│   └── MemoryChatSession
├── repository/ai/
│   ├── MemoryChatMessageRepository
│   └── MemoryChatSessionRepository
└── dto/ai/
    └── (所有 ai 相关 DTO)
```

**防腐层接口示例：**
```java
// 在 koduck-ai 中定义接口
public interface BacktestQueryService {
    Optional<BacktestResultSummary> findResultById(Long id);
}

// 在 koduck-core 中实现
@Service
public class BacktestQueryServiceImpl implements BacktestQueryService {
    private final BacktestResultRepository repository;
    // ... 实现
}
```

**迁移步骤：**
1. 定义防腐层接口（在 koduck-ai 中）
2. 在 koduck-core 中实现防腐层
3. 创建 koduck-ai 模块，迁移 AI 相关代码
4. 通过 Spring 依赖注入连接防腐层

#### 3. koduck-strategy (策略管理) - ✅ 高可行性

**为什么可以拆分：**
- Strategy 领域相对独立
- 被 Backtest 依赖，但可以通过接口解耦
- 不依赖其他业务域（除基础工具）

**包含内容：**
```
koduck-strategy/
├── controller/
│   └── StrategyController
├── service/
│   ├── StrategyService
│   └── AlertRuleService
├── entity/strategy/
│   ├── Strategy
│   ├── StrategyVersion
│   ├── StrategyParameter
│   ├── AlertRule
│   └── AlertHistory
├── repository/strategy/
│   ├── StrategyRepository
│   ├── StrategyVersionRepository
│   ├── StrategyParameterRepository
│   ├── AlertRuleRepository
│   └── AlertHistoryRepository
└── dto/strategy/
    └── (所有 strategy 相关 DTO)
```

**依赖关系：**
- 依赖：`koduck-common`, `koduck-auth`
- 被依赖：通过 `StrategyService` 接口

#### 4. koduck-portfolio (投资组合) - ⚠️ 低可行性（暂缓）

**拆分难点：**
- `PortfolioService` 直接依赖 `KlineService`
- `PortfolioService` 依赖 `TradeRepository`（backtest 领域）

**建议：** 暂不拆分，待 koduck-market 拆分完成后再评估

#### 5. koduck-community (社区信号) - ⚠️ 低可行性（暂缓）

**拆分难点：**
- `CommunitySignalService` 依赖 `UserRepository`（已拆分至 koduck-auth，但需通过接口）
- `CommunitySignalService` 依赖 `UserSignalStatsRepository`

**建议：** 暂不拆分，保持现状

### koduck-core 保留内容（内核）

拆分后，`koduck-core` 作为内核模块保留：

```
koduck-core/
├── config/ (除迁移模块外的配置)
├── controller/
│   ├── HealthController
│   ├── MonitoringController
│   ├── SettingsController
│   └── WebSocketEventController
├── service/
│   ├── UserService (用户管理)
│   ├── UserSettingsService
│   ├── EmailService
│   ├── RateLimiterService
│   ├── UserCacheService
│   ├── MonitoringService
│   ├── WatchlistService
│   ├── CredentialService
│   └── AuthService (部分保留)
├── service/support/ (跨域 support 类)
│   ├── AiConversationSupport (待重构)
│   ├── AiRecommendationSupport (待重构)
│   ├── AiStreamRelaySupport (待重构)
│   ├── BacktestExecutionContext
│   ├── BacktestSignal
│   ├── CommunitySignalResponseAssembler
│   ├── DefaultUserRoleResolver
│   ├── MarketFallbackSupport
│   ├── StrategyAccessSupport
│   └── UserRolesTableChecker
├── acl/impl/ (防腐层实现)
│   ├── BacktestQueryServiceImpl
│   ├── PortfolioQueryServiceImpl
│   └── StrategyQueryServiceImpl
├── entity/
│   ├── user/
│   │   ├── UserSettings
│   │   └── UserMemoryProfile
│   ├── credential/
│   │   └── CredentialAuditLog
│   └── watchlist/
│       └── WatchlistItem
├── repository/
│   ├── user/
│   ├── credential/
│   └── watchlist/
├── dto/
│   ├── settings/
│   ├── credential/
│   ├── user/
│   ├── profile/
│   └── watchlist/
├── util/
│   ├── EntityCopyUtils (保留，依赖 auth 和 community 实体)
│   ├── CredentialEncryptionUtil
│   └── JwtUtil (考虑迁移到 auth)
└── exception/ (保留)
```

## 实施路线图

### Phase 1: 准备阶段（1-2 周）

1. **定义防腐层接口**
   - 创建 `com.koduck.acl` 包
   - 定义 `BacktestQueryService`, `PortfolioQueryService`, `StrategyQueryService`

2. **提取 Service 接口**
   - 确保 `KlineService`, `StrategyService` 等接口在 koduck-core 中定义
   - 实现类标记为 `@Primary` 或 `@Qualifier`

3. **添加 ArchUnit 测试**
   - 禁止跨领域直接依赖 Repository
   - 强制通过 Service 接口访问

### Phase 2: 拆分 koduck-market（2-3 周）

1. 创建 `koduck-market` 模块
2. 迁移 Market 相关代码
3. 在 koduck-core 中保留 `KlineService` 接口作为防腐层
4. koduck-market 实现 `KlineService`
5. 验证所有测试通过

### Phase 3: 拆分 koduck-strategy（1-2 周）

1. 创建 `koduck-strategy` 模块
2. 迁移 Strategy 相关代码
3. 在 koduck-core 中实现 `StrategyQueryService` 防腐层
4. 验证 Backtest 通过防腐层访问 Strategy

### Phase 4: 拆分 koduck-ai（2-3 周）

1. 创建 `koduck-ai` 模块
2. 定义防腐层接口
3. 在 koduck-core 中实现防腐层
4. 迁移 AI 相关代码
5. 验证功能完整

### Phase 5: 清理与优化（1 周）

1. 清理 koduck-core 中已迁移的代码
2. 更新文档
3. 优化模块间依赖

## 收益与风险

### 预期收益

| 维度 | 收益 |
|------|------|
| **编译效率** | 修改 Market 代码无需编译整个 koduck-core |
| **变更隔离** | Market 领域变更不影响其他领域 |
| **团队并行** | 不同团队可独立开发各自模块 |
| **独立演进** | 各模块可独立版本发布 |
| **可选部署** | koduck-ai 可独立部署/扩容 |

### 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 防腐层增加复杂度 | 保持接口简单，仅暴露必要方法 |
| 循环依赖 | 通过 ArchUnit 测试强制约束 |
| 性能损耗 | 防腐层为本地方法调用，无网络开销 |
| 过度工程 | 按路线图分阶段实施，随时可暂停 |

## 与 ADR-0093 的协调

本方案**不否定 ADR-0093**，而是在其基础上提供渐进式改进路径：

- ADR-0093 建议：**暂停进一步拆分**，改为包结构强化
- 本方案建议：**选择性地拆分低耦合模块**，保留 koduck-core 作为内核

两者不冲突，可以：
1. 先实施 ADR-0093 的包结构强化和 ArchUnit 测试
2. 再按本方案逐步拆分 koduck-market 等模块
3. 对高耦合模块（portfolio, community）保持现状

## 决策建议

建议接受本方案，原因：

1. **风险可控**：分阶段实施，每阶段可独立验证
2. **收益明确**：koduck-market 拆分收益最大，可行性最高
3. **符合 DDD**：通过防腐层实现 bounded context 隔离
4. **保留灵活性**：高耦合模块暂不拆分，避免过度工程

## 参考文档

- ADR-0082: Maven 多模块重构
- ADR-0093: 重新评估业务模块拆分策略
- ADR-0055: 按业务域拆分 koduck-core 模块
- ADR-0021: 引入 DDD 领域划分与模块边界治理
- ARCHITECTURE-EVALUATION.md
