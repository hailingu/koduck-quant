# ADR-0039: DTO Checkstyle 代码风格修复（Batch 4）

- Status: Accepted
- Date: 2026-04-02
- Issue: #370

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 10 个 DTO 文件存在 Checkstyle 代码风格告警：

1. `ChatStreamRequest.java`
2. `TradeDto.java`
3. `DailyNetFlowDto.java`
4. `KlineDataDto.java`
5. `StockIndustryDto.java`
6. `StockValuationDto.java`
7. `CapitalRiverDto.java`
8. `UpdateSignalRequest.java`
9. `CommentResponse.java`
10. `SignalResponse.java`

### 告警分类

| 告警类型 | 影响文件 | 说明 |
|---------|---------|------|
| `ImportOrder` | ChatStreamRequest, DailyNetFlowDto, UpdateSignalRequest, CommentResponse, SignalResponse | 导入顺序不符合 Alibaba 规范 |
| `AvoidStarImport` | UpdateSignalRequest | 使用了 `.*` 形式的导入 |
| `JavadocType` | TradeDto, DailyNetFlowDto, KlineDataDto, StockIndustryDto, StockValuationDto, CapitalRiverDto, UpdateSignalRequest, CommentResponse | 缺少 `@author` 标签，Record 缺少 `@param` 标签 |
| `JavadocVariable` | 全部 10 个文件 | Builder 及内部类的私有字段缺少 Javadoc 注释 |
| `Indentation` | CapitalRiverDto | Record 紧凑构造函数缩进不正确 |
| `OneStatementPerLine` | UpdateSignalRequest | Builder 方法一行多个语句 |
| `LeftCurly` | UpdateSignalRequest | 类、方法的花括号未放置在前一行 |

## Decision

### 修复范围

统一修复上述 10 个文件中的所有 Checkstyle 告警，确保 `mvn checkstyle:check` 零告警。

### 修复规则

1. **Import 顺序**：按照 Alibaba Java 编码规范，导入顺序为 `java.*` → 第三方包 → `com.koduck.*`。

2. **避免星号导入**：将 `jakarta.validation.constraints.*` 展开为具体类导入。

3. **Javadoc 规范（Alibaba）**：
   - Java Record 的类级别 Javadoc 必须为每个组件添加 `@param` 标签，并包含 `@author`
   - 所有类、字段、方法必须添加 Javadoc 注释

4. **缩进规范**：
   - 使用 4 个空格缩进
   - Record 紧凑构造函数缩进保持一致

5. **代码格式**：
   - 每行只能有一个语句
   - 类声明、方法声明的左花括号必须位于前一行末尾（`eol` 风格）

## Consequences

### 正向影响

- 10 个 DTO 文件通过 Checkstyle 检查
- 代码风格与项目 Alibaba 规范一致
- 为后续 CI 门禁扫清障碍

### 消极影响

- 无功能变化，纯代码风格修复
- 修改文件较多，但均为文档和格式调整

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅调整导入顺序、添加 Javadoc、修复格式 |
| API 接口 | 无 | 类结构和字段完全不变 |
| 序列化 | 无 | 未修改字段和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #370
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0038: DTO Checkstyle 代码风格修复（Batch 3）
