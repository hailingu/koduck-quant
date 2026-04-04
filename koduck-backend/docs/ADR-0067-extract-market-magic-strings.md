# ADR-0067: 提取市场类型魔法字符串为 MarketConstants 常量

- Status: Accepted
- Date: 2026-04-04
- Issue: #428

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的可维护性评估，`koduck-backend` 中存在市场类型魔法字符串硬编码问题。`MarketConstants` 中已经定义了 `STOCK_TYPE = "STOCK"` 和 `INDEX_TYPE = "INDEX"`，但以下位置仍然直接使用字符串字面量：

| 位置 | 当前实现 | 期望实现 |
|------|----------|----------|
| `entity/market/StockBasic.java:59` | `private String type = "STOCK";` | `MarketConstants.STOCK_TYPE` |
| `entity/market/StockRealtime.java:53` | `private String type = "STOCK";` | `MarketConstants.STOCK_TYPE` |
| `service/impl/PricePushServiceImpl.java:159` | `.type(event.getType() != null ? event.getType() : "STOCK")` | `MarketConstants.STOCK_TYPE` |
| `service/market/support/AKShareDataMapperSupport.java:87` | `.orElse("STOCK")` | `MarketConstants.STOCK_TYPE` |
| `service/market/support/AKShareDataMapperSupport.java:137` | `.orElse("STOCK")` | `MarketConstants.STOCK_TYPE` |

此外，测试代码中也存在对应的硬编码：

| 位置 | 当前实现 |
|------|----------|
| `controller/MarketControllerIntegrationTest.java` | 多处 `.type("STOCK")`、`.type("INDEX")` |
| `service/MarketServiceImplTest.java` | 多处 `.type("STOCK")`、参数 `"INDEX"` |

这些问题导致：
- **维护困难**：类型值调整时需要全局搜索替换，极易遗漏
- **拼写风险**：手写字符串可能出现大小写或拼写不一致
- **可读性下降**：新开发者无法直观判断该字符串是否为受控业务常量

## Decision

### 1. 替换 main 源码中的魔法字符串

将 `StockBasic`、`StockRealtime`、`PricePushServiceImpl`、`AKShareDataMapperSupport` 中的 `"STOCK"` 替换为 `MarketConstants.STOCK_TYPE`，`"INDEX"` 替换为 `MarketConstants.INDEX_TYPE`（如有）。

**修改示例（AKShareDataMapperSupport）：**
```java
// Before
.type(Optional.ofNullable(MarketDataMapReader.getString(data, "type")).orElse("STOCK"))

// After
.type(Optional.ofNullable(MarketDataMapReader.getString(data, "type"))
    .orElse(MarketConstants.STOCK_TYPE))
```

**修改示例（StockBasic）：**
```java
// Before
private String type = "STOCK";

// After
private String type = MarketConstants.STOCK_TYPE;
```

### 2. 同步更新测试代码

测试代码中所有涉及 `"STOCK"` 和 `"INDEX"` 的断言与 mock 参数，统一替换为 `MarketConstants.STOCK_TYPE` 和 `MarketConstants.INDEX_TYPE`，确保测试与实现一致。

### 3. 不引入枚举（当前阶段）

虽然将字符串类型升级为枚举（如 `SecurityType.STOCK`）是更理想的长期方案，但 `type` 字段目前以 `String` 形式存储在数据库中，且被多个外部 DTO、前端接口使用。改为枚举会涉及：
- 数据库列类型或转换器变更
- 序列化/反序列化适配（JSON、MapStruct）
- 前端契约调整

本次 ADR 仅做**最小侵入性修复**：集中常量管理，保持数据类型和 API 不变，为后续升级到枚举打好基础。

## Consequences

### 正向影响

- **维护集中化**：类型字符串统一在 `MarketConstants` 管理，修改只需改一处
- **消除拼写风险**：编译期可检查常量引用，避免手写字符串错误
- **提升可读性**：代码清晰表达 `"STOCK"` 是受控业务常量
- **为枚举升级铺垫**：先完成常量统一，后续枚举替换时影响范围更小

### 兼容性影响

- **API 行为不变**：HTTP 接口、DTO、数据库表结构均无变化
- **默认值不变**：实体字段默认值仍返回 `"STOCK"`，只是通过常量引用
- **Map 键名不变**：`AKShareDataMapperSupport` 中从 Map 读取 `"type"` 的键名保持不变，仅 fallback 默认值使用常量
- **无运行时行为差异**：纯代码层面的常量替换，功能完全等价

## Alternatives Considered

1. **直接升级为 `SecurityType` 枚举**
   - 拒绝：改动面过大，涉及数据库、DTO、前端、序列化等多层适配，不符合本次轻量修复的目标
   - 当前方案：先用 `MarketConstants` 常量统一管理，后续独立迭代升级到枚举

2. **保留现状**
   - 拒绝：魔法字符串已被 `ARCHITECTURE-EVALUATION.md` 明确列为可维护性问题，且项目已有 `MarketConstants` 常量却未被使用，属于明显的技术债务
   - 当前方案：全面替换，消除硬编码

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有现有单元测试与切片测试通过
