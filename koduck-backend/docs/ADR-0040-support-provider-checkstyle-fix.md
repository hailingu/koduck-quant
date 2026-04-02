# ADR-0040: Support/Provider 类 Checkstyle 代码风格修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #372

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 6 个 Support/Provider 类存在大量 Checkstyle 代码风格告警，影响 CI 门禁和代码规范一致性。

涉及文件：

1. `com.koduck.service.support.MarketServiceSupport`
2. `com.koduck.service.support.AiStreamRelaySupport`
3. `com.koduck.service.support.UserSettingsLlmConfigSupport`
4. `com.koduck.service.support.AiRecommendationSupport`
5. `com.koduck.service.support.AiConversationSupport`
6. `com.koduck.service.market.USStockProvider`

### 问题汇总

| 问题类型 | 说明 | 影响文件 |
|---------|------|---------|
| ImportOrder | 导入顺序不符合 Alibaba 规范（java.* 应在 com.* 之后，第三方库分组需空行分隔） | 全部 6 个 |
| JavadocVariable | `private static final` 常量缺少 Javadoc 注释 | 全部 6 个 |
| JavadocType | 类级别 Javadoc 包含未知标签 `@date` | 3 个 |
| LeftCurly | 左花括号 `{` 未与声明语句位于同一行 | 2 个 |
| RightCurly | 右花括号 `}` 未单独占一行 | 3 个 |
| LineLength | 代码行超过 120 字符限制 | 3 个 |
| MagicNumber | 方法体中出现未命名的魔法数字 | 1 个 |
| UnusedImports | 存在未使用的导入 | 1 个 |

## Decision

### 修复策略

采用**纯代码风格修复**，不涉及任何业务逻辑变更：

1. **导入规范化**：按 Alibaba 规范重新排序并添加分组空行（com.koduck → java → lombok → org.springframework → 其他第三方库）。
2. **Javadoc 补全**：为所有 `private static final` 常量添加简洁的 Javadoc 注释。
3. **删除非法标签**：移除 Javadoc 中的 `@date` 标签（项目规范不认可该标签）。
4. **花括号格式化**：
   - `LeftCurly`：将类、方法、控制语句的 `{` 移至声明语句同一行末尾。
   - `RightCurly`：将 `}` 单独放置在一行。
5. **行长度控制**：对超过 120 字符的行进行合理换行或参数提取。
6. **魔法数字消除**：将方法中出现的字面量提取为具名常量。
7. **清理未使用导入**：删除 `USStockProvider` 中未使用的 `org.springframework.lang.NonNull`。

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅格式化与注释调整 |
| API 接口 | 无 | 未修改任何公共签名 |
| 测试 | 无 | 测试用例无需修改 |
| 编译 | 无 | 仅风格调整，无语法变化 |

## Consequences

### 正向影响

- 6 个目标文件全部通过 Checkstyle 检查。
- 代码风格与项目 Alibaba Checkstyle 规范保持一致。
- 为后续 CI 门禁和代码审查扫清障碍。

### 消极影响

- 无。本次变更为纯代码风格修复，零功能影响。

## Related

- Issue #372
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
- ADR-0037: IndicatorResponse Checkstyle 代码风格修复
