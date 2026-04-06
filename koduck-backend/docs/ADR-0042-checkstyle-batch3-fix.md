# ADR-0042: 后端核心文件 Checkstyle 告警修复 - Batch 3

- Status: Accepted
- Date: 2026-04-02
- Issue: #376

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 koduck-backend 模块的 6 个核心文件存在代码风格告警，涵盖测试文件和主代码文件：

### 告警统计

| 文件 | 告警类型 |
|------|----------|
| `MarketServiceImplBatchPricesTest.java` | ImportOrder, JavadocType, JavadocVariable, Indentation, WhitespaceAround, OneStatementPerLine |
| `PortfolioControllerIntegrationTest.java` | JavadocVariable, MagicNumber, MethodLength |
| `UserControllerIntegrationTest.java` | ImportOrder, JavadocType, Indentation, JavadocVariable |
| `CommunitySignalControllerTest.java` | ImportOrder, JavadocType, JavadocVariable, MagicNumber |
| `BacktestServiceImpl.java` | AvoidStarImport, ImportOrder, JavadocType, JavadocVariable, RightCurly, MagicNumber |
| `AKShareDataProvider.java` | ImportOrder, UnusedImports, LeftCurly, JavadocVariable |

### 具体问题

1. **ImportOrder**: 导入顺序不符合规范（java → javax → org → com），组间未空行分隔
2. **JavadocVariable**: 字段缺少 Javadoc 注释
3. **JavadocType**: 类注释缺少 `@author` 标签，或包含不支持的 `@date` 标签
4. **Indentation**: 缩进层级不正确（部分使用 6/8/16 空格而非 4 空格）
5. **MagicNumber**: 使用魔法数字（如 100, 1500.00, 60, 252 等）
6. **MethodLength**: `portfolioEndToEndFlow` 方法超过 80 行限制
7. **LeftCurly/RightCurly**: 大括号位置不规范（Allman 风格未改为行尾风格）
8. **WhitespaceAround/OneStatementPerLine**: 空白符和单行多语句问题
9. **AvoidStarImport**: 使用通配符导入
10. **UnusedImports**: 存在未使用的导入

这些告警影响代码可读性和维护性，需要在实施硬性 CI 门禁前完成修复。

## Decision

### 修复范围

修复以下 6 个文件的 Checkstyle 告警：

| 文件路径 | 主要问题 |
|---------|---------|
| `test/.../service/MarketServiceImplBatchPricesTest.java` | ImportOrder, Javadoc, Indentation, Whitespace |
| `test/.../controller/PortfolioControllerIntegrationTest.java` | JavadocVariable, MagicNumber, MethodLength |
| `test/.../controller/UserControllerIntegrationTest.java` | ImportOrder, Javadoc, Indentation |
| `test/.../controller/CommunitySignalControllerTest.java` | ImportOrder, Javadoc, MagicNumber |
| `main/.../trading/application/BacktestServiceImpl.java` | StarImport, ImportOrder, Javadoc, MagicNumber, RightCurly |
| `main/.../service/market/AKShareDataProvider.java` | ImportOrder, UnusedImport, LeftCurly, Javadoc |

### 修复规则

1. **Import 顺序**:
   - 顺序: `java.*` → `javax.*` → `org.*` → `com.*`
   - 组间空行分隔
   - 移除未使用的导入和通配符导入

2. **Javadoc**:
   - 移除不支持的 `@date` 标签
   - 类注释添加 `@author Koduck Team` 标签
   - 字段添加简洁描述注释

3. **大括号风格**:
   - `AKShareDataProvider.java` 中的 Allman 风格统一改为行尾风格（K&R）
   - 修复 `RightCurly` 告警（`}` 应独占一行）

4. **Magic Number**:
   - 所有魔法数字提取为私有静态常量
   - 常量命名应具有描述性，如 `DEFAULT_QUANTITY = 100`
   - 测试文件和主代码中的业务常量均适用此规则

5. **缩进**:
   - 统一使用 4 空格缩进
   - 修复字段、方法体和构造函数的缩进不一致问题

6. **方法长度**:
   - `portfolioEndToEndFlow` 提取辅助方法，将方法体控制在 80 行以内

### 修复策略

采用手动修复：
- 告警涉及具体业务场景和数值含义，手动修复更可靠
- Magic Number 提取为常量时需要有意义的命名
- 边修复边验证，避免引入新问题

## Consequences

### 正向影响

- 6 个核心文件 Checkstyle 零告警通过
- 代码可读性和维护性提升
- 业务数值含义更加清晰（通过常量命名）
- 为实施硬性 CI 门禁扫清障碍

### 消极影响

- 修复耗时约 1-2 小时（涉及测试和主代码）
- 需要仔细验证不破坏测试功能和业务逻辑
- 常量命名需要仔细考虑以保持语义清晰

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和常量提取，不改变计算逻辑 |
| 测试功能 | 无 | 仅修改方法结构和格式，测试断言不变 |
| API 接口 | 无 | 不涉及接口变更 |

## Related

- Issue #376
- ADR-0041: 测试文件 Checkstyle 告警修复 - Batch 2
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
