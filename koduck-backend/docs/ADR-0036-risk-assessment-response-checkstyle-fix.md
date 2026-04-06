# ADR-0036: RiskAssessmentResponse Checkstyle 代码风格修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #364

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 `RiskAssessmentResponse.java` 存在多处 Checkstyle 代码风格告警：

### Import 顺序问题
- line 10: `com.koduck.util.CollectionCopyUtils` 导入顺序错误，应位于第三方库（如 `lombok`）导入组之后，符合 Alibaba 规范的项目内部导入顺序

### Javadoc 缺失问题
- line 152-160: `RiskAssessmentResponse.Builder` 的 9 个字段缺少 Javadoc
- line 349-353: `RiskBreakdown.Builder` 的 5 个字段缺少 Javadoc
- line 471-474: `RiskMetric.Builder` 的 4 个字段缺少 Javadoc
- line 575-578: `RiskAlert.Builder` 的 4 个字段缺少 Javadoc
- line 679-682: `RiskManagementSuggestion.Builder` 的 4 个字段缺少 Javadoc

共计 26 处 `JavadocVariable` 告警，违反了项目的 Alibaba Java 编码规范。

## Decision

### 修复范围

修复 `com.koduck.dto.ai.RiskAssessmentResponse` 类的所有 Checkstyle 告警：

| 问题类型 | 行号 | 修复方式 |
|---------|------|---------|
| ImportOrder | 10 | 将 `com.koduck.util.CollectionCopyUtils` 移至 `lombok` 导入组之后 |
| JavadocVariable | 152-160 | 为 `RiskAssessmentResponse.Builder` 的 9 个字段添加 Javadoc |
| JavadocVariable | 349-353 | 为 `RiskBreakdown.Builder` 的 5 个字段添加 Javadoc |
| JavadocVariable | 471-474 | 为 `RiskMetric.Builder` 的 4 个字段添加 Javadoc |
| JavadocVariable | 575-578 | 为 `RiskAlert.Builder` 的 4 个字段添加 Javadoc |
| JavadocVariable | 679-682 | 为 `RiskManagementSuggestion.Builder` 的 4 个字段添加 Javadoc |

### 修复规则

1. **Import 顺序**（Alibaba 规范）：
   - 顺序: `java.*` → `javax.*` → 第三方库 → 项目内部
   - 组间空行分隔，组内不空行

2. **Javadoc 规范**：
   - 所有类字段必须添加 Javadoc 注释
   - Builder 模式中的内部字段同样适用此规范

## Consequences

### 正向影响

- `RiskAssessmentResponse.java` 通过 Checkstyle 检查
- 代码风格与项目规范一致
- 为后续 CI 门禁扫清障碍

### 消极影响

- 无功能变化，纯格式与文档修复

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改 import 顺序和添加 Javadoc |
| API 接口 | 无 | 类结构和字段完全不变 |
| 序列化 | 无 | 未修改字段和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #364
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0035: ApiResponse Checkstyle 代码风格修复
