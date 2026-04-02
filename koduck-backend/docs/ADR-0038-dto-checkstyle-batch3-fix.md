# ADR-0038: DTO Checkstyle 代码风格修复（Batch 3）

- Status: Accepted
- Date: 2026-04-02
- Issue: #368

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 8 个 DTO 文件存在 Checkstyle 代码风格告警：

1. `PortfolioPositionDto.java`
2. `StockStatsDto.java`
3. `PageResponse.java`
4. `UserInfo.java`
5. `BacktestInterpretResponse.java`
6. `StrategyRecommendResponse.java`
7. `StockAnalysisResponse.java`
8. `PortfolioSummaryDto.java`

### 告警分类

| 告警类型 | 影响文件 | 说明 |
|---------|---------|------|
| `ImportOrder` | PageResponse, UserInfo, BacktestInterpretResponse, StrategyRecommendResponse, StockAnalysisResponse | `com.koduck` 包导入顺序不符合 Alibaba 规范 |
| `JavadocType` | PortfolioPositionDto, StockStatsDto, PortfolioSummaryDto | Java Record 缺少 `@author` 和 `@param` 标签 |
| `JavadocVariable` | 全部 8 个文件 | Builder 及内部类的私有字段缺少 Javadoc 注释 |
| `LeftCurly` | PageResponse, UserInfo | 类、方法、构造器的花括号未放置在前一行 |

## Decision

### 修复范围

统一修复上述 8 个文件中的所有 Checkstyle 告警，确保 `mvn checkstyle:check` 零告警。

### 修复规则

1. **Import 顺序**：按照 Alibaba Java 编码规范，导入顺序为 `java.*` → 第三方包 → `com.koduck.*`。将 `com.koduck` 相关导入从当前位置调整至第三方包（如 `lombok`）之后。

2. **Javadoc 规范（Alibaba）**：
   - Java Record 的类级别 Javadoc 必须为每个组件添加 `@param` 标签，并包含 `@author`
   - 所有类、字段、方法必须添加 Javadoc 注释

3. **LeftCurly 规范**：
   - 类声明、方法声明、控制语句的左花括号必须位于前一行末尾（`eol` 风格）

## Consequences

### 正向影响

- 8 个 DTO 文件通过 Checkstyle 检查
- 代码风格与项目 Alibaba 规范一致
- 为后续 CI 门禁扫清障碍

### 消极影响

- 无功能变化，纯代码风格修复
- 修改文件较多，但均为文档和格式调整

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅调整导入顺序、添加 Javadoc、修复花括号位置 |
| API 接口 | 无 | 类结构和字段完全不变 |
| 序列化 | 无 | 未修改字段和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #368
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0037: IndicatorResponse Checkstyle 代码风格修复
