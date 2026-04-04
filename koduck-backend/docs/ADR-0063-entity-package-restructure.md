# ADR-0063: Entity 层按业务子包分组

- Status: Accepted
- Date: 2026-04-04
- Issue: #420
- Depends on: ADR-0062

## Context

根据 `ADR-0062` 的规划，Controller 和 Repository 已经按业务子包分组完成。Entity 层作为数据模型层，也需要进行同样的重构以保持一致性。

当前 Entity 层采用扁平结构，37 个 Entity 类位于同一目录：

```
entity/
├── AlertHistory.java
├── AlertRule.java
├── BacktestResult.java
├── BacktestTrade.java
├── BaseTrade.java
├── CommunitySignal.java
├── CredentialAuditLog.java
├── DataSourceStatus.java
├── KlineData.java
├── LoginAttempt.java
├── MarketDailyBreadth.java
├── ... (共 37 个文件)
```

这种扁平结构导致：
- 查找与业务相关的 Entity 困难
- 与 Controller、Repository、DTO 的组织方式不一致
- 难以识别业务边界

## Decision

### 目标结构

将 Entity 按照与 Controller、Repository、DTO 相同的业务边界分组：

```
entity/
├── ai/
│   ├── MemoryChatMessage.java
│   └── MemoryChatSession.java
├── auth/
│   ├── User.java
│   ├── Role.java
│   ├── Permission.java
│   ├── RefreshToken.java
│   ├── UserCredential.java
│   ├── PasswordResetToken.java
│   └── LoginAttempt.java
├── backtest/
│   ├── BacktestResult.java
│   ├── BacktestTrade.java
│   ├── BaseTrade.java
│   └── Trade.java
├── community/
│   ├── CommunitySignal.java
│   ├── SignalComment.java
│   ├── SignalFavorite.java
│   ├── SignalLike.java
│   ├── SignalSubscription.java
│   └── UserSignalStats.java
├── credential/
│   └── CredentialAuditLog.java
├── market/
│   ├── KlineData.java
│   ├── StockBasic.java
│   ├── StockRealtime.java
│   ├── StockTickHistory.java
│   ├── DataSourceStatus.java
│   ├── MarketDailyBreadth.java
│   ├── MarketDailyNetFlow.java
│   └── MarketSectorNetFlow.java
├── portfolio/
│   ├── PortfolioPosition.java
│   └── WatchlistItem.java
├── strategy/
│   ├── Strategy.java
│   ├── StrategyParameter.java
│   ├── StrategyVersion.java
│   ├── AlertHistory.java
│   └── AlertRule.java
└── user/
    ├── UserSettings.java
    └── UserMemoryProfile.java
```

### 文件分组映射

| 业务域 | Entity 文件 |
|--------|-------------|
| **ai** | MemoryChatMessage, MemoryChatSession |
| **auth** | User, Role, Permission, RefreshToken, UserCredential, PasswordResetToken, LoginAttempt |
| **backtest** | BacktestResult, BacktestTrade, BaseTrade, Trade |
| **community** | CommunitySignal, SignalComment, SignalFavorite, SignalLike, SignalSubscription, UserSignalStats |
| **credential** | CredentialAuditLog |
| **market** | KlineData, StockBasic, StockRealtime, StockTickHistory, DataSourceStatus, MarketDailyBreadth, MarketDailyNetFlow, MarketSectorNetFlow |
| **portfolio** | PortfolioPosition, WatchlistItem |
| **strategy** | Strategy, StrategyParameter, StrategyVersion, AlertHistory, AlertRule |
| **user** | UserSettings, UserMemoryProfile |

### JPA 配置注意事项

Spring Boot 的 `@EntityScan` 默认会扫描主类所在包及其子包。由于 Entity 已经位于 `com.koduck.entity` 的子包中，Spring Boot 会自动扫描，**不需要额外配置**。

但需要注意：
- 如果存在 `@EntityScan` 显式配置，需要更新路径
- 检查是否有硬编码的 Entity 类全限定名

### 外键关系处理

Entity 之间的 `@ManyToOne`、`@OneToMany` 等关系通过类引用建立，只要 import 正确更新，包结构变化不会影响 JPA 映射。

## Consequences

### 正向影响

- **导航效率**：按业务域快速定位相关 Entity
- **架构一致性**：与 Controller、Repository、DTO 分组策略保持一致
- **模块边界**：业务边界清晰
- **为未来 DDD 做准备**：清晰的包结构是 DDD 实施的基础

### 兼容性影响

- **无 API 变更**：仅包结构变更，不影响 HTTP API
- **无数据库变更**：仅代码组织变更，不影响数据库 Schema
- **需要更新大量 import 语句**：影响 Repository、Service、Mapper、DTO、测试等

### 实施风险

| 风险 | 缓解措施 |
|------|----------|
| 遗漏 import 更新 | 编译器会报错，逐个修复 |
| JPA 映射问题 | 检查 @EntityScan 配置，确保自动扫描 |
| 外键关系断裂 | 通过类引用建立关系，import 正确即可 |

## Implementation Plan

### Phase 1: 创建目录并移动文件
1. 创建业务子包目录
2. 使用 `git mv` 移动文件
3. 更新所有 Entity 的 package 声明

### Phase 2: 更新 import 语句
1. 更新 Repository 中的 Entity import
2. 更新 Service 中的 Entity import
3. 更新 Mapper 中的 Entity import
4. 更新 DTO 中的 Entity import（如果有）
5. 更新测试中的 Entity import

### Phase 3: 质量检查
1. `mvn clean compile`
2. `mvn checkstyle:check`
3. `./scripts/quality-check.sh`
4. 运行单元测试

## Alternatives Considered

1. **保持 Entity 扁平结构**
   - 拒绝：与 Controller、Repository、DTO 分组策略不一致
   - 当前方案：统一分层架构的包组织方式

2. **使用不同分组策略**
   - 拒绝：与现有分组策略冲突
   - 当前方案：与 Controller、Repository、DTO 保持一致的业务分组

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有单元测试通过
