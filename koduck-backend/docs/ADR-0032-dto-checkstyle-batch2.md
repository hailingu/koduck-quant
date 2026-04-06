# ADR-0032: DTO 文件 Checkstyle 告警修复（Batch 2）

- Status: Accepted
- Date: 2026-04-02
- Issue: #354

## Context

合并 PR #352 和 #353 后，koduck-backend 仍有大量 Checkstyle 告警需要修复。执行 `mvn checkstyle:check` 显示共有 **6404 个 WARN 级别告警**。

### 告警统计

主要涉及以下 DTO 包：

| 包路径 | 主要文件 |
|--------|----------|
| dto/websocket | SubscriptionMessage, WebSocketMessage |
| dto/indicator | IndicatorResponse, IndicatorListResponse |
| dto/auth | RegisterRequest, LoginRequest, TokenResponse 等 |
| dto/user | UserDetailResponse, UpdateUserRequest 等 |
| dto/backtest | BacktestResultDto, BacktestTradeDto 等 |
| dto/ai | StockAnalysisResponse, BacktestInterpretResponse 等 |
| dto/community | SignalResponse, CreateSignalRequest 等 |
| dto/profile | ProfileResponse, UpdateProfileRequest 等 |
| dto/common | PageResponse |

### 主要问题类型

1. **ImportOrder**: 导入顺序不符合规范（应为 java → javax → com.fasterxml → lombok → com.koduck）
2. **JavadocType**: 类注释缺少 @author 标签
3. **JavadocVariable**: 字段缺少 Javadoc 注释
4. **JavadocMethod**: 方法缺少 @param/@return 标签
5. **LeftCurly**: 左大括号位置不规范（应独占一行）
6. **OneStatementPerLine**: 一行多语句（常见于 Lombok Builder）
7. **LineLength**: 行长度超过 120 字符

## Decision

### 修复策略

由于文件数量较多，采用**批量修复**策略：

1. **按包分组修复**：一次处理一个包的所有文件
2. **优先级**：先修复导入顺序和 Javadoc，再处理格式问题
3. **Builder 模式处理**：对于 Lombok Builder 的一行多语句问题，暂时保持原样（需要大量重构）或添加 @SuppressWarnings

### 修复规则

1. **Import 顺序**:
   ```java
   import java.*;
   import javax.*;
   
   import com.fasterxml.*;
   
   import lombok.*;
   
   import com.koduck.*;
   ```

2. **Javadoc 规范**:
   - 类注释：`@author Koduck Team`
   - 字段注释：`/** 字段描述. */`
   - 方法注释：包含 `@param` 和 `@return`

3. **代码格式**:
   - 左大括号独占一行
   - 行长度 ≤ 120 字符
   - 每行一条语句

### 不修复的内容

以下问题暂不修复（影响范围太大或需要业务理解）：
- 方法参数和返回值的详细 Javadoc 描述（仅添加标签框架）
- Builder 模式的复杂重构
- 业务逻辑相关的 MagicNumber

## Consequences

### 正向影响

- DTO 包 Checkstyle 告警大幅减少
- 代码可读性和维护性提升
- 统一代码风格

### 消极影响

- 修复工作量大（约 30+ 个文件）
- 部分文件需要大量格式化调整
- 可能引入意外的格式错误

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释 |
| API 接口 | 无 | DTO 字段和类型保持不变 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #354
- ADR-0030: DTO 代码风格告警修复（Batch 1）
- ADR-0031: 测试文件 Checkstyle 告警修复
