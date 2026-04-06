# ADR-0062: Controller/Repository/Entity 按业务子包分组重构

- Status: Accepted
- Date: 2026-04-04
- Issue: #418

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的模块化评估，当前项目存在架构不一致问题：

| 层级 | 当前结构 | DTO 结构 | 一致性 |
|------|----------|----------|--------|
| **DTO** | 按业务分组（ai/auth/backtest/community/market...） | - | ✅ 良好 |
| **Service** | 按业务分组（impl/ai/auth/backtest...） | - | ✅ 良好 |
| **Controller** | 扁平结构（20 个文件在同一目录） | 不一致 | ❌ |
| **Repository** | 扁平结构（39 个文件在同一目录） | 不一致 | ❌ |
| **Entity** | 扁平结构（40 个文件在同一目录） | 不一致 | ❌ |

这种不一致导致：
1. **导航困难**：查找与市场数据相关的类需要翻找数十个文件
2. **边界模糊**：难以识别业务模块边界
3. **维护成本高**：新增功能时不知道文件应该放在哪里
4. **与 DDD 方向不符**：未来若引入 DDD，需要清晰的模块边界

## Decision

### 目标结构

将 Controller、Repository、Entity 按照与 DTO 相同的业务边界进行分组：

```
com.koduck/
├── controller/
│   ├── ai/
│   │   └── AiAnalysisController.java
│   ├── auth/
│   │   └── AuthController.java
│   ├── backtest/
│   │   └── BacktestController.java
│   ├── community/
│   │   └── CommunitySignalController.java
│   ├── credential/
│   │   └── CredentialController.java
│   ├── market/
│   │   ├── MarketController.java
│   │   ├── MarketAdvancedController.java
│   │   ├── KlineController.java
│   │   └── SentimentController.java
│   ├── portfolio/
│   │   └── PortfolioController.java
│   ├── strategy/
│   │   └── StrategyController.java
│   ├── user/
│   │   └── UserController.java
│   ├── watchlist/
│   │   └── WatchlistController.java
│   ├── admin/
│   │   └── AdminController.java
│   ├── support/
│   │   └── ...
│   ├── HealthController.java
│   ├── MonitoringController.java
│   ├── SettingsController.java
│   ├── TechnicalIndicatorController.java
│   └── WebSocketEventController.java
├── repository/
│   ├── ai/
│   ├── auth/
│   ├── backtest/
│   ├── community/
│   ├── credential/
│   ├── market/
│   ├── portfolio/
│   ├── strategy/
│   ├── user/
│   └── watchlist/
└── entity/
    ├── ai/
    ├── auth/
    ├── backtest/
    ├── community/
    ├── credential/
    ├── market/
    ├── portfolio/
    ├── strategy/
    ├── user/
    └── watchlist/
```

### 文件分组映射

| 业务域 | Controller | Repository | Entity |
|--------|------------|------------|--------|
| **AI** | AiAnalysisController | MemoryChatMessageRepository, MemoryChatSessionRepository | MemoryChatMessage, MemoryChatSession |
| **Auth** | AuthController | LoginAttemptRepository, PasswordResetTokenRepository, PermissionRepository, RefreshTokenRepository, RoleRepository | LoginAttempt, PasswordResetToken, Permission, RefreshToken, Role |
| **Backtest** | BacktestController | BacktestResultRepository, BacktestTradeRepository | BacktestResult, BacktestTrade, BaseTrade |
| **Community** | CommunitySignalController | CommunitySignalRepository, SignalCommentRepository, SignalFavoriteRepository, SignalLikeRepository, SignalSubscriptionRepository | CommunitySignal, SignalComment, SignalFavorite, SignalLike, SignalSubscription |
| **Credential** | CredentialController | CredentialRepository, CredentialAuditLogRepository | Credential, CredentialAuditLog |
| **Market** | MarketController, MarketAdvancedController, KlineController, SentimentController | KlineDataRepository, MarketDailyBreadthRepository, MarketDailyNetFlowRepository, MarketSectorNetFlowRepository, StockBasicRepository, StockRealtimeRepository, StockTickHistoryRepository, DataSourceStatusRepository | KlineData, MarketDailyBreadth, MarketDailyNetFlow, MarketSectorNetFlow, StockBasic, StockRealtime, StockTickHistory, DataSourceStatus |
| **Portfolio** | PortfolioController | PortfolioPositionRepository | PortfolioPosition |
| **Strategy** | StrategyController | AlertHistoryRepository, AlertRuleRepository | AlertHistory, AlertRule |
| **User** | UserController | (使用 Auth 的 Repository) | (使用 Auth 的 Entity) |
| **Watchlist** | WatchlistController | (相关实体在 Market) | (相关实体在 Market) |

### 无法明确分组的文件

以下文件保持原位或放在顶层：

| 文件 | 处理方式 | 原因 |
|------|----------|------|
| HealthController.java | 保持顶层 | 系统健康检查，不属于具体业务域 |
| MonitoringController.java | 保持顶层 | 监控功能，跨业务域 |
| SettingsController.java | 保持顶层 | 系统设置，跨业务域 |
| TechnicalIndicatorController.java | 归入 market/ | 技术指标属于市场数据 |
| WebSocketEventController.java | 保持顶层 | WebSocket 事件处理，跨业务域 |

## Consequences

### 正向影响

- **导航效率提升**：按业务域快速定位相关类
- **架构一致性**：与 DTO、Service 的分组策略保持一致
- **模块边界清晰**：便于识别和维护业务边界
- **为未来 DDD 做准备**：清晰的包结构是 DDD 实施的基础

### 兼容性影响

- **无 API 变更**：仅包结构变更，不影响 HTTP API
- **无数据库变更**：仅代码组织变更，不影响数据库 Schema
- **导入语句变更**：所有引用这些类的文件需要更新 import
- **Spring 扫描配置**：可能需要更新 `@ComponentScan` 或 `@EntityScan`

### 实施风险

| 风险 | 缓解措施 |
|------|----------|
| 遗漏 import 更新 | 编译器会报错，逐个修复 |
| Spring Bean 扫描失败 | 检查 `@ComponentScan` 配置 |
| JPA Entity 扫描失败 | 检查 `@EntityScan` 配置 |
| Git 历史丢失 | 使用 `git mv` 保持文件历史 |

## Implementation Plan

### Phase 1: Controller 重构
1. 创建业务子包目录
2. 使用 `git mv` 移动文件
3. 更新所有 import 语句
4. 编译验证

### Phase 2: Repository 重构
1. 创建业务子包目录
2. 使用 `git mv` 移动文件
3. 更新所有 import 语句
4. 检查 Spring Data JPA 配置
5. 编译验证

### Phase 3: Entity 重构
1. 创建业务子包目录
2. 使用 `git mv` 移动文件
3. 更新所有 import 语句
4. 检查 `@EntityScan` 配置
5. 编译验证

### Phase 4: 质量检查
1. `mvn clean compile`
2. `mvn checkstyle:check`
3. `./scripts/quality-check.sh`
4. 运行单元测试

## Alternatives Considered

1. **保持现状**
   - 拒绝：与 DTO/Service 分组策略不一致，长期维护成本高
   - 当前方案：统一分层架构的包组织方式

2. **仅重构 Controller**
   - 拒绝：Repository 和 Entity 同样需要分组，一次完成更全面
   - 当前方案：三层一起重构

3. **使用不同分组策略（如按功能而非业务）**
   - 拒绝：与现有 DTO/Service 分组策略冲突
   - 当前方案：与 DTO/Service 保持一致的业务分组

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有单元测试通过
