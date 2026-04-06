# ADR-0031: 测试文件 Checkstyle 告警修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #351

## Context

执行 `mvn -f koduck-backend/pom.xml -DskipTests checkstyle:check` 时发现 koduck-backend 模块的测试文件存在大量代码风格告警：

### 告警统计

涉及 8 个测试文件，主要包括：

| 文件 | 告警类型 |
|------|----------|
| RateLimiterServiceTest.java | ImportOrder, JavadocVariable, MagicNumber |
| ErrorCodeTest.java | ImportOrder, JavadocType, MethodName, MagicNumber |
| DuplicateExceptionTest.java | ImportOrder, JavadocType, MethodName |
| AuthenticationExceptionTest.java | ImportOrder, JavadocType, MethodName |
| ResourceNotFoundExceptionTest.java | ImportOrder, JavadocType, MethodName, MagicNumber |
| ValidationExceptionTest.java | ImportOrder, JavadocType, MethodName |
| BusinessExceptionTest.java | ImportOrder, JavadocType, MethodName, MagicNumber |
| GlobalExceptionHandlerTest.java | ImportOrder, JavadocType, JavadocVariable, MethodName, MagicNumber |

### 具体问题

1. **ImportOrder**: 导入顺序不符合规范（java → javax → org → com）
2. **JavadocType**: 类注释缺少 @author 标签
3. **JavadocVariable**: 字段缺少 Javadoc 注释
4. **MethodName**: 测试方法名包含下划线（如 `fromCode_shouldReturnCorrectEnum`）
5. **MagicNumber**: 使用魔法数字（如 1004, 999999, 123L 等）

这些告警影响代码可读性和维护性，需要在实施硬性 CI 门禁前完成修复。

## Decision

### 修复范围

修复以下 8 个测试文件的 Checkstyle 告警：

| 文件路径 | 主要问题 |
|---------|---------|
| `service/RateLimiterServiceTest.java` | ImportOrder, JavadocVariable, MagicNumber |
| `exception/ErrorCodeTest.java` | ImportOrder, JavadocType, MethodName, MagicNumber |
| `exception/DuplicateExceptionTest.java` | ImportOrder, JavadocType, MethodName |
| `exception/AuthenticationExceptionTest.java` | ImportOrder, JavadocType, MethodName |
| `exception/ResourceNotFoundExceptionTest.java` | ImportOrder, JavadocType, MethodName, MagicNumber |
| `exception/ValidationExceptionTest.java` | ImportOrder, JavadocType, MethodName |
| `exception/BusinessExceptionTest.java` | ImportOrder, JavadocType, MethodName, MagicNumber |
| `exception/GlobalExceptionHandlerTest.java` | ImportOrder, JavadocType, JavadocVariable, MethodName, MagicNumber |

### 修复规则

1. **Import 顺序**: 
   - 顺序: `java.*` → `javax.*` → `org.*` → `com.*`
   - 组间空行分隔
   - 注意: `jakarta.*` 包放在 `com.*` 组之前或作为独立组（根据项目约定）

2. **Javadoc**: 
   - 类注释添加 `@author Koduck Team` 标签
   - 字段添加简洁描述注释（如 `/** 常量定义. */`）

3. **方法命名**:
   - 将 snake_case 方法名改为 camelCase
   - 例如: `fromCode_shouldReturnCorrectEnum` → `fromCodeShouldReturnCorrectEnum`

4. **Magic Number**:
   - **禁止**使用 `@SuppressWarnings("checkstyle:MagicNumber")` 绕过
   - 所有魔法数字必须提取为有意义的常量
   - 常量命名应具有描述性，如 `NOT_FOUND_CODE = 1004`
   - 测试数据中的数字同样适用此规则

### 修复策略

采用手动修复：
- 告警涉及具体业务场景，手动修复更可靠
- 方法重命名需要保持语义清晰
- Magic Number 提取为常量时需要有意义的命名
- 边修复边验证，避免引入新问题

## Consequences

### 正向影响

- 测试文件 Checkstyle 零告警通过
- 代码可读性和维护性提升
- 测试代码中的数据含义更加清晰（通过常量命名）
- 为实施硬性 CI 门禁扫清障碍

### 消极影响

- 修复耗时约 2-3 小时（需要提取大量常量）
- 需要仔细验证不破坏测试功能
- 常量命名需要仔细考虑以保持语义清晰

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和常量提取 |
| 测试功能 | 无 | 仅修改方法名和格式，测试逻辑不变 |
| API 接口 | 无 | 测试文件不影响 API |

## Related

- Issue #351
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0030: DTO 代码风格告警修复
