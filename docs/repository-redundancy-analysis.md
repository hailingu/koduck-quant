# Repository 层冗余分析报告

> 分析日期：2026-04-03
> 分析范围：`koduck-backend/src/main/java/com/koduck/repository/` 下全部 36 个 Repository 接口
> 分析方法：将每个 Repository 的自定义方法定义与 Service 层实际调用进行交叉比对

---

## 一、完全未使用的死代码方法

### 1.1 `StockRealtimeRepository` — 4 个方法从未被调用

| 方法 | 问题说明 |
|------|----------|
| `findBySymbolIgnoreCase()` | 定义了但从未被任何 Service 调用。实际使用 `findBySymbol()` 和 `findFirstBySymbolOrderByUpdatedAtDesc()` |
| `findBySymbolInIgnoreCase()` | 从未被调用。**且 JPQL 查询本身有 Bug**：参数声明为 `List<String> symbols`，但查询中使用了 `UPPER(:symbol)` 单数形式，且子查询未正确关联 |
| `findTopByGain(int limit)` | 从未被调用。**且 `limit` 参数无效**：JPQL 不支持参数化 LIMIT，需要改用 `Pageable` |
| `findTopByLoss(int limit)` | 同上，从未被调用且 `limit` 参数无效 |

### 1.2 `StockRealtimeRepository.countAll()` — 与继承方法完全重复

```java
@Query("SELECT COUNT(s) FROM StockRealtime s")
long countAll();
```

`JpaRepository` 已提供 `count()` 方法，功能完全一致。Service 层的 `MonitoringServiceImpl` 调用了 `countAll()`，可直接替换为继承的 `count()`。

### 1.3 `StockRealtimeRepository.findBySymbol()` — 与 `findById()` 功能重复

实体 `StockRealtime` 的 `@Id` 就是 `symbol` 字段，因此 `findBySymbol(symbol)` 等价于 `findById(symbol)`。两个方法返回类型均为 `Optional<StockRealtime>`。`MonitoringServiceImpl` 中有一处调用可替换。

---

## 二、结构性重复 — 三个信号交互 Repository 几乎完全相同

`SignalLikeRepository`、`SignalFavoriteRepository`、`SignalSubscriptionRepository` 的方法签名高度雷同：

| 方法签名 | Like | Favorite | Subscription |
|----------|:----:|:--------:|:------------:|
| `findBySignalIdAndUserId(Long, Long)` | ✅ | ✅ | ✅ |
| `existsBySignalIdAndUserId(Long, Long)` | ✅ | ✅ | ✅ |
| `findByUserId(Long)` → `List` | ✅ | ✅ | ✅ |
| `findByUserId(Long, Pageable)` → `Page` | ❌ | ✅ | ✅ |
| `findBySignalId(Long)` → `List` | ✅ | ✅ | ✅ |
| `countBySignalId(Long)` | ✅ | ✅ | ✅ |
| `countByUserId(Long)` | ✅ | ✅ | ✅ |
| `deleteBySignalIdAndUserId(Long, Long)` | ✅ | ✅ | ✅ |
| `findSignalIdsByUserId(Long)` → `List<Long>` | ✅ | ✅ | ✅ |

**唯一差异**：`SignalFavorite` 有 `note` 字段，`SignalSubscription` 有 `notifyEnabled` 字段。可以考虑抽取通用基类接口或使用泛型统一。

---

## 三、方法级别冗余 — 信号交互 Repository 中大量方法从未被 Service 调用

实际 Service (`CommunitySignalServiceImpl`) 对这三个 Repository 的调用模式完全一致：

| 实际调用的方法 | 用途 |
|---------------|------|
| `existsBySignalIdAndUserId()` | 判断是否已操作 |
| `save()` (继承) | 创建记录 |
| `deleteBySignalIdAndUserId()` | 取消操作 |
| `findSignalIdsByUserId()` | 批量加载交互标记 |
| `findByUserId()` (仅 Subscription 的 List 版) | 获取我的订阅列表 |

### 3.1 从未被调用的方法（三个 Repository 合计 15 个死方法）

| Repository | 未使用方法 |
|-----------|-----------|
| `SignalLikeRepository` | `findBySignalIdAndUserId()`, `findByUserId()`, `findBySignalId()`, `countBySignalId()`, `countByUserId()` |
| `SignalFavoriteRepository` | `findBySignalIdAndUserId()`, `findByUserId()` (List 版), `findBySignalId()`, `countBySignalId()`, `countByUserId()` |
| `SignalSubscriptionRepository` | `findBySignalIdAndUserId()`, `findByUserId()` (Page 版), `findBySignalId()`, `countBySignalId()`, `countByUserId()` |

这些 `countByXxx()` 方法尤其冗余，因为计数已通过 `CommunitySignal` 实体上的 `likeCount` / `favoriteCount` / `subscribeCount` 字段由 `CommunitySignalRepository` 的 `incrementXxxCount` / `decrementXxxCount` 方法维护。

---

## 四、汇总统计

| 类别 | 数量 | 影响 |
|------|:----:|------|
| 完全未调用的死方法 | **19 个** | 增加维护成本，误导开发者 |
| 与继承方法功能重复 | **2 个** (`countAll()`, `findBySymbol()`) | 代码噪音 |
| 结构性重复的 Repository | **3 个** (Like / Favorite / Subscription) | 可合并为泛型方案 |
| 有 Bug 的方法 | **3 个** (`findBySymbolInIgnoreCase` JPQL 错误, `findTopByGain` / `findTopByLoss` limit 无效) | 潜在运行时错误 |

---

## 五、建议优先级

### 高优先级

1. **修复 `findBySymbolInIgnoreCase` 的 JPQL Bug**：参数与查询不匹配，调用时必定报错
2. **修复 `findTopByGain` / `findTopByLoss` 的无效 `limit` 参数**：JPQL 不支持参数化 LIMIT，应改用 `Pageable`

### 中优先级

3. **删除 19 个从未调用的死方法**：减少维护负担，避免误导后续开发者
4. **将 `countAll()` 替换为继承的 `count()`**：消除冗余
5. **将 `findBySymbol()` 替换为 `findById()`**：`StockRealtime` 的 `@Id` 就是 `symbol`

### 低优先级

6. **考虑将三个信号交互 Repository 重构为泛型基类**：提取 `existsBySignalIdAndUserId`、`deleteBySignalIdAndUserId`、`findSignalIdsByUserId` 等通用方法

---

## 六、完整 Repository 清单与状态

| Repository | 冗余状态 | 说明 |
|-----------|----------|------|
| `AlertHistoryRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `AlertRuleRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `BacktestResultRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `BacktestTradeRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `CommunitySignalRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `CredentialAuditLogRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `CredentialRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `DataSourceStatusRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `KlineDataRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `LoginAttemptRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `MarketDailyBreadthRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `MarketDailyNetFlowRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `MarketSectorNetFlowRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `MemoryChatMessageRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `MemoryChatSessionRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `PasswordResetTokenRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `PermissionRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `PortfolioPositionRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `RefreshTokenRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `RoleRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| **`SignalCommentRepository`** | ⚠️ 需关注 | `countBySignalId()` 等计数方法可能与 `CommunitySignal.commentCount` 冗余 |
| **`SignalFavoriteRepository`** | 🔴 冗余 | 5 个未使用方法，结构与 Like/Subscription 高度重复 |
| **`SignalLikeRepository`** | 🔴 冗余 | 5 个未使用方法，结构与 Favorite/Subscription 高度重复 |
| **`SignalSubscriptionRepository`** | 🔴 冗余 | 5 个未使用方法，结构与 Like/Favorite 高度重复 |
| `StockBasicRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| **`StockRealtimeRepository`** | 🔴 冗余 | 4 个死方法 + 2 个与继承方法重复 + 3 个有 Bug |
| `StockTickHistoryRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `StrategyParameterRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `StrategyRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `StrategyVersionRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `TradeRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `UserMemoryProfileRepository` | ✅ 正常 | 仅继承 `JpaRepository`，无自定义方法 |
| `UserRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `UserRoleRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `UserSettingsRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `UserSignalStatsRepository` | ✅ 正常 | 方法均在 Service 中使用 |
| `WatchlistRepository` | ✅ 正常 | 方法均在 Service 中使用 |