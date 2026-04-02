# ADR-0035: ApiResponse Checkstyle 代码风格修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #362

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 `ApiResponse.java` 存在多处 Checkstyle 代码风格告警：

### Import 顺序问题
- line 10: `lombok.AllArgsConstructor` 导入前有多余分隔
- line 14: `org.slf4j.MDC` 导入顺序错误（应在第三方库组，而非 JDK 组）

### 左大括号位置问题（LeftCurly）
- 类定义、方法定义、控制语句中的 `{` 位于行首，而非行尾
- 共 23 处需要修复，包括：类定义、方法定义、if 语句块、try-catch 块等

这些告警违反了项目的 Alibaba Java 编码规范，影响代码一致性。

## Decision

### 修复范围

修复 `com.koduck.dto.ApiResponse` 类的所有 Checkstyle 告警：

| 问题类型 | 行号 | 修复方式 |
|---------|------|---------|
| ImportOrder | 10 | 移除 lombok 导入前的空行 |
| ImportOrder | 14 | 将 `org.slf4j.MDC` 移至第三方库导入组（与 lombok 同组） |
| LeftCurly | 29 | 类定义 `{` 移至 `public class ApiResponse<T>` 行尾 |
| LeftCurly | 74, 90, 102, ... | 所有方法定义 `{` 移至行尾 |
| LeftCurly | 209, 213 | try-catch 块 `{` 移至行尾 |
| LeftCurly | 233, 237 | if-else 块 `{` 移至行尾 |

### 修复规则

1. **Import 顺序**（Alibaba 规范）：
   - 顺序: `java.*` → `javax.*` → 第三方库 → 项目内部
   - 组间空行分隔，组内不空行

2. **左大括号位置**（Alibaba 规范）：
   - 在行尾，不独占一行
   - 前有空格，如 `public void method() {`

## Consequences

### 正向影响

- ApiResponse.java 通过 Checkstyle 检查
- 代码风格与项目规范一致
- 为后续 CI 门禁扫清障碍

### 消极影响

- 无功能变化，纯格式修复

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和 import 顺序 |
| API 接口 | 无 | 类结构和字段完全不变 |
| 序列化 | 无 | 未修改字段和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #362
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
