# ADR-0034: 编译错误修复与测试文件 Checkstyle 告警修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #360

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 发现两类问题：

### 1. 编译错误 (18个)

问题根源：Mapper 和 Service 层引用了 DTO 中未定义的字段和内部类。

| 错误类型 | 影响文件 | 具体问题 |
|---------|---------|---------|
| 字段缺失 | CredentialResponse | 缺少 `apiSecretMasked` 字段 |
| 字段缺失 | CredentialDetailResponse | 缺少 `apiSecret` 字段 |
| 内部类缺失 | UpdateSettingsRequest | 缺少 `LlmConfigDto`, `ProviderConfigDto`, `MemoryConfigDto`, `NotificationConfigDto`, `TradingConfigDto`, `DisplayConfigDto`, `QuickLinkDto` |
| 内部类缺失 | UserSettingsDto | 缺少 `LlmConfigDto`, `ProviderConfigDto`, `MemoryConfigDto` |

### 2. Checkstyle 告警 (测试文件)

主要涉及以下测试文件：
- `MarketServiceImplTest.java`
- `MarketServiceImplBatchPricesTest.java`
- `PortfolioServiceTest.java`
- `USStockProviderTest.java`

主要问题类型：
- **Indentation**: 缩进级别不正确
- **ImportOrder**: 导入顺序不符合规范 (java → javax → org → com → com.koduck)
- **JavadocType**: 类注释缺少 `@author` 标签
- **JavadocVariable**: 字段缺少 Javadoc 注释
- **MagicNumber**: 魔法数字未定义为常量
- **OneStatementPerLine**: 一行多语句
- **WhitespaceAround**: 操作符周围缺少空格
- **AvoidStarImport**: 避免使用 `.*` 导入

## Decision

### 修复策略

#### 1. DTO 字段补充

在 `CredentialResponse` 和 `CredentialDetailResponse` 中添加缺失字段：

```java
// CredentialResponse
/** API Secret（脱敏）. */
private String apiSecretMasked;

// CredentialDetailResponse  
/** API Secret. */
private String apiSecret;
```

#### 2. 内部类定义

在 `UpdateSettingsRequest` 和 `UserSettingsDto` 中添加缺失的内部静态类，使用 Lombok 的 `@Builder` 和 `@Data` 注解简化代码：

```java
@Data
@Builder
public static class LlmConfigDto {
    private String provider;
    private String apiKey;
    private String apiBase;
    private ProviderConfigDto minimax;
    private ProviderConfigDto deepseek;
    private ProviderConfigDto openai;
    private MemoryConfigDto memory;
}

@Data
@Builder
public static class ProviderConfigDto {
    private String apiKey;
    private String apiBase;
}

@Data
@Builder
public static class MemoryConfigDto {
    private Boolean enabled;
    private String mode;
    private Boolean enableL1;
    private Boolean enableL2;
    private Boolean enableL3;
}
```

类似地添加 `NotificationConfigDto`, `TradingConfigDto`, `DisplayConfigDto`, `QuickLinkDto`。

#### 3. 测试文件格式化

按照 Google Java Style 修复：
- 修正缩进级别（2空格或4空格统一）
- 调整导入顺序
- 添加缺失的 Javadoc 注释
- 将魔法数字提取为常量
- 分离一行多语句
- 修复空格问题

### 不修复的内容

- 业务逻辑相关的 MagicNumber（需要深入理解业务场景）
- 测试方法的复杂重构（仅修复格式问题）

## Consequences

### 正向影响

- 项目可以无错误编译
- 代码风格统一，符合 Google Java Style
- 通过 Checkstyle 检查，为 CI 门禁创造条件
- DTO 结构完整，支持 LLM 配置等复杂功能

### 消极影响

- 测试文件变更较多，可能影响正在进行的测试开发
- DTO 内部类较多，增加文件体积

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | DTO 增加字段，不影响已有接口 |
| 业务逻辑 | 无 | 仅添加缺失的定义和格式化 |
| 测试 | 无 | 仅修复格式，不影响测试逻辑 |
| 数据库 | 无 | 不涉及实体变更 |

## Related

- Issue #360
- ADR-0030/0031/0032/0033: 前期 Checkstyle 修复记录
