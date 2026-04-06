# ADR-0144: 统一配置管理

- Status: Accepted
- Date: 2026-04-06
- Issue: #620

## Context

随着 Phase 3 架构改进的推进，各业务领域模块已拆分完成：

- `koduck-market-impl`
- `koduck-portfolio-impl`
- `koduck-community-impl`
- `koduck-ai-impl`

当前配置管理存在以下问题：

### 1. 配置集中化

所有配置集中在 `koduck-bootstrap` 的 `application.yml`，导致：
- 模块无法独立演进配置
- 配置变更需要修改 bootstrap 模块
- 模块专属配置与其他配置混杂

### 2. 硬编码配置值

```java
// AiAnalysisServiceImpl.java
private static final String DEFAULT_LLM_PROVIDER = "openai";
private static final int DEFAULT_TIMEOUT = 30000;
```

### 3. 配置重复

各模块可能定义相同的配置项（如缓存 TTL），导致重复和冲突。

### 4. 环境差异

不同环境（dev/test/prod）的配置切换不够灵活。

## Decision

### 1. 配置分层架构

采用 Spring Boot 的多配置文件机制，实现配置分层：

```
koduck-bootstrap/src/main/resources/
├── application.yml              # 基础配置 + 组装
├── application-dev.yml          # 开发环境
├── application-test.yml         # 测试环境
└── application-prod.yml         # 生产环境

koduck-market/koduck-market-impl/src/main/resources/
└── application-market.yml       # 行情模块配置

koduck-portfolio/koduck-portfolio-impl/src/main/resources/
└── application-portfolio.yml    # 组合模块配置

koduck-ai/koduck-ai-impl/src/main/resources/
└── application-ai.yml           # AI模块配置
```

### 2. Bootstrap 配置组装

```yaml
# koduck-bootstrap/application.yml
spring:
  profiles:
    include: market, portfolio, ai
  
  # 基础配置
  application:
    name: koduck-backend
    version: 0.1.0
```

### 3. 模块专属配置

#### koduck-market-impl

```yaml
# application-market.yml
koduck:
  market:
    cache:
      price-ttl: 30s
      kline-ttl: 60s
      hot-stocks-ttl: 60s
    provider:
      default: akshare
      timeout: 10000
    indicators:
      default-period: 14
```

#### koduck-portfolio-impl

```yaml
# application-portfolio.yml
koduck:
  portfolio:
    cache:
      price-ttl: 30s
      snapshot-ttl: 300s
    calculation:
      max-positions: 100
      price-precision: 4
```

#### koduck-ai-impl

```yaml
# application-ai.yml
koduck:
  ai:
    llm:
      default-provider: openai
      timeout: 30000
      max-retries: 3
    analysis:
      enabled: true
      auto-analyze-new-portfolio: true
```

### 4. 配置属性类

使用 `@ConfigurationProperties` 类型安全地绑定配置：

```java
package com.koduck.market.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "koduck.market")
public class MarketProperties {
    
    private CacheConfig cache = new CacheConfig();
    private ProviderConfig provider = new ProviderConfig();
    
    @Data
    public static class CacheConfig {
        private String priceTtl = "30s";
        private String klineTtl = "60s";
        private String hotStocksTtl = "60s";
    }
    
    @Data
    public static class ProviderConfig {
        private String defaultProvider = "akshare";
        private int timeout = 10000;
    }
}
```

### 5. 配置启用

```java
package com.koduck.market.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MarketProperties.class)
public class MarketConfig {
    // 配置类
}
```

### 6. 替换硬编码常量

**替换前**：
```java
@Service
public class AiAnalysisServiceImpl {
    private static final String DEFAULT_LLM_PROVIDER = "openai";
    private static final int DEFAULT_TIMEOUT = 30000;
    
    public void analyze() {
        String provider = DEFAULT_LLM_PROVIDER;
        int timeout = DEFAULT_TIMEOUT;
        // ...
    }
}
```

**替换后**：
```java
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl {
    private final AiProperties aiProperties;
    
    public void analyze() {
        String provider = aiProperties.getLlm().getDefaultProvider();
        int timeout = aiProperties.getLlm().getTimeout();
        // ...
    }
}
```

### 7. 配置验证

使用 JSR-303 注解验证配置值：

```java
@Data
@ConfigurationProperties(prefix = "koduck.ai")
public class AiProperties {
    
    @NotNull
    @Pattern(regexp = "openai|anthropic|local")
    private String defaultProvider = "openai";
    
    @Min(1000)
    @Max(60000)
    private int timeout = 30000;
    
    @Min(1)
    @Max(5)
    private int maxRetries = 3;
}
```

### 8. 配置文档

每个配置类添加 JavaDoc 说明：

```java
/**
 * AI 模块配置属性。
 *
 * <p>配置前缀: {@code koduck.ai}</p>
 *
 * <p>示例配置:</p>
 * <pre>
 * koduck:
 *   ai:
 *     llm:
 *       default-provider: openai
 *       timeout: 30000
 * </pre>
 */
@Data
@ConfigurationProperties(prefix = "koduck.ai")
public class AiProperties {
    // ...
}
```

## Consequences

### 正向影响

1. **模块独立**：各模块可独立管理自己的配置
2. **配置外部化**：无硬编码配置值，支持环境差异
3. **类型安全**：使用 `@ConfigurationProperties` 避免拼写错误
4. **IDE 支持**：配置属性有自动补全和验证
5. **文档化**：配置类即文档，易于理解

### 代价与风险

1. **配置分散**：配置分布在多个文件中，需要了解整体结构
2. **命名冲突**：需要规范命名前缀避免冲突
3. **迁移成本**：需要修改现有代码替换硬编码值

### 兼容性影响

- **现有配置**：保留 `application.yml` 中的通用配置
- **环境变量**：继续支持 `APP_*` 环境变量覆盖
- **配置优先级**：遵循 Spring Boot 配置优先级规则

## Alternatives Considered

1. **使用 Spring Cloud Config**
   - 拒绝：引入外部依赖，增加复杂度
   - 当前方案：使用本地配置文件，满足当前需求

2. **使用数据库配置**
   - 拒绝：配置变更需要重启，数据库配置增加复杂度
   - 当前方案：配置文件 + 环境变量

3. **保持现状**
   - 拒绝：配置集中化不利于模块独立演进
   - 当前方案：配置分层，各模块独立

## Implementation

### 交付物

1. **ADR-0144**: 本决策记录
2. **application-market.yml**: 行情模块配置
3. **application-portfolio.yml**: 组合模块配置
4. **application-ai.yml**: AI 模块配置
5. **MarketProperties.java**: 行情配置属性类
6. **PortfolioProperties.java**: 组合配置属性类
7. **AiProperties.java**: AI 配置属性类
8. **配置类更新**: 替换硬编码常量

### 验证清单

- [x] 各模块配置独立
- [x] 无硬编码配置值
- [x] 启动时配置加载正确
- [x] 质量检查脚本全绿
- [x] 代码编译通过

## References

- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md) - Task 3.4
- [Spring Boot Externalized Configuration](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config) - Spring 外部化配置
- [Type-safe Configuration Properties](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config.typesafe-configuration-properties) - 类型安全配置
