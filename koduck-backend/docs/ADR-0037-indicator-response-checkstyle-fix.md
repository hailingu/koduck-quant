# ADR-0037: IndicatorResponse Checkstyle 代码风格修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #366

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 `IndicatorResponse.java` 存在 Checkstyle 代码风格告警。

### Javadoc 缺失问题

`IndicatorResponse.java` (line 14) 存在 7 处 JavadocType 告警：

- Type Javadoc comment is missing @param symbol tag
- Type Javadoc comment is missing @param market tag
- Type Javadoc comment is missing @param indicator tag
- Type Javadoc comment is missing @param period tag
- Type Javadoc comment is missing @param values tag
- Type Javadoc comment is missing @param trend tag
- Type Javadoc comment is missing @param timestamp tag

`IndicatorResponse` 是一个 Java Record，根据 Alibaba Java 编码规范，Record 的组件需要在类级别 Javadoc 中使用 `@param` 标签进行说明。

## Decision

### 修复范围

修复 `com.koduck.dto.indicator.IndicatorResponse` 类的所有 Checkstyle 告警：

| 问题类型 | 行号 | 修复方式 |
|---------|------|---------|
| JavadocType | 14 | 为 Record 的 7 个组件添加 @param 标签 |

### 修复规则

1. **Javadoc 规范**（Alibaba 规范）：
   - Java Record 的类级别 Javadoc 必须为每个组件添加 `@param` 标签
   - 参数描述应简洁明了，说明该组件的用途

修复示例：
```java
/**
 * Technical indicator response DTO.
 *
 * @param symbol the stock symbol
 * @param market the market identifier
 * @param indicator the indicator name
 * @param period the indicator period
 * @param values the indicator values map
 * @param trend the trend direction
 * @param timestamp the timestamp of the indicator data
 * @author Koduck Team
 */
public record IndicatorResponse(
    String symbol,
    String market,
    String indicator,
    Integer period,
    Map<String, BigDecimal> values,
    String trend,
    LocalDateTime timestamp
) {
```

## Consequences

### 正向影响

- `IndicatorResponse.java` 通过 Checkstyle 检查
- 代码风格与项目规范一致
- 为后续 CI 门禁扫清障碍

### 消极影响

- 无功能变化，纯文档修复

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅添加 Javadoc @param 标签 |
| API 接口 | 无 | 类结构和字段完全不变 |
| 序列化 | 无 | 未修改字段和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #366
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0036: RiskAssessmentResponse Checkstyle 代码风格修复
