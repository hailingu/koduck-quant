# Entity 层冗余分析报告

> **分析日期**: 2026-04-03
> **分析范围**: `koduck-backend/src/main/java/com/koduck/entity/` 下全部 35 个 Entity + 1 个 enums 子包
> **分析目的**: 识别 entity 包下的冗余问题（字段重复、结构重叠、模式冗余、枚举分散等），为后续重构提供依据

---

## 1. 概述

Entity 包当前包含 **35 个实体类** + **1 个枚举类**，按业务领域分布如下：

| 领域 | 实体 | 数量 |
|------|------|------|
| 用户/认证 | `User`, `UserCredential`, `UserSettings`, `UserMemoryProfile`, `UserSignalStats`, `RefreshToken`, `PasswordResetToken`, `LoginAttempt`, `CredentialAuditLog` | 9 |
| RBAC | `Role`, `Permission` | 2 |
| 市场数据 | `StockBasic`, `StockRealtime`, `StockTickHistory`, `KlineData`, `MarketDailyBreadth`, `MarketDailyNetFlow`, `MarketSectorNetFlow` | 7 |
| 社区/信号 | `CommunitySignal`, `SignalComment`, `SignalFavorite`, `SignalLike`, `SignalSubscription` | 5 |
| 策略/回测 | `Strategy`, `StrategyParameter`, `StrategyVersion`, `BacktestResult`, `BacktestTrade` | 5 |
| 交易/持仓 | `Trade`, `PortfolioPosition` | 2 |
| AI/记忆 | `MemoryChatSession`, `MemoryChatMessage` | 2 |
| 监控 | `AlertRule`, `AlertHistory`, `DataSourceStatus` | 3 |
| 其他 | `WatchlistItem` | 1 |

经过逐一比对字段结构、关联关系和设计模式，发现以下冗余问题：

| 严重程度 | 冗余类型 | 问题 | 数量 |
|---------|---------|------|------|
| 🔴 完全冗余 | 手写 Builder 模式 | 10 个实体手写了 100-300 行 Builder，完全可用 Lombok `@Builder` 替代 | 10 |
| 🔴 结构冗余 | 交易记录重叠 | `Trade` 与 `BacktestTrade` 字段高度重叠 | 1 对 |
| 🟡 模式冗余 | Market 指标实体同构 | 3 个 Market 实体共享相同的元数据字段模式 | 3 |
| 🟡 模式冗余 | 信号交互实体同构 | `SignalLike`/`SignalFavorite`/`SignalSubscription` 结构几乎一致 | 3 |
| 🟡 设计问题 | 枚举分散定义 | 12 个内部枚举散落在各 Entity 中，应移至 `enums/` 包 | 12 |
| 🟡 职责模糊 | 用户偏好数据分散 | `UserSettings` 与 `UserMemoryProfile` 存在关注点交叉 | 1 对 |
| ⚪ 有意设计 | 持仓 vs 自选股 | `PortfolioPosition` 与 `WatchlistItem` 共享用户-股票关联模式 | 1 对 |

---

## 2. 🔴 完全冗余：手写 Builder 模式（建议立即消除）

### 2.1 问题描述

以下 **10 个实体**放弃了 Lombok `@Builder`，改为手写 Builder + 防御性拷贝（defensive copy），导致每个实体额外膨胀 **100-300 行**：

| 实体 | 手写 Builder 行数（估） | 手写原因 |
|------|:---:|------|
| `CommunitySignal` | ~300 行 | `tags` 字段需要 `CollectionCopyUtils.copyList`；`user` 字段需要 `EntityCopyUtils.copyUser` |
| `DataSourceStatus` | ~180 行 | `metadata` 字段需要 `CollectionCopyUtils.copyMap` |
| `MemoryChatMessage` | ~150 行 | `metadata` 字段需要 `CollectionCopyUtils.copyMap` |
| `SignalComment` | ~250 行 | 多个关联实体需要 `EntityCopyUtils` 拷贝 |
| `SignalFavorite` | ~170 行 | `signal` 和 `user` 需要防御性拷贝 |
| `SignalLike` | ~150 行 | `signal` 和 `user` 需要防御性拷贝 |
| `SignalSubscription` | ~160 行 | `signal` 和 `user` 需要防御性拷贝 |
| `UserCredential` | ~280 行 | `additionalConfig` 需要防御性拷贝 |
| `UserMemoryProfile` | ~130 行 | `preferredSources` 和 `profileFacts` 需要防御性拷贝 |
| `UserSettings` | ~350 行 | 多个内嵌 JSONB 配置对象需要拷贝 |
| **合计** | **~2,100 行** | |

### 2.2 根本原因

手写 Builder 的唯一理由是：对 `List<String>`、`Map<String, Object>` 和关联实体字段执行防御性拷贝。但这个逻辑完全可以通过 **自定义 Lombok `@Builder.Default`** 或 **AOP/AttributeConverter** 统一实现。

### 2.3 建议

1. **恢复使用 Lombok `@Builder` + `@Data`**
2. 将防御性拷贝逻辑下沉到：
   - JPA `AttributeConverter`（针对 JSONB 字段，序列化/反序列化时自动拷贝）
   - 或自定义 Jackson `@JsonDeserialize` / `@JsonSerialize`
3. 对关联实体（`@ManyToOne` LAZY），直接使用 Lombok 生成的 getter/setter，防御性拷贝改为在 Service 层处理

**预期收益**：消除约 **2,100 行** 手写样板代码，同时保留防御性拷贝的语义。

---

## 3. 🔴 结构冗余：`Trade` vs `BacktestTrade`（建议合并或抽象）

### 3.1 字段对比

| 字段 | `Trade` | `BacktestTrade` |
|------|:---:|:---:|
| `id` | ✅ | ✅ |
| `userId` / `backtestResultId` | ✅ userId | ✅ backtestResultId |
| `market` | ✅ | ❌ |
| `symbol` | ✅ | ✅ |
| `name` | ✅ | ❌ |
| `tradeType` | ✅ `TradeType` (BUY/SELL) | ✅ `TradeType` (BUY/SELL) |
| `quantity` | ✅ | ✅ |
| `price` | ✅ | ✅ |
| `amount` | ✅ | ✅ |
| `commission` | ❌ | ✅ |
| `slippageCost` | ❌ | ✅ |
| `totalCost` | ❌ | ✅ |
| `cashAfter` | ❌ | ✅ |
| `positionAfter` | ❌ | ✅ |
| `pnl` | ❌ | ✅ |
| `pnlPercent` | ❌ | ✅ |
| `signalReason` | ❌ | ✅ |
| `tradeTime` | ✅ | ✅ |
| `status` | ✅ `TradeStatus` | ❌ |
| `notes` | ✅ | ❌ |
| `createdAt` | ✅ | ✅ |

**重叠字段**: `id`, `symbol`, `tradeType`, `quantity`, `price`, `amount`, `tradeTime`, `createdAt` — 共 8 个字段完全一致。

### 3.2 分析

- `Trade` 记录**真实交易**（用户手动记录或实盘执行）
- `BacktestTrade` 记录**回测模拟交易**（策略回测产生）
- 两者共享核心交易数据（买卖方向、价格、数量、金额），但 `BacktestTrade` 额外记录了模拟环境特有的上下文（滑点、现金余额、持仓变化、PnL）

### 3.3 建议

**方案 A（推荐）：提取 `BaseTrade` 抽象类或 `@MappedSuperclass`**

```java
@MappedSuperclass
public abstract class BaseTrade {
    private TradeType tradeType;
    private String symbol;
    private BigDecimal quantity;
    private BigDecimal price;
    private BigDecimal amount;
    private LocalDateTime tradeTime;
}

@Entity
public class Trade extends BaseTrade {
    private Long userId;
    private String market;
    private String name;
    private TradeStatus status;
    // ...
}

@Entity
public class BacktestTrade extends BaseTrade {
    private Long backtestResultId;
    private BigDecimal commission;
    private BigDecimal slippageCost;
    private BigDecimal cashAfter;
    // ...
}
```

**方案 B（轻量）**：保持独立，但在代码注释或文档中明确两者关系，避免后续开发者重复添加字段。

---

## 4. 🟡 模式冗余：Market 指标实体同构

### 4.1 共享元数据字段

| 字段 | `MarketDailyBreadth` | `MarketDailyNetFlow` | `MarketSectorNetFlow` |
|------|:---:|:---:|:---:|
| `id` | ✅ | ✅ | ✅ |
| `market` | ✅ | ✅ | ✅ |
| `breadthType` / `flowType` / `indicator` | ✅ | ✅ | ✅ |
| `tradeDate` | ✅ | ✅ | ✅ |
| `source` | ✅ | ✅ | ✅ |
| `quality` | ✅ | ✅ | ✅ |
| `snapshotTime` | ✅ | ✅ | ✅ |
| `updatedAt` | ✅ | ✅ | ✅ |
| `createdAt` | ✅ | ✅ | ✅ |

三个实体的**元数据骨架完全一致**：`market` + 类型标识 + `tradeDate` + `source` + `quality` + `snapshotTime` + 时间戳。唯一不同的是核心指标字段。

### 4.2 建议

**方案 A**：提取 `@MappedSuperclass`

```java
@MappedSuperclass
public abstract class MarketDailyIndicator {
    private Long id;
    private String market;
    private String indicatorType; // breadth_type / flow_type / indicator
    private LocalDate tradeDate;
    private String source;
    private String quality;
    private LocalDateTime snapshotTime;
    private LocalDateTime updatedAt;
    private LocalDateTime createdAt;
}
```

**方案 B（保持现状）**：各实体语义不同（广度/资金流/板块），保持独立可读性更好。仅需确保 Repository 查询模式一致。

---

## 5. 🟡 模式冗余：信号交互实体同构

### 5.1 结构对比

| 字段 | `SignalLike` | `SignalFavorite` | `SignalSubscription` |
|------|:---:|:---:|:---:|
| `id` | ✅ | ✅ | ✅ |
| `signalId` | ✅ | ✅ | ✅ |
| `userId` | ✅ | ✅ | ✅ |
| `createdAt` | ✅ | ✅ | ✅ |
| `signal` (ManyToOne) | ✅ | ✅ | ✅ |
| `user` (ManyToOne) | ✅ | ✅ | ✅ |
| `note` | ❌ | ✅ | ❌ |
| `notifyEnabled` | ❌ | ❌ | ✅ |

**核心字段完全一致**：`id` + `signalId` + `userId` + `createdAt` + `signal` + `user`。每个实体仅多 0-1 个扩展字段。

### 5.2 分析

- `SignalLike`：点赞，无额外字段
- `SignalFavorite`：收藏，多一个 `note` 备注
- `SignalSubscription`：订阅，多一个 `notifyEnabled` 通知开关

这三个本质上是**用户-信号交互关系**的不同类型，结构高度同质化。

### 5.3 建议

**方案 A（统一表）**：合并为 `SignalInteraction` 单表，用类型枚举区分

```java
@Entity
@Table(name = "signal_interactions",
       uniqueConstraints = @UniqueConstraint(
           columnNames = {"signal_id", "user_id", "interaction_type"}))
public class SignalInteraction {
    private Long id;
    private Long signalId;
    private Long userId;
    @Enumerated(EnumType.STRING)
    private InteractionType interactionType; // LIKE, FAVORITE, SUBSCRIBE
    private String note;          // FAVORITE 专用
    private Boolean notifyEnabled; // SUBSCRIBE 专用
    private LocalDateTime createdAt;
}
```

**方案 B（保持现状 + 共享基类）**：保留三张表，但提取 `@MappedSuperclass` 减少字段重复。

**方案 C（保持现状）**：三张表各有明确语义，独立演进。当前结构可接受。

> 推荐方案 B 或 C。方案 A 过度统一会失去类型安全性，且需要修改大量 Repository/Service 代码。

---

## 6. 🟡 设计问题：枚举分散定义

### 6.1 当前分布

| 枚举 | 定义位置 | 值 |
|------|---------|-----|
| `TradeType` | `enums/TradeType.java` | BUY, SELL |
| `User.UserStatus` | `User` 内部 | DISABLED, ACTIVE, PENDING |
| `BacktestResult.BacktestStatus` | `BacktestResult` 内部 | PENDING, RUNNING, COMPLETED, FAILED |
| `Trade.TradeStatus` | `Trade` 内部 | PENDING, SUCCESS, FAILED, CANCELLED |
| `Strategy.StrategyStatus` | `Strategy` 内部 | DRAFT, PUBLISHED, DISABLED |
| `StrategyParameter.ParameterType` | `StrategyParameter` 内部 | STRING, INTEGER, DECIMAL, BOOLEAN, ENUM |
| `CommunitySignal.SignalType` | `CommunitySignal` 内部 | BUY, SELL, HOLD |
| `CommunitySignal.Status` | `CommunitySignal` 内部 | ACTIVE, CLOSED, EXPIRED, CANCELLED |
| `CommunitySignal.ResultStatus` | `CommunitySignal` 内部 | PENDING, HIT_TARGET, HIT_STOP, TIMEOUT |
| `UserCredential.CredentialType` | `UserCredential` 内部 | BROKER, DATA_SOURCE, EXCHANGE, AI_PROVIDER |
| `UserCredential.Environment` | `UserCredential` 内部 | PAPER, LIVE, SANDBOX |
| `UserCredential.VerificationStatus` | `UserCredential` 内部 | SUCCESS, FAILED, PENDING |
| `CredentialAuditLog.ActionType` | `CredentialAuditLog` 内部 | CREATE, UPDATE, DELETE, VERIFY, VIEW |

### 6.2 问题

1. **`CommunitySignal.SignalType`（BUY, SELL, HOLD）与 `TradeType`（BUY, SELL）语义重叠**：都表示交易方向。`SignalType` 多了一个 `HOLD`，但 BUY/SELL 完全一致。
2. **枚举分散在内部类中**：不便于跨模块引用（如 DTO 层、Service 层需要引用时，必须依赖 Entity 类）。
3. **状态枚举命名冲突风险**：`BacktestStatus`、`TradeStatus`、`StrategyStatus` 均含 `PENDING`/`FAILED` 等相似值，容易混淆。

### 6.3 建议

1. **将 `TradeType` 和 `SignalType` 合并**为统一的 `TradeDirection` 枚举（BUY, SELL, HOLD），放在 `enums/` 包
2. **将所有内部枚举提取到 `enums/` 包**，按以下命名规范：

   | 提取后类名 | 来源 |
   |-----------|------|
   | `UserStatus` | `User.UserStatus` |
   | `BacktestStatus` | `BacktestResult.BacktestStatus` |
   | `TradeStatus` | `Trade.TradeStatus` |
   | `StrategyStatus` | `Strategy.StrategyStatus` |
   | `ParameterType` | `StrategyParameter.ParameterType` |
   | `SignalType` | `CommunitySignal.SignalType`（或合并为 `TradeDirection`） |
   | `SignalStatus` | `CommunitySignal.Status` |
   | `SignalResultStatus` | `CommunitySignal.ResultStatus` |
   | `CredentialType` | `UserCredential.CredentialType` |
   | `CredentialEnvironment` | `UserCredential.Environment` |
   | `VerificationStatus` | `UserCredential.VerificationStatus` |
   | `AuditActionType` | `CredentialAuditLog.ActionType` |

---

## 7. 🟡 职责模糊：`UserSettings` vs `UserMemoryProfile`

### 7.1 字段对比

| 关注点 | `UserSettings` | `UserMemoryProfile` |
|--------|:---:|:---:|
| 主题/语言/时区 | ✅ theme, language, timezone | ❌ |
| 通知配置 | ✅ notificationConfig | ❌ |
| 交易配置 | ✅ tradingConfig | ❌ |
| 显示配置 | ✅ displayConfig | ❌ |
| 快捷链接 | ✅ quickLinks | ❌ |
| LLM 配置 | ✅ llmConfig（含 memory.enabled, mode, L1-L3 开关） | ❌ |
| 风险偏好 | ❌ | ✅ riskPreference |
| 偏好数据源 | ❌ | ✅ preferredSources |
| 用户画像事实 | ❌ | ✅ profileFacts |

### 7.2 问题

- `UserSettings.llmConfig.memory` 中包含 `enabled`、`mode`、`enableL1`、`enableL2`、`enableL3` — 这与 AI 记忆系统直接相关，但放在了 UI 设置实体中
- `UserMemoryProfile` 的 `riskPreference` 和 `preferredSources` 本质上也是用户偏好，与 `UserSettings` 中的交易/显示配置属于同一范畴
- 两张表都以 `userId` 为唯一标识，形成 **1:1:1 三表关联**（`User` ↔ `UserSettings` ↔ `UserMemoryProfile`）

### 7.3 建议

1. **将 LLM/Memory 配置从 `UserSettings` 移至 `UserMemoryProfile`**：AI 相关配置应集中管理
2. 或者：将 `UserMemoryProfile` 合并到 `UserSettings` 中（作为一个 JSONB 字段 `memoryProfile`）
3. 当前方案可接受，但需要明确边界：`UserSettings` = 前端 UI 配置，`UserMemoryProfile` = AI 后端配置

---

## 8. ⚪ 有意设计：`PortfolioPosition` vs `WatchlistItem`

### 8.1 共享模式

| 字段 | `PortfolioPosition` | `WatchlistItem` |
|------|:---:|:---:|
| `userId` | ✅ | ✅ |
| `market` | ✅ | ✅ |
| `symbol` | ✅ | ✅ |
| `name` | ✅ | ✅ |
| 唯一约束 | `(user_id, market, symbol)` | `(user_id, market, symbol)` |

两者都建立 **用户-市场-股票** 的关联关系，且共享完全相同的唯一约束。

### 8.2 分析

- `PortfolioPosition`：记录**实际持仓**（含数量、成本），是交易子系统的一部分
- `WatchlistItem`：记录**关注/自选**（含排序、备注），是用户行为子系统的一部分
- 两者生命周期不同：持仓随交易自动增减，自选由用户手动管理

### 8.3 结论

**保持现状**。虽然共享关联模式，但业务语义完全不同。可以考虑让两者都通过 `StockBasic` 表做 JOIN 校验 symbol 有效性，但不建议合并。

---

## 9. 防御性拷贝模式分析

### 9.1 当前实现方式

以下实体对 JSONB 字段或关联实体字段采用了**手写 getter/setter + 防御性拷贝**模式：

| 实体 | 拷贝字段 | 拷贝方式 |
|------|---------|---------|
| `CommunitySignal` | `tags` (List), `user` (Entity) | `CollectionCopyUtils.copyList`, `EntityCopyUtils.copyUser` |
| `DataSourceStatus` | `metadata` (Map) | `CollectionCopyUtils.copyMap` |
| `MemoryChatMessage` | `metadata` (Map) | `CollectionCopyUtils.copyMap` |
| `SignalComment` | `signal`, `user`, `parent`, `replies` | `EntityCopyUtils.*` |
| `SignalFavorite` | `signal`, `user` | `EntityCopyUtils.*` |
| `SignalLike` | `signal`, `user` | `EntityCopyUtils.*` |
| `SignalSubscription` | `signal`, `user` | `EntityCopyUtils.*` |
| `UserCredential` | `additionalConfig` (Map) | `CollectionCopyUtils.copyMap` |
| `UserMemoryProfile` | `preferredSources` (List), `profileFacts` (Map) | `CollectionCopyUtils.*` |
| `UserSettings` | `notificationConfig`, `tradingConfig`, `displayConfig`, `quickLinks`, `llmConfig` | 自定义 copy 方法 + `CollectionCopyUtils` |
| `UserSignalStats` | `user` (Entity) | `EntityCopyUtils.copyUser` |

### 9.2 问题

1. **防御性拷贝在 Entity 层是不必要的**：JPA Entity 本身是数据库映射层，不应该承载业务逻辑。防御性拷贝应在 Service/DTO 转换层完成。
2. **手写 Builder 与防御性拷贝结合导致代码膨胀**：`CommunitySignal` 一个类就有 ~500 行（含 Builder），`UserSettings` 更是 ~600 行。
3. **对 `@ManyToOne LAZY` 关联做防御性拷贝会触发懒加载**：在 Entity 层调用 `getSignal()`/`getUser()` 时，即使只是拷贝，也可能触发 SQL 查询。

### 9.3 建议

1. **Entity 层使用纯 Lombok**（`@Data` + `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor`），不做防御性拷贝
2. **防御性拷贝移至 DTO 转换层**（Mapper/Converter）
3. 或者：为 JSONB 字段自定义 Hibernate `AttributeConverter`，在序列化/反序列化时自动实现不可变性

---

## 10. 总结与优先级建议

| 优先级 | 类型 | 问题 | 影响范围 | 建议操作 |
|--------|------|------|---------|---------|
| 🔴 **P0** | 代码膨胀 | 10 个实体手写 Builder（~2,100 行） | 10 个文件 | 恢复 Lombok `@Builder`，防御性拷贝下沉 |
| 🔴 **P0** | 结构冗余 | `Trade` vs `BacktestTrade` 字段重叠 | 2 个文件 | 提取 `BaseTrade` @MappedSuperclass |
| 🟡 **P1** | 枚举分散 | 12 个内部枚举未归入 `enums/` 包 | 8 个文件 | 提取至 `enums/` 包，合并 `SignalType`/`TradeType` |
| 🟡 **P1** | 模式冗余 | `SignalLike`/`SignalFavorite`/`SignalSubscription` 同构 | 3 个文件 | 提取 `@MappedSuperclass` 或保持现状 |
| 🟡 **P1** | 模式冗余 | Market 指标三实体同构 | 3 个文件 | 提取 `@MappedSuperclass` 或保持现状 |
| 🟡 **P2** | 职责模糊 | `UserSettings` LLM 配置与 `UserMemoryProfile` 交叉 | 2 个文件 | 重新划界，AI 配置集中至 `UserMemoryProfile` |
| ⚪ **保留** | 有意设计 | `PortfolioPosition` vs `WatchlistItem` | — | 保持现状 |
| ⚪ **保留** | 有意设计 | `AlertRule` / `AlertHistory` 父子关系 | — | 保持现状 |
| ⚪ **保留** | 有意设计 | `Strategy` / `StrategyVersion` / `StrategyParameter` 版本体系 | — | 保持现状 |

---

## 11. 冗余影响量化

| 冗余类型 | 涉及实体数 | 可消除代码（估算） |
|----------|:---------:|:----------------:|
| 手写 Builder + 防御性拷贝 | 10 个 | ~2,100 行 |
| Trade/BacktestTrade 公共字段 | 2 个 | ~40 行（如提取基类） |
| 内部枚举提取 | 8 个 | 0（纯位置移动，提高可维护性） |
| 信号交互实体同构 | 3 个 | ~50 行（如提取基类） |
| Market 指标同构 | 3 个 | ~60 行（如提取基类） |
| **合计** | **~18 个** | **~2,250 行可消除/简化** |

---

## 附录 A：Entity 目录结构

```
entity/
├── enums/
│   └── TradeType.java                  # 🔡 唯一独立枚举
├── AlertHistory.java                   # 监控 - 告警历史
├── AlertRule.java                      # 监控 - 告警规则
├── BacktestResult.java                 # 策略 - 回测结果（含内部枚举 BacktestStatus）
├── BacktestTrade.java                  # 策略 - 回测交易（🔴 与 Trade 重叠）
├── CommunitySignal.java                # 社区 - 信号（含 3 个内部枚举，🔴 手写 Builder）
├── CredentialAuditLog.java             # 认证 - 凭证审计日志（含内部枚举 ActionType）
├── DataSourceStatus.java               # 监控 - 数据源状态（🔴 手写 Builder）
├── KlineData.java                      # 行情 - K线数据
├── LoginAttempt.java                   # 认证 - 登录尝试记录
├── MarketDailyBreadth.java             # 市场 - 日广度指标（🟡 与其他 Market 实体同构）
├── MarketDailyNetFlow.java             # 市场 - 日资金流（🟡 与其他 Market 实体同构）
├── MarketSectorNetFlow.java            # 市场 - 板块资金流（🟡 与其他 Market 实体同构）
├── MemoryChatMessage.java              # AI - 聊天消息（🔴 手写 Builder）
├── MemoryChatSession.java              # AI - 聊天会话
├── PasswordResetToken.java             # 认证 - 密码重置令牌
├── Permission.java                     # RBAC - 权限
├── PortfolioPosition.java              # 交易 - 持仓
├── RefreshToken.java                   # 认证 - 刷新令牌
├── Role.java                           # RBAC - 角色
├── SignalComment.java                  # 社区 - 信号评论（🔴 手写 Builder）
├── SignalFavorite.java                 # 社区 - 信号收藏（🟡 与 Like/Subscription 同构，🔴 手写 Builder）
├── SignalLike.java                     # 社区 - 信号点赞（🟡 与 Favorite/Subscription 同构，🔴 手写 Builder）
├── SignalSubscription.java             # 社区 - 信号订阅（🟡 与 Like/Favorite 同构，🔴 手写 Builder）
├── StockBasic.java                     # 行情 - 股票基本信息
├── StockRealtime.java                  # 行情 - 股票实时行情
├── StockTickHistory.java               # 行情 - 逐笔历史
├── Strategy.java                       # 策略 - 策略（含内部枚举 StrategyStatus）
├── StrategyParameter.java              # 策略 - 策略参数（含内部枚举 ParameterType）
├── StrategyVersion.java                # 策略 - 策略版本
├── Trade.java                          # 交易 - 交易记录（🔴 与 BacktestTrade 重叠）
├── User.java                           # 用户 - 用户（含内部枚举 UserStatus）
├── UserCredential.java                 # 认证 - API凭证（含 3 个内部枚举，🔴 手写 Builder）
├── UserMemoryProfile.java              # AI - 用户记忆画像（🟡 与 UserSettings 职责交叉，🔴 手写 Builder）
├── UserSettings.java                   # 用户 - 用户设置（🟡 与 UserMemoryProfile 职责交叉，🔴 手写 Builder）
├── UserSignalStats.java                # 社区 - 用户信号统计（🔴 手写 Builder）
└── WatchlistItem.java                  # 用户 - 自选股
```

---

## 附录 B：实体关系概览

```
User ─┬── UserSettings (1:1)
      ├── UserMemoryProfile (1:1)
      ├── UserSignalStats (1:1)
      ├── UserCredential (1:N)
      ├── RefreshToken (1:N)
      ├── PasswordResetToken (1:N)
      ├── LoginAttempt (via identifier)
      ├── CredentialAuditLog (1:N)
      ├── Strategy (1:N) ─── StrategyVersion (1:N)
      │                  └── StrategyParameter (1:N)
      ├── BacktestResult (1:N) ─── BacktestTrade (1:N)
      ├── Trade (1:N)
      ├── PortfolioPosition (1:N)
      ├── WatchlistItem (1:N)
      ├── CommunitySignal (1:N) ──┬── SignalLike (1:N)
      │                           ├── SignalFavorite (1:N)
      │                           ├── SignalSubscription (1:N)
      │                           └── SignalComment (1:N, self-ref)
      ├── MemoryChatSession (1:N) ─── MemoryChatMessage (1:N)
      └── Role/Permission (RBAC)

StockBasic ─┬── StockRealtime (1:1, via symbol)
            ├── KlineData (1:N)
            ├── StockTickHistory (1:N)
            ├── PortfolioPosition (via market+symbol)
            ├── WatchlistItem (via market+symbol)
            └── Trade (via market+symbol)

AlertRule ─── AlertHistory (1:N)

DataSourceStatus (独立)