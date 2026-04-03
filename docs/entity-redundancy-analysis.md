# Entity 层冗余分析报告

> 分析范围：`koduck-backend/src/main/java/com/koduck/entity/` 下全部 36 个实体类  
> 日期：2026-04-03

---

## 一、完全冗余（建议立即消除）

### 1.1 `TradeType` 枚举重复定义

| 实体 | 枚举位置 |
|------|----------|
| `Trade.java` | `public enum TradeType { BUY, SELL }` |
| `BacktestTrade.java` | `public enum TradeType { BUY, SELL }` |

**问题**：两个实体各自定义了完全相同的 `TradeType` 枚举（`BUY`, `SELL`），属于 **代码级完全冗余**。

**建议**：提取为顶层共享枚举类 `com.koduck.entity.enums.TradeType`（或放在 `com.koduck.common.enums`），两个实体统一引用。

---

### 1.2 `UserMemoryProfile.watchSymbols` 与 `WatchlistItem` 功能重叠

| 实体 | 字段 | 存储方式 |
|------|------|----------|
| `UserMemoryProfile` | `watchSymbols: List<String>` | JSONB 列 |
| `WatchlistItem` | `symbol, market, name, sortOrder, notes` | 独立表，支持排序/备注 |

**问题**：两者记录的是同一业务概念——用户关注的股票列表。`WatchlistItem` 是功能完备的实现（支持排序、备注、市场区分），而 `UserMemoryProfile.watchSymbols` 只是一个 JSONB 字符串数组，功能完全被前者覆盖。

**建议**：
- 删除 `UserMemoryProfile.watchSymbols` 字段
- 如果 AI 需要快速读取关注列表，通过 JOIN 查询或缓存层解决，而非在另一个表中冗余存储

---

## 二、结构高度相似（可考虑合并或抽象）

### 2.1 `SignalLike` / `SignalFavorite` / `SignalSubscription` — 三表同构

| 特征 | `SignalLike` | `SignalFavorite` | `SignalSubscription` |
|------|-------------|-----------------|---------------------|
| signal_id | ✅ | ✅ | ✅ |
| user_id | ✅ | ✅ | ✅ |
| created_at | ✅ | ✅ | ✅ |
| ManyToOne → CommunitySignal | ✅ | ✅ | ✅ |
| ManyToOne → User | ✅ | ✅ | ✅ |
| 额外字段 | 无 | `note` | `notifyEnabled` |
| Hand-written Builder | ✅ | ✅ | ✅ |
| EntityCopyUtils 模式 | ✅ | ✅ | ✅ |

**问题**：三个实体结构几乎完全一致，代码模式完全相同（手写 Builder、copy-on-read getter/setter）。

**建议方案 A（推荐）**：合并为单一 `SignalInteraction` 表，用 `interaction_type` 枚举区分 `LIKE`/`FAVORITE`/`SUBSCRIBE`：

```sql
CREATE TABLE signal_interactions (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    interaction_type VARCHAR(20) NOT NULL,  -- LIKE, FAVORITE, SUBSCRIBE
    note TEXT,                               -- 仅 FAVORITE 使用
    notify_enabled BOOLEAN DEFAULT TRUE,     -- 仅 SUBSCRIBE 使用
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(signal_id, user_id, interaction_type)
);
```

**建议方案 B**：保留三表但抽取公共基类 `BaseSignalInteraction`（`@MappedSuperclass`），消除重复字段和 Builder 代码。

---

### 2.2 手写 Builder 模式的大规模冗余

以下实体未使用 Lombok `@Builder`，而是手写了完整的 Builder 类：

| 实体 | Builder 行数（估算） | 手写原因 |
|------|---------------------|----------|
| `CommunitySignal` | ~200 行 | copy-on-read |
| `DataSourceStatus` | ~130 行 | copy-on-read |
| `MemoryChatMessage` | ~100 行 | copy-on-read |
| `SignalComment` | ~180 行 | copy-on-read |
| `SignalFavorite` | ~50 行 | copy-on-read |
| `SignalLike` | ~50 行 | copy-on-read |
| `SignalSubscription` | ~50 行 | copy-on-read |
| `UserCredential` | ~150 行 | copy-on-read |
| `UserMemoryProfile` | ~30 行 | copy-on-read |
| `UserSettings` | ~200 行 | 嵌套配置 copy |
| `UserSignalStats` | 无 Builder | 但有 copy-on-read |

**问题**：手写 Builder 的唯一目的是在 setter 和 getter 中注入 `CollectionCopyUtils` / `EntityCopyUtils` 的深拷贝逻辑。这导致约 **1,100+ 行** 重复性代码。

**建议**：
1. 短期：保留现状但添加注释说明原因（防御性拷贝是 JPA 实体的合理考量）
2. 中期：考虑使用 `@Builder` + 自定义 `@Build` 方法 + AOP/ByteBuddy 自动注入拷贝逻辑
3. 或改用 Java `record` 作为 DTO 层，Entity 层去掉 copy-on-read 模式

---

## 三、领域边界模糊（存在职责重叠但各有独立用途）

### 3.1 `PortfolioPosition` vs `Trade`

| 维度 | `PortfolioPosition` | `Trade` |
|------|--------------------| -------|
| 记录粒度 | 当前持仓汇总 | 每笔交易流水 |
| 核心字段 | user_id, symbol, quantity, avg_cost | user_id, symbol, price, quantity, trade_type |
| 可推导性 | **可从 Trade 聚合推导** | 原始数据 |
| 典型用途 | 展示"我的持仓" | 交易记录、审计 |

**结论**：`PortfolioPosition` 是 `Trade` 的**物化视图/快照**，属于**有意去规范化（denormalization）**，并非冗余。保留两者是合理的设计。

---

### 3.2 `BacktestTrade` vs `Trade`

| 维度 | `BacktestTrade` | `Trade` |
|------|----------------|---------|
| 所属域 | 回测模拟 | 实盘交易 |
| 关联 | → `BacktestResult` | → `User` |
| 额外字段 | cashAfter, positionAfter, pnl, pnlPercent, slippageCost, signalReason | status, notes, name |
| TradeType | 自定义枚举（重复） | 自定义枚举（重复） |

**结论**：两个实体分属不同业务域（回测 vs 实盘），不应合并。但 `TradeType` 枚举应共享（见 1.1）。

---

### 3.3 `StockTickHistory` vs `KlineData`

| 维度 | `StockTickHistory` | `KlineData` |
|------|--------------------| ----|
| 数据粒度 | 逐笔（synthetic tick） | K 线（1m/5m/1d 等） |
| 字段 | symbol, tickTime, price, volume, amount | symbol, klineTime, OHLCV, timeframe |
| 来源 | 实时快照合成 | 历史数据同步 + 聚合 |
| 用途 | 实时 tick 级推送 | 技术分析、回测 |

**结论**：不同数据粒度，均有独立存在价值。不属于冗余。

---

### 3.4 `CredentialAuditLog` vs `LoginAttempt`

| 维度 | `CredentialAuditLog` | `LoginAttempt` |
|------|--------------------| ----|
| 范围 | 凭证生命周期（CREATE/UPDATE/DELETE/VERIFY/VIEW） | 登录尝试（成功/失败） |
| 关联 | → `UserCredential` | 独立（按 identifier + IP） |
| 安全用途 | 凭证操作审计 | 暴力破解防护 |

**结论**：两者都是审计日志但关注不同安全维度。可以考虑统一为 `SecurityAuditLog`，但当前分离也是合理的设计。

---

## 四、无冗余的实体（确认独立）

以下实体各司其职，无功能重叠：

| 分类 | 实体 |
|------|------|
| **用户认证** | `User`, `UserCredential`, `RefreshToken`, `PasswordResetToken`, `LoginAttempt`, `CredentialAuditLog` |
| **权限** | `Role`, `Permission` |
| **股票数据** | `StockBasic`, `StockRealtime`, `KlineData`, `StockTickHistory` |
| **市场统计** | `MarketDailyBreadth`, `MarketDailyNetFlow`, `MarketSectorNetFlow` |
| **策略** | `Strategy`, `StrategyParameter`, `StrategyVersion` |
| **回测** | `BacktestResult`, `BacktestTrade` |
| **交易** | `Trade`, `PortfolioPosition` |
| **社区信号** | `CommunitySignal`, `SignalComment` |
| **监控** | `AlertRule`, `AlertHistory`, `DataSourceStatus` |
| **AI/记忆** | `MemoryChatSession`, `MemoryChatMessage`, `UserMemoryProfile` |
| **用户偏好** | `UserSettings`, `WatchlistItem`, `UserSignalStats` |

---

## 五、总结与优先级建议

| 优先级 | 类型 | 问题 | 影响 | 建议 |
|--------|------|------|------|------|
| 🔴 **P0** | 代码冗余 | `TradeType` 枚举重复定义 | 维护负担，改一处漏一处 | 提取为共享枚举 |
| 🔴 **P0** | 数据冗余 | `UserMemoryProfile.watchSymbols` 与 `WatchlistItem` | 数据不一致风险 | 删除 JSONB 字段 |
| 🟡 **P1** | 结构冗余 | `SignalLike/Favorite/Subscription` 三表同构 | 表数量膨胀，维护成本高 | 合并或抽基类 |
| 🟢 **P2** | 代码模式 | 手写 Builder 重复 ~1100 行 | 代码膨胀，但不影响功能 | 中期优化 |
| ⚪ **保留** | 有意设计 | `PortfolioPosition` 是 Trade 快照 | 性能优化 | 保持现状 |
| ⚪ **保留** | 有意设计 | `BacktestTrade` vs `Trade` 不同域 | 领域隔离 | 保持现状 |