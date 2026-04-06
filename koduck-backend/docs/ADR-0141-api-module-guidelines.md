# ADR-0141: API 模块编码规范

- Status: Accepted
- Date: 2026-04-06
- Issue: #614

## Context

随着 Phase 1 架构改进的推进，我们已经成功创建了多个 API 模块：

- `koduck-market-api`
- `koduck-portfolio-api`
- `koduck-strategy-api`
- `koduck-community-api`
- `koduck-ai-api`

这些模块遵循 DDD 分层架构中的 API 层设计，仅包含接口、DTO、领域事件和异常定义。然而，目前缺乏统一的编码规范文档，导致：

1. **风格不一致**：不同模块的接口命名、DTO 设计存在差异
2. **维护困难**：新成员难以快速理解 API 模块的设计原则
3. **代码审查成本高**：缺乏明确的规范作为审查依据
4. **架构退化风险**：无文档约束可能导致 API 模块引入不当依赖

### 当前问题示例

**问题 1：接口命名不统一**
```java
// koduck-market-api
public interface MarketQueryService { }

// koduck-portfolio-api (旧代码)
public interface PortfolioService { }  // 缺少 Query/Command 区分
```

**问题 2：DTO 可变性不一致**
```java
// 好的实践：使用 Record
public record MarketDataDto(...) { }

// 需要改进：使用可变类
public class PortfolioDto {  // 应该改为 Record 或 @Value
    private String name;
    // setter 方法存在
}
```

**问题 3：ACL 接口位置不统一**
```java
// 有的放在 api/acl/ 包下
com.koduck.market.api.acl.MarketDataAcl

// 有的直接放在 api/ 包下
com.koduck.portfolio.api.PortfolioQueryService  // 应该移到 acl/ 子包
```

## Decision

### 1. 模块结构规范

所有 API 模块必须遵循以下目录结构：

```
koduck-{domain}-api/
├── pom.xml
└── src/main/java/com/koduck/{domain}/
    ├── api/                          # 服务接口
    │   ├── {Domain}QueryService.java        # 查询接口
    │   ├── {Domain}CommandService.java      # 命令接口
    │   └── acl/                      # 防腐层接口（供其他模块使用）
    │       └── {Domain}DataAcl.java
    ├── dto/                          # 数据传输对象
    │   ├── {Domain}Dto.java
    │   └── ...
    ├── event/                        # 领域事件
    │   └── {Domain}Event.java
    ├── exception/                    # 领域异常
    │   └── {Domain}Exception.java
    └── vo/                           # 值对象（可选）
        └── {Domain}Snapshot.java
```

### 2. 接口命名约定

| 类型 | 命名模式 | 示例 | 用途 |
|------|----------|------|------|
| 查询服务 | `{Domain}QueryService` | `MarketQueryService` | 只读操作，无副作用 |
| 命令服务 | `{Domain}CommandService` | `PortfolioCommandService` | 写操作，有副作用 |
| ACL 接口 | `{Domain}DataAcl` / `{Domain}QueryService` | `MarketDataAcl` | 跨模块查询 |

**查询服务示例**：
```java
public interface MarketQueryService {
    Optional<MarketDataDto> getRealTimePrice(String symbol);
    List<MarketDataDto> getRealTimePrices(List<String> symbols);
}
```

**命令服务示例**：
```java
public interface PortfolioCommandService {
    PortfolioDto createPortfolio(CreatePortfolioRequest request);
    void updatePortfolio(Long id, UpdatePortfolioRequest request);
    void deletePortfolio(Long id);
}
```

### 3. DTO 设计规范

**原则**：DTO 必须是**不可变对象**

**推荐方式**：使用 Java Record（Java 16+）

```java
/**
 * 行情数据传输对象。
 *
 * <p>不可变对象，使用 Record 定义。</p>
 *
 * @param symbol 股票代码，格式：market.code（如 sz.000001）
 * @param currentPrice 当前价格
 * @param openPrice 开盘价
 * @param highPrice 最高价
 * @param lowPrice 最低价
 * @param volume 成交量
 * @param timestamp 数据时间戳
 */
public record MarketDataDto(
    String symbol,
    BigDecimal currentPrice,
    BigDecimal openPrice,
    BigDecimal highPrice,
    BigDecimal lowPrice,
    Long volume,
    Instant timestamp
) {}
```

**替代方式**：使用 Lombok `@Value`

```java
@Value
public class PortfolioSnapshot {
    Long portfolioId;
    String portfolioName;
    BigDecimal totalValue;
    List<PositionSnapshot> positions;
}
```

**DTO 命名规范**：

| 类型 | 后缀 | 示例 |
|------|------|------|
| 数据传输对象 | `Dto` | `MarketDataDto` |
| 请求对象 | `Request` | `CreatePortfolioRequest` |
| 响应对象 | `Response` | `PortfolioListResponse` |
| ACL 专用值对象 | `Snapshot` / `Summary` | `PortfolioSnapshot` |

### 4. 异常设计规范

所有领域异常必须继承 `KoduckException`（定义在 `koduck-common`）：

```java
/**
 * 行情数据异常。
 *
 * <p>当行情数据不存在或格式非法时抛出。</p>
 */
public class MarketDataException extends KoduckException {
    
    public MarketDataException(String message) {
        super(ErrorCode.MARKET_DATA_ERROR, message);
    }
    
    public MarketDataException(String message, Throwable cause) {
        super(ErrorCode.MARKET_DATA_ERROR, message, cause);
    }
}
```

### 5. ACL 设计原则

**定义**：ACL（Anti-Corruption Layer，防腐层）用于隔离不同领域模型，防止外部概念污染本领域。

**设计原则**：

1. **只暴露必要数据**：ACL 接口应只返回调用方需要的最小数据集
2. **使用不可变值对象**：返回 `Snapshot` 或 `Summary` 而非完整 `Dto`
3. **只读接口**：ACL 接口通常只包含查询方法，不写操作
4. **位置统一**：所有 ACL 接口放在 `api/acl/` 包下

**ACL 接口示例**：

```java
package com.koduck.market.api.acl;

/**
 * 行情数据防腐层接口。
 *
 * <p>供其他领域模块查询行情数据使用。</p>
 */
public interface MarketDataAcl {
    
    /**
     * 批量获取最新价格。
     *
     * <p>用于投资组合计算持仓市值。</p>
     *
     * @param symbols 股票代码列表
     * @return 代码到价格的映射
     */
    Map<String, BigDecimal> getLatestPrices(List<String> symbols);
    
    /**
     * 获取单只股票最新行情。
     *
     * @param symbol 股票代码
     * @return 行情数据，不存在时返回 Optional.empty()
     */
    Optional<MarketDataSnapshot> getMarketData(String symbol);
}
```

### 6. 版本管理策略

API 模块的版本遵循以下规则：

1. **版本号格式**：`x.y.z`（语义化版本）
   - `x`：主版本，不兼容的 API 变更
   - `y`：次版本，向后兼容的功能添加
   - `z`：修订版本，向后兼容的问题修复

2. **版本声明**：在 `pom.xml` 中声明，与父项目版本保持一致
   ```xml
   <version>0.1.0-SNAPSHOT</version>
   ```

3. **兼容性保证**：
   - 次版本升级：保证向后兼容
   - 主版本升级：允许破坏性变更，需升级依赖方

### 7. 依赖管理规范

API 模块的依赖必须遵循以下规则：

**允许的依赖**：
- `koduck-common`：共享工具、异常基类
- `jakarta.validation`：Bean Validation 注解
- `spring-context`：领域事件支持（optional）

**禁止的依赖**：
- Spring Web（`spring-web`, `spring-webmvc`）
- 数据访问层（`spring-data-jpa`, `mybatis`）
- 其他 `*-impl` 模块
- 其他 `*-api` 模块（通过 ACL 解耦）

**pom.xml 模板**：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project>
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-backend-parent</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    
    <artifactId>koduck-{domain}-api</artifactId>
    <name>Koduck {Domain} API</name>
    <description>{Domain} domain API module - interfaces and DTOs</description>
    
    <dependencies>
        <!-- 仅依赖 common，不依赖任何其他模块 -->
        <dependency>
            <groupId>com.koduck</groupId>
            <artifactId>koduck-common</artifactId>
        </dependency>
        
        <!-- 可选：仅用于领域事件 -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <optional>true</optional>
        </dependency>
        
        <!-- 可选：验证注解 -->
        <dependency>
            <groupId>jakarta.validation</groupId>
            <artifactId>jakarta.validation-api</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

### 8. 文档规范

所有公共 API 必须包含完整的 Javadoc：

```java
/**
 * 查询指定股票的实时行情。
 *
 * <p>数据来源于缓存，若缓存未命中则从数据源获取。</p>
 *
 * @param symbol 股票代码，格式：market.code（如 sz.000001）
 * @return 行情数据，不存在时返回 Optional.empty()
 * @throws IllegalArgumentException 当 symbol 格式非法时
 * @throws MarketDataException 当数据源访问失败时
 */
Optional<MarketDataDto> getRealTimePrice(@NotNull String symbol);
```

**Javadoc 要求**：
- 类级别：说明类的职责和使用场景
- 方法级别：说明方法功能、参数、返回值、异常
- 参数：使用 `@param` 说明每个参数的含义和约束
- 异常：使用 `@throws` 说明每种异常的产生条件

## Consequences

### 正向影响

1. **一致性**：所有 API 模块遵循统一的结构和命名规范
2. **可维护性**：新成员可以快速理解和贡献代码
3. **架构守护**：明确的规范作为 ArchUnit 测试的依据
4. **降低沟通成本**：代码审查时有明确的规范依据
5. **提升代码质量**：不可变 DTO、清晰接口边界减少 Bug

### 代价与风险

1. **学习成本**：团队成员需要学习并适应新规范
2. **存量代码改造**：部分现有代码需要调整以符合规范
3. **审查严格度增加**：初期可能增加代码审查时间

### 兼容性影响

- **现有 API 模块**：需要进行一次规范化调整
- **后续开发**：所有新 API 模块必须遵循此规范
- **ArchUnit 测试**：将基于此规范编写架构守护规则

## Alternatives Considered

1. **保持现状，仅口头约定**
   - 拒绝：无法保证一致性，难以传承
   - 当前方案：形成文档化规范，强制执行

2. **使用自动化工具生成规范**
   - 拒绝：工具无法覆盖所有设计决策
   - 当前方案：文档化规范 + ArchUnit 自动化检查

3. **每个模块独立制定规范**
   - 拒绝：会导致模块间风格差异
   - 当前方案：统一规范，允许领域特定扩展

## Implementation

### 交付物

1. **ADR-0141**: 本决策记录文档
2. **api-module-guidelines.md**: 详细的编码规范文档（含示例）

### 验证清单

- [x] 规范文档已创建
- [x] 文档包含完整的代码示例
- [x] 文档涵盖所有 API 模块类型
- [x] 质量检查脚本通过
- [x] 代码编译通过

## References

- [ARCHITECTURE-PLAYBOOK.md](./ARCHITECTURE-PLAYBOOK.md) - 架构改进执行手册
- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md) - 架构改进计划
- [ADR-0082](./ADR-0082-maven-multi-module-refactoring.md) - Maven 多模块重构
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) - 架构测试工具
