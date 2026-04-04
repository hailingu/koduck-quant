# ADR-0059: 提取 INDEX 硬编码字符串为 MarketConstants 常量

- Status: Accepted
- Date: 2026-04-04
- Issue: #412

## Context

ARCHITECTURE-EVALUATION.md 中指出：硬编码魔法字符串 "INDEX" 散落在 Service 层（MarketServiceImpl.java 第 406、417 行），建议提取为 MarketConstants 常量。

当前代码：
```java
// MarketServiceImpl.java
List<StockRealtime> indices = stockRealtimeRepository.findBySymbolInAndType(MAIN_INDICES, "INDEX");
List<StockBasic> basicIndices = stockBasicRepository.findBySymbolInAndType(MAIN_INDICES, "INDEX");
```

项目已有 MarketConstants 类定义了 STOCK_TYPE 常量，但缺少对应的 INDEX_TYPE。

## Decision

在 MarketConstants 中添加 INDEX_TYPE 常量，并替换 Service 层中的硬编码字符串。

### 具体变更

1. **MarketConstants.java**: 添加 `INDEX_TYPE` 常量
   ```java
   public static final String INDEX_TYPE = "INDEX";
   ```

2. **MarketServiceImpl.java**: 替换两处硬编码
   - 第 406 行: `"INDEX"` → `MarketConstants.INDEX_TYPE`
   - 第 417 行: `"INDEX"` → `MarketConstants.INDEX_TYPE`

## Consequences

### 正向影响

- **可维护性**：集中管理类型常量，后续修改只需改一处
- **可读性**：`MarketConstants.INDEX_TYPE` 意图比字符串字面量更清晰
- **一致性**：与现有的 `STOCK_TYPE` 常量保持风格统一
- **编译时检查**：避免拼写错误导致的运行时问题

### 兼容性影响

- **无破坏性变更**：常量值仍为 "INDEX"，数据库查询行为不变
- **无 API 变更**：仅内部实现调整，对外接口无影响

## Alternatives Considered

1. **使用枚举类型替代字符串常量**
   - 拒绝：数据库字段类型为 String，改为枚举需要同步修改实体映射和数据库，超出本次轻量修复范围

2. **在 StockType 枚举中定义（如已存在）**
   - 调研发现：项目当前使用字符串常量而非枚举，为保持风格一致，继续使用常量方式

## Verification

- [x] 代码编译通过 (`mvn clean compile`)
- [x] Checkstyle 检查通过
- [x] PMD 检查通过
- [x] SpotBugs 检查通过
- [x] 相关测试通过
