# ADR-0044: 后端多模块 Checkstyle 告警修复 - Batch 5

- Status: Accepted
- Date: 2026-04-02
- Issue: #380

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 koduck-backend 模块存在大量残余代码风格告警，涵盖 DTO、Entity、Repository、Service、Controller、Config 及工具类，共影响约 290 个文件。

### 告警分类

| 告警类型 | 主要影响范围 | 说明 |
|---------|-------------|------|
| `ImportOrder` | `dto.*`, `entity.*`, `repository.*`, `service.*`, `config.*`, `util.*` | `java.*`/`javax.*`、第三方库、`com.koduck.*` 顺序错误或组间未空行分隔 |
| `JavadocType` | `dto.*`, `entity.*`, `repository.*` | 类/接口/Record 注释缺少 `@author` 标签或缺少 `@param` |
| `JavadocVariable` | `dto.*`, `entity.*`, `config.*` | 私有字段、Builder 内部字段缺少 Javadoc 注释 |
| `JavadocMethod` | `repository.*`, `service.*`, `util.*` | 方法注释缺少 `@param`、`@return` 或 `@throws` |
| `LeftCurly` | `dto.profile.*`, `dto.user.*` 等 | 类/方法/控制语句的左花括号未放置在前一行末尾 |
| `MagicNumber` | `dto.user.UserPageRequest` 等 | 魔法数字未提取为常量 |
| `LineLength` | `repository.*`, `service.*` | 行长度超过 120 字符 |

这些告警阻碍了硬性 CI 门禁的实施，需要在批次修复计划中完成清零。

## Decision

### 修复范围

本次 Batch 5 统一修复剩余文件中高密度的 Checkstyle 告警，重点覆盖：

- **DTO 层**: `com.koduck.dto.ai.*`、`com.koduck.dto.auth.*`、`com.koduck.dto.market.*`、`com.koduck.dto.portfolio.*`、`com.koduck.dto.profile.*`、`com.koduck.dto.user.*`、`com.koduck.dto.websocket.*`
- **Entity 层**: `com.koduck.entity.*`
- **Repository 层**: `com.koduck.repository.*`
- **Service / Application 层**: `com.koduck.identity.application.*`、`com.koduck.market.application.*`、`com.koduck.shared.application.*`、`com.koduck.strategy.application.*`、`com.koduck.trading.application.*`
- **配置与工具**: `com.koduck.config.*`、`com.koduck.util.*`

### 修复规则

1. **Import 顺序（Alibaba 规范）**
   - 顺序: `java.*` → `javax.*` → 第三方库 → `com.koduck.*`
   - 组间必须空一行分隔

2. **Javadoc 规范**
   - 所有公共类/接口/Record 添加 `@author Koduck Team`
   - Record 组件参数使用 `@param` 说明
   - 所有公共/受保护字段添加简洁 Javadoc 注释
   - 所有公共方法补充 `@param`、`@return`、`@throws`（如适用）
   - 移除不支持的 `@date` 标签

3. **代码格式**
   - 左花括号采用 `eol` 风格（位于前一行末尾）
   - 行长度 ≤ 120 字符，超长 SQL/HQL/字符串进行合理换行
   - 魔法数字提取为具名常量

4. **其他**
   - 避免星号导入 (`AvoidStarImport`)
   - 统一 4 空格缩进

### 修复策略

采用手动修复而非全自动化：
- Javadoc 涉及语义描述，手动编写可确保文档价值
- Repository 中的长 SQL 需要结合语义换行，手动处理更可靠
- 边修复边执行 `mvn checkstyle:check` 验证，确保零告警

## Consequences

### 正向影响

- 大幅减少 koduck-backend 的 Checkstyle 告警基数
- 代码风格与项目 Alibaba 规范保持一致
- 为后续实施 CI 硬性门禁扫清障碍

### 消极影响

- 修改文件数量较多，评审 diff 较大
- 修复耗时约 2-4 小时
- 需要确保格式化改动不破坏编译和测试

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅调整导入顺序、添加 Javadoc、修复格式 |
| API 接口 | 无 | DTO/Entity 字段和类型完全不变 |
| 序列化 | 无 | 未修改字段名和注解 |
| 数据库 | 无 | 未修改实体映射关系 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #380
- ADR-0043: 后端 DTO 与 Repository Checkstyle 告警修复 - Batch 4
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
