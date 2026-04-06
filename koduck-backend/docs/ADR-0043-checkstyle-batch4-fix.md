# ADR-0043: 后端 DTO 与 Repository Checkstyle 告警修复 - Batch 4

- Status: Accepted
- Date: 2026-04-02
- Issue: #378

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 koduck-backend 模块的 7 个核心文件存在代码风格告警，涵盖 DTO 和 Repository 层：

### 告警统计

| 文件 | 告警类型 |
|------|----------|
| `DailyBreadthDto.java` | ImportOrder, JavadocType |
| `AlertRuleRequest.java` | JavadocType (Unknown tag 'date', missing @param) |
| `SignalListResponse.java` | ImportOrder, JavadocType, JavadocVariable |
| `UserSignalStatsRepository.java` | ImportOrder, JavadocType, JavadocMethod |
| `StrategyVersionRepository.java` | ImportOrder, JavadocType, JavadocMethod |
| `StrategyRepository.java` | ImportOrder, JavadocType, JavadocMethod, LineLength |
| `BacktestResultRepository.java` | ImportOrder, JavadocType, JavadocMethod |

### 具体问题

1. **ImportOrder**: 导入顺序不符合规范（`java.*` → `javax.*` → `org.*` → `com.*`），组间未空行分隔
2. **JavadocType**: 类注释缺少 `@author` 标签，或包含不支持的 `@date` 标签
3. **JavadocVariable**: 字段缺少 Javadoc 注释
4. **JavadocMethod**: 方法注释缺少 `@param` 和 `@return` 标签
5. **LineLength**: `StrategyRepository.java` 中第 56 行 SQL 超过 120 字符限制

这些告警影响代码可读性和维护性，需要在实施硬性 CI 门禁前完成修复。

## Decision

### 修复范围

修复以下 7 个文件的 Checkstyle 告警：

| 文件路径 | 主要问题 |
|---------|---------|
| `dto/market/DailyBreadthDto.java` | ImportOrder, JavadocType |
| `dto/monitoring/AlertRuleRequest.java` | JavadocType (@date tag, @param) |
| `dto/community/SignalListResponse.java` | ImportOrder, JavadocType, JavadocVariable |
| `repository/UserSignalStatsRepository.java` | ImportOrder, JavadocType, JavadocMethod |
| `repository/StrategyVersionRepository.java` | ImportOrder, JavadocType, JavadocMethod |
| `repository/StrategyRepository.java` | ImportOrder, JavadocType, JavadocMethod, LineLength |
| `repository/BacktestResultRepository.java` | ImportOrder, JavadocType, JavadocMethod |

### 修复规则

1. **Import 顺序**:
   - 顺序: `java.*` → `javax.*` → `org.*` → `com.*`
   - 组间空行分隔

2. **Javadoc**:
   - 移除不支持的 `@date` 标签
   - 类注释添加 `@author Koduck Team` 标签
   - 字段添加简洁描述注释
   - Repository 方法补充 `@param` 和 `@return` 说明

3. **代码格式**:
   - 行长度 ≤ 120 字符，超长 SQL/HQL 进行合理换行

### 修复策略

采用手动修复：
- 告警涉及 Javadoc 描述，手动修复可确保文档语义准确
- Repository 中的长 SQL 需要结合语义进行换行，手动处理更可靠
- 边修复边验证，避免引入新问题

## Consequences

### 正向影响

- 7 个核心文件 Checkstyle 零告警通过
- 代码可读性和维护性提升
- 为实施硬性 CI 门禁扫清障碍

### 消极影响

- 修复耗时约 30-60 分钟
- 需要仔细验证不破坏编译和测试功能

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释 |
| API 接口 | 无 | DTO 字段和类型保持不变 |
| 序列化 | 无 | 未修改字段名和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #378
- ADR-0042: 后端核心文件 Checkstyle 告警修复 - Batch 3
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
