# ADR-0033: Entity、Service、Controller 等模块 Checkstyle 告警修复（Batch 3）

- Status: Accepted
- Date: 2026-04-02
- Issue: #356

## Context

合并 PR #355 后，koduck-backend 仍有大量 Checkstyle 告警需要修复。执行 `mvn checkstyle:check` 显示共有 **5792 个 WARN 级别告警**。

### 告警统计

主要涉及以下模块：

| 模块 | 主要文件 |
|------|----------|
| entity | CommunitySignal, UserCredential, UserSettings, SignalComment, DataSourceStatus, MemoryChatMessage, BacktestResult |
| service | MarketSentimentServiceImpl, USStockProvider, CommunitySignalService, MonitoringService |
| controller | MonitoringController, MarketAdvancedController, MarketController |
| market/application | TechnicalIndicatorServiceImpl, MarketSentimentServiceImpl |
| repository | CommunitySignalRepository |
| exception | ErrorCode.java |
| dto/community | SignalResponse.java |

### 主要问题类型

1. **ImportOrder**: 导入顺序不符合规范
2. **JavadocType**: 类注释缺少 @author 标签
3. **JavadocVariable**: 字段缺少 Javadoc 注释
4. **JavadocMethod**: 方法缺少 @param/@return 标签
5. **LeftCurly**: 左大括号位置不规范
6. **OneStatementPerLine**: 一行多语句
7. **LineLength**: 行长度超过 120 字符
8. **MagicNumber**: 使用魔法数字

## Decision

### 修复策略

采用**按模块分组修复**策略：

1. **entity 包**：JPA 实体类，需要为字段添加 Javadoc
2. **service 包**：业务逻辑类，需要修复导入顺序和方法 Javadoc
3. **controller 包**：控制器类，需要修复导入顺序和注释
4. **market/application 包**：市场数据处理类
5. **repository 包**：数据访问层
6. **exception 包**：异常类

### 修复规则

1. **Import 顺序**: java → javax → org → com → com.koduck
2. **类 Javadoc**: @author Koduck Team
3. **字段 Javadoc**: /** 字段描述. */
4. **方法 Javadoc**: 包含 @param 和 @return
5. **代码格式**: 左大括号独占一行，行长度 ≤ 120

### 不修复的内容

- 业务逻辑复杂的 MagicNumber（需要业务理解）
- 第三方库生成的代码注释

## Consequences

### 正向影响

- 核心模块代码风格统一
- 代码可读性和维护性提升
- 为实施 CI 门禁创造条件

### 消极影响

- 修复工作量大（涉及多个模块）
- 可能影响正在开发的功能分支

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释 |
| API 接口 | 无 | 不影响接口定义 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #356
- ADR-0030/0031/0032: 前期 Checkstyle 修复记录
