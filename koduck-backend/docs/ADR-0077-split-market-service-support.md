# ADR-0077: 拆分 MarketServiceSupport 上帝类

- Status: Accepted
- Date: 2026-04-04
- Issue: #448

## Context

`ARCHITECTURE-EVALUATION.md` 明确指出 `service/support/` 包中 `MarketServiceSupport`（663 行）职责过重：

| 职责 | 方法/常量数量 | 说明 |
|------|--------------|------|
| DTO 映射 | 8 个方法 | `mapToSymbolInfoDto`、`mapToPriceQuoteDto`、`mapToMarketIndexDto` 等 |
| 数学计算 | 2 个方法 | `calculateChange`、`calculateChangePercent` |
| 数据规范化 | 1 个方法 + 2 个工具方法 | `normalizeKlineData`、`toBigDecimal`、`toLong` |
| Mock 数据生成 | 1 个公共方法 + 2 个私有方法 | `generateMockSectorNetwork` 及 80+ 个硬编码常量 |
| 仓库查询 | 1 个方法 | `getHotStocks` 直接访问 `StockRealtimeRepository` |

这导致：
- **违反 SRP**：任何一个职责的修改都可能影响其他职责
- **测试困难**：单元测试需要覆盖不相关的多个领域
- **依赖混乱**：`MarketFallbackSupport` 为了使用计算和规范化方法，不得不依赖整个 `MarketServiceSupport`

## Decision

### 1. 按职责拆分为 4 个独立类

| 新类 | 职责 | 来源方法 |
|------|------|---------|
| `MarketDtoMapper` | Entity → DTO 映射 | 所有 `mapToXxx` 及 `shouldReplaceSymbol` |
| `MarketPriceCalculator` | 价格/涨跌幅计算 | `calculateChange`、`calculateChangePercent` |
| `KlineDataNormalizer` | K 线数据规范化 | `normalizeKlineData`、`toBigDecimal`、`toLong` |
| `MockSectorNetworkGenerator` | Mock 板块网络数据生成 | `generateMockSectorNetwork`、`buildMockSectorNodes`、`buildMockSectorLinks` 及全部常量 |

### 2. 将查询操作移回 Service

`getHotStocks` 直接操作 `StockRealtimeRepository` 和 `StockBasicRepository`，本质上是一个业务查询，不应放在 Support 类中。将其内联到 `MarketServiceImpl`。

### 3. 解除 MarketFallbackSupport 对 MarketServiceSupport 的依赖

`MarketFallbackSupport` 改为仅注入它真正需要的两个类：
- `KlineDataNormalizer`
- `MarketPriceCalculator`

原 `MarketServiceSupport` 被整体删除，不再存在。

### 4. 放置位置

所有新类放在 `service/support/market/` 子包中，让 `service/support/` 目录按领域进一步分层，与 Controller/Entity 等领域的子包策略保持一致。

## Consequences

### 正向影响

- **单一职责**：每个 Support 类只负责一个明确领域，修改范围可控
- **可测试性提升**：可以对 `MockSectorNetworkGenerator`、`MarketPriceCalculator` 等进行独立单元测试
- **依赖清晰**：`MarketFallbackSupport` 不再依赖一个庞大的上帝类
- **与评估建议对齐**：实现了 `ARCHITECTURE-EVALUATION.md` 中提出的 `MarketDtoMapper`、`PriceCalculator`、`SectorNetworkGenerator` 拆分建议

### 兼容性影响

- **无 API 变更**：HTTP 接口、DTO、数据库表结构均无变化
- **无行为变更**：所有方法体保持原样，仅做物理位置迁移
- **测试更新**：`MarketServiceImplTest` 和 `MarketServiceImplBatchPricesTest` 需要更新构造函数注入的 mock/实例子

## Alternatives Considered

1. **保留 MarketServiceSupport，仅提取 Mock 数据常量到单独文件**
   - 拒绝：虽然缓解了常量膨胀，但 DTO 映射、计算、规范化仍然混杂在一起，未解决根本问题
   - 当前方案：彻底按职责拆分

2. **使用 MapStruct 替代手动 DTO 映射**
   - 拒绝：项目目前已在 `mapper/` 包中使用 MapStruct，但市场数据的映射涉及大量业务判断（如字段回退、空值处理、时间戳转换），一次性全部迁移到 MapStruct 风险过高，超出了本次轻量重构的范围
   - 当前方案：先提取为 `MarketDtoMapper`，未来再逐步 MapStruct 化

3. **将新类直接放在 `service/support/` 根目录**
   - 拒绝：`service/support/` 已包含 10+ 个类，继续平铺会加剧导航困难；按领域放入 `support/market/` 更符合刚完成的 Service 层领域分包策略
   - 当前方案：使用 `service/support/market/` 子包

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有现有单元测试与切片测试通过
