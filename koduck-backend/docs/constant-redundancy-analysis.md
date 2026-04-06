# Constant Redundancy Analysis — koduck-backend

> 分析日期: 2026-04-03
> 范围: `koduck-backend/src/main/java`

## 概述

在 `com.koduck.common.constants` 包下已建立了 8 个集中式常量类，但仍有大量相同或语义相同的常量在 service / controller / config 层被重复定义为 `private static final` 局部常量。

**统计**:
- 已集中常量类: 8 个
- 发现重复定义: 16 组
- 涉及文件: 20+ 个

---

## 一、完全重复定义（同值同变量名，不同文件）

以下常量在不同文件中用相同的变量名和值被独立定义，应提取到共享常量类。

### 1. `KEY_SYMBOL = "symbol"` — 3 处

| 文件 | 变量名 |
|------|--------|
| `service/market/AKShareDataProvider.java` | `KEY_SYMBOL` |
| `service/market/support/AKShareDataMapperSupport.java` | `KEY_SYMBOL` |
| `service/impl/StockCacheServiceImpl.java` | `KEY_SYMBOL` |

**建议**: 提取到 `MapKeyConstants.KEY_SYMBOL`。

---

### 2. `KEY_NAME = "name"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/market/support/AKShareDataMapperSupport.java` | `KEY_NAME` |
| `service/impl/StockCacheServiceImpl.java` | `KEY_NAME` |

**建议**: 提取到 `MapKeyConstants.KEY_NAME`。

---

### 3. `PROVIDER_MINIMAX = "minimax"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/impl/UserSettingsServiceImpl.java` | `PROVIDER_MINIMAX` |
| `service/support/UserSettingsLlmConfigSupport.java` | `PROVIDER_MINIMAX` |

**建议**: 提取到 `LlmConstants.PROVIDER_MINIMAX`。

---

### 4. `ENV_LLM_API_BASE = "LLM_API_BASE"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `config/DataInitializer.java` | `ENV_LLM_API_BASE` |
| `service/support/UserSettingsLlmConfigSupport.java` | `ENV_LLM_API_BASE` |

**建议**: 提取到 `LlmConstants.ENV_LLM_API_BASE`。

---

### 5. `RISK_AGGRESSIVE = "aggressive"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/support/AiRecommendationSupport.java` | `RISK_AGGRESSIVE` |
| `service/impl/AiAnalysisServiceImpl.java` | `RISK_AGGRESSIVE` |

**建议**: 提取到 `AiConstants.RISK_AGGRESSIVE`。

---

### 6. `RISK_CONSERVATIVE = "conservative"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/support/AiRecommendationSupport.java` | `RISK_CONSERVATIVE` |
| `service/impl/AiAnalysisServiceImpl.java` | `RISK_CONSERVATIVE` |

**建议**: 提取到 `AiConstants.RISK_CONSERVATIVE`。

---

### 7. `STOCK_TYPE = "STOCK"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/support/MarketFallbackSupport.java` | `STOCK_TYPE` |
| `service/support/MarketServiceSupport.java` | `STOCK_TYPE` |

**建议**: 提取到 `MarketConstants.STOCK_TYPE`。

---

### 8. `KEY_CONTENT = "content"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/impl/AiAnalysisServiceImpl.java` | `KEY_CONTENT` |
| `service/support/AiStreamRelaySupport.java` | `KEY_CONTENT` |

**建议**: 提取到 `MapKeyConstants.KEY_CONTENT`。

---

### 9. `A_SHARE_BASE_PATH = "/a-share"` — 2 处

| 文件 | 变量名 |
|------|--------|
| `service/market/AKShareDataProvider.java` | `A_SHARE_BASE_PATH` |
| `service/impl/KlineSyncServiceImpl.java` | `A_SHARE_BASE_PATH` |

**建议**: 提取到 `DataServicePathConstants.A_SHARE_BASE_PATH`。

---

## 二、重复包装已集中常量（冗余间接引用）

以下常量已经在 `MarketConstants` 中定义，但被多个类重新声明为本地变量，形成冗余包装。应直接使用 `MarketConstants.XXX`。

### 10. `DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME` — 4 处

| 文件 | 说明 |
|------|------|
| `service/impl/PortfolioServiceImpl.java` | 冗余包装 |
| `service/impl/KlineServiceImpl.java` | 冗余包装 |
| `service/impl/KlineSyncServiceImpl.java` | 冗余包装 |
| `service/impl/BacktestServiceImpl.java` | 冗余包装 |

**建议**: 删除本地变量，直接引用 `MarketConstants.DEFAULT_TIMEFRAME`。

---

### 11. `DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET` — 3 处

| 文件 | 说明 |
|------|------|
| `service/support/MarketFallbackSupport.java` | 冗余包装 |
| `service/impl/KlineServiceImpl.java` | 冗余包装 |
| `service/impl/KlineSyncServiceImpl.java` | 冗余包装 |

**建议**: 删除本地变量，直接引用 `MarketConstants.DEFAULT_MARKET`。

---

### 12. `WEEKLY_TIMEFRAME / MONTHLY_TIMEFRAME = MarketConstants.XXX` — 1 处

| 文件 | 说明 |
|------|------|
| `service/impl/KlineServiceImpl.java` | 同时包装了 `WEEKLY_TIMEFRAME` 和 `MONTHLY_TIMEFRAME` |

**建议**: 删除本地变量，直接引用 `MarketConstants.WEEKLY_TIMEFRAME` / `MONTHLY_TIMEFRAME`。

---

## 三、同值不同变量名（语义重复）

以下常量值相同但使用了不同的变量名，表示相同概念。

### 13. `ZoneId.of("Asia/Shanghai")` 时区 — 4 处

| 文件 | 变量名 |
|------|--------|
| `controller/MarketAdvancedController.java` | `MARKET_ZONE` |
| `service/impl/KlineServiceImpl.java` | `MARKET_ZONE` |
| `service/impl/SyntheticTickServiceImpl.java` | `MARKET_ZONE` |
| `service/market/FuturesProvider.java` | `BEIJING_ZONE` |

另有 2 处作为字符串字面量 `"Asia/Shanghai"` 直接使用:
- `service/market/AKShareDataProvider.java` (`TIMEZONE_ASIA_SHANGHAI`)
- `service/impl/KlineSyncServiceImpl.java` (`@Scheduled` zone 属性)

**建议**: 提取到 `DateTimePatternConstants.MARKET_ZONE_ID = ZoneId.of("Asia/Shanghai")`，并重命名常量类为 `DateTimeConstants`。

---

### 14. `"000001"` A股指数代码 — 4 处

| 文件 | 变量名/用法 |
|------|-------------|
| `service/impl/MarketSentimentServiceImpl.java` | `A_SHARE_INDEX = "000001"` |
| `service/impl/StrategyServiceImpl.java` | `DEFAULT_TEMPLATE_SYMBOL = "000001"` |
| `service/impl/MarketServiceImpl.java` | 列表内字面量 `"000001"` |
| `service/impl/KlineSyncServiceImpl.java` | 列表内字面量 `"000001"` |

**建议**: 提取到 `MarketConstants.A_SHARE_INDEX_SYMBOL = "000001"`。

---

### 15. Timeframe 允许值数组 `{"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"}` — 3 处

| 文件 | 出现次数 |
|------|----------|
| `controller/KlineController.java` | 2 次 |
| `controller/MarketController.java` | 1 次 |

**建议**: 提取到 `MarketConstants.ALL_TIMEFRAMES = {"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"}`。

---

### 16. `"a_share"` 市场代码 — 散布在多处

| 文件 | 用法 |
|------|------|
| `market/MarketType.java` | 枚举值 `A_SHARE("a_share", ...)` |
| `common/constants/MarketConstants.java` | `DEFAULT_MARKET_CODE = "a_share"` |
| `market/util/DataConverter.java` | `"a_share".equals(market)` 内联比较 |
| `controller/SentimentController.java` | `@Schema(example = "a_share")` |

**建议**: `DataConverter.java` 中的 `"a_share".equals(market)` 应使用 `MarketType.A_SHARE.getCode().equals(market)` 或 `MarketConstants.DEFAULT_MARKET_CODE`。

---

## 四、汇总建议

### 推荐新增的集中常量类

| 新常量类 | 职责 | 应包含的常量 |
|----------|------|-------------|
| `MapKeyConstants` | Map 字段键名 | `KEY_SYMBOL`, `KEY_NAME`, `KEY_CONTENT`, `KEY_VOLUME`, `KEY_AMOUNT`, `KEY_CHANGE_PERCENT` 等 |
| `LlmConstants` | LLM 提供商相关 | `PROVIDER_MINIMAX`, `PROVIDER_DEEPSEEK`, `PROVIDER_OPENAI`, `ENV_LLM_API_BASE`, `ENV_LLM_API_KEY` 等 |
| `AiConstants` | AI 分析相关 | `RISK_AGGRESSIVE`, `RISK_CONSERVATIVE`, `RISK_BALANCED` 等 |
| `DataServicePathConstants` | 数据服务路径 | `A_SHARE_BASE_PATH`, `HK_STOCK_BASE_PATH`, `FOREX_BASE_PATH`, `FUTURES_BASE_PATH` 等 |

### 推荐扩展现有常量类

| 现有类 | 应添加的常量 |
|--------|-------------|
| `MarketConstants` | `STOCK_TYPE`, `A_SHARE_INDEX_SYMBOL`, `ALL_TIMEFRAMES` |
| `DateTimePatternConstants` → 重命名为 `DateTimeConstants` | `MARKET_ZONE_ID` (ZoneId), `TIMEZONE_ASIA_SHANGHAI` (String) |

### 推荐消除的冗余包装

以下模式应直接引用 `MarketConstants`，不再创建本地变量：

```java
// ❌ 冗余包装（出现在 4 个文件中）
private static final String DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;

// ✅ 直接使用
MarketConstants.DEFAULT_TIMEFRAME
```

---

## 五、影响范围与风险

| 变更类型 | 风险等级 | 说明 |
|----------|----------|------|
| 新增集中常量类 | 🟢 低 | 纯新增，不影响现有代码 |
| 将本地常量替换为集中常量引用 | 🟡 中 | 需逐一替换并验证编译通过 |
| 删除冗余包装变量 | 🟡 中 | 需确认所有引用点已更新 |
| 重命名 `DateTimePatternConstants` | 🔴 高 | 需全局替换，影响所有引用该类的文件 |

**建议执行顺序**:
1. 先新增常量类和常量字段
2. 逐步替换引用（可按模块分批进行）
3. 最后删除冗余的本地常量定义
4. 重命名放在最后，作为独立 PR