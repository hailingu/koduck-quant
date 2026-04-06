# ADR-0041: 测试文件 Checkstyle 告警修复 - Batch 2

- Status: Accepted
- Date: 2026-04-02
- Issue: #374

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 koduck-backend 模块的测试文件存在大量代码风格告警：

### 告警统计

涉及 5 个测试文件，主要包括：

| 文件 | 告警类型 |
|------|----------|
| MarketServiceImplTest.java | ImportOrder, Indentation, MagicNumber, LineLength |
| AiAnalysisServiceImplTest.java | ImportOrder, JavadocVariable, MagicNumber, LineLength |
| AuthServicePasswordResetTest.java | ImportOrder, AvoidStarImport, Indentation, MagicNumber |
| AiAnalysisControllerTest.java | ImportOrder, Indentation, JavadocVariable, MagicNumber, LineLength |
| MarketControllerTest.java | ImportOrder, AvoidStarImport, Indentation, JavadocVariable, MethodName, MagicNumber, LineLength |

### 具体问题

1. **ImportOrder**: 导入顺序不符合规范（java → javax → org → com）
2. **Indentation**: 方法缩进不正确（部分方法使用8空格而非4空格）
3. **JavadocVariable**: 字段缺少 Javadoc 注释
4. **MagicNumber**: 使用魔法数字（如 20, 100, 999L 等）
5. **LineLength**: 行长度超过120字符
6. **MethodName**: 测试方法名包含下划线（如 `searchSymbols_shouldReturnResults`）
7. **AvoidStarImport**: 使用通配符导入（如 `import static org.mockito.Mockito.*`）

这些告警影响代码可读性和维护性，需要在实施硬性 CI 门禁前完成修复。

## Decision

### 修复范围

修复以下 5 个测试文件的 Checkstyle 告警：

| 文件路径 | 主要问题 |
|---------|---------|
| `service/MarketServiceImplTest.java` | ImportOrder, Indentation, MagicNumber, LineLength |
| `service/AiAnalysisServiceImplTest.java` | ImportOrder, JavadocVariable, MagicNumber, LineLength |
| `service/AuthServicePasswordResetTest.java` | ImportOrder, AvoidStarImport, Indentation, MagicNumber |
| `controller/AiAnalysisControllerTest.java` | ImportOrder, Indentation, JavadocVariable, MagicNumber, LineLength |
| `controller/MarketControllerTest.java` | ImportOrder, AvoidStarImport, Indentation, JavadocVariable, MethodName, MagicNumber, LineLength |

### 修复规则

1. **Import 顺序**: 
   - 顺序: `java.*` → `javax.*` → `org.*` → `com.*`
   - 组间空行分隔
   - 避免使用通配符导入（`.*`）

2. **Javadoc**: 
   - 类注释添加 `@author Koduck Team` 标签
   - 字段添加简洁描述注释（如 `/** 服务依赖. */`）

3. **方法命名**:
   - 将 snake_case 方法名改为 camelCase
   - 例如: `searchSymbols_shouldReturnResults` → `searchSymbolsShouldReturnResults`

4. **Magic Number**:
   - **禁止**使用 `@SuppressWarnings("checkstyle:MagicNumber")` 绕过
   - 所有魔法数字必须提取为有意义的常量
   - 常量命名应具有描述性，如 `DEFAULT_PAGE_SIZE = 20`
   - 测试数据中的数字同样适用此规则

5. **缩进**:
   - 统一使用 4 空格缩进
   - 修复方法定义和方法体缩进不一致问题

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

- Issue #374
- ADR-0031: 测试文件 Checkstyle 告警修复
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
