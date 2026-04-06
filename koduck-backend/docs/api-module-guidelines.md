# Koduck API 模块编码规范

> **版本**: 1.0.0  
> **日期**: 2026-04-06  
> **状态**: 生效  
> **关联 ADR**: [ADR-0141](./ADR-0141-api-module-guidelines.md)

---

## 目录

1. [概述](#概述)
2. [模块结构规范](#模块结构规范)
3. [接口命名约定](#接口命名约定)
4. [DTO 设计规范](#dto-设计规范)
5. [异常设计规范](#异常设计规范)
6. [ACL 设计原则](#acl-设计原则)
7. [版本管理策略](#版本管理策略)
8. [依赖管理规范](#依赖管理规范)
9. [文档规范](#文档规范)
10. [代码示例](#代码示例)
11. [检查清单](#检查清单)

---

## 概述

本文档定义了 Koduck 后端 API 模块的编码规范。API 模块是 DDD 分层架构中的接口层，负责定义：

- **服务接口**：领域服务的契约
- **DTO**：数据传输对象
- **领域事件**：领域状态变更通知
- **领域异常**：错误处理契约
- **ACL 接口**：防腐层，供其他模块使用

### 设计原则

1. **契约优先**：API 模块是模块间的契约，必须稳定、清晰
2. **不可变性**：DTO 和值对象必须是不可变的
3. **技术无关**：API 模块不依赖具体技术实现（如 Spring Web、JPA）
4. **最小暴露**：只暴露必要的数据和操作

---

## 模块结构规范

所有 API 模块必须遵循以下目录结构：

```
koduck-{domain}-api/
├── pom.xml
└── src/main/java/com/koduck/{domain}/
    ├── api/                          # 服务接口
    │   ├── {Domain}QueryService.java
    │   ├── {Domain}CommandService.java
    │   └── acl/                      # 防腐层接口
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

### 包命名规范

| 包名 | 用途 | 示例 |
|------|------|------|
| `com.koduck.{domain}.api` | 服务接口 | `com.koduck.market.api` |
| `com.koduck.{domain}.api.acl` | 防腐层接口 | `com.koduck.market.api.acl` |
| `com.koduck.{domain}.dto` | DTO | `com.koduck.market.dto` |
| `com.koduck.{domain}.event` | 领域事件 | `com.koduck.market.event` |
| `com.koduck.{domain}.exception` | 领域异常 | `com.koduck.market.exception` |
| `com.koduck.{domain}.vo` | 值对象 | `com.koduck.market.vo` |

---

## 接口命名约定

### 服务接口

| 类型 | 命名模式 | 示例 | 用途 |
|------|----------|------|------|
| 查询服务 | `{Domain}QueryService` | `MarketQueryService` | 只读操作，无副作用 |
| 命令服务 | `{Domain}CommandService` | `PortfolioCommandService` | 写操作，有副作用 |

### 方法命名规范

**查询服务方法**：

| 操作 | 前缀 | 示例 |
|------|------|------|
| 获取单个对象 | `get`, `find` | `getById`, `findBySymbol` |
| 获取列表 | `list`, `getAll` | `listByUserId`, `getAllActive` |
| 检查存在 | `exists` | `existsBySymbol` |
| 计数 | `count` | `countByStatus` |

**命令服务方法**：

| 操作 | 前缀 | 示例 |
|------|------|------|
| 创建 | `create` | `createPortfolio` |
| 更新 | `update` | `updatePortfolio` |
| 删除 | `delete`, `remove` | `deletePortfolio` |
| 执行 | `execute`, `run` | `executeBacktest` |

### ACL 接口命名

| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 数据访问 ACL | `{Domain}DataAcl` | `MarketDataAcl` |
| 查询专用 ACL | `{Domain}QueryService` | `PortfolioQueryService` |

---

## DTO 设计规范

### 不可变性原则

**DTO 必须是不可变对象**，确保：
- 线程安全
- 无副作用
- 易于推理

### 实现方式

**推荐：Java Record（Java 16+）**

```java
/**
 * 行情数据传输对象。
 *
 * @param symbol 股票代码，格式：market.code（如 sz.000001）
 * @param currentPrice 当前价格
 * @param timestamp 数据时间戳
 */
public record MarketDataDto(
    String symbol,
    BigDecimal currentPrice,
    Instant timestamp
) {}
```

**替代：Lombok @Value**

```java
@Value
public class PortfolioSnapshot {
    Long portfolioId;
    String portfolioName;
    BigDecimal totalValue;
}
```

### DTO 命名规范

| 类型 | 后缀 | 示例 | 说明 |
|------|------|------|------|
| 数据传输对象 | `Dto` | `MarketDataDto` | 通用数据传输 |
| 请求对象 | `Request` | `CreatePortfolioRequest` | 命令入参 |
| 响应对象 | `Response` | `PortfolioListResponse` | 查询结果 |
| ACL 值对象 | `Snapshot` | `PortfolioSnapshot` | ACL 专用只读对象 |
| ACL 值对象 | `Summary` | `PortfolioSummary` | ACL 汇总对象 |

### DTO 字段规范

1. **使用包装类型**：`Long` 而非 `long`，`BigDecimal` 而非 `double`
2. **时间类型**：使用 `Instant` 或 `LocalDateTime`
3. **集合类型**：使用不可变集合或 `List`/`Set`/`Map`
4. **验证注解**：使用 `jakarta.validation` 注解

```java
public record CreatePortfolioRequest(
    @NotBlank(message = "组合名称不能为空")
    @Size(max = 100, message = "组合名称不能超过100字符")
    String name,
    
    @Size(max = 500, message = "描述不能超过500字符")
    String description,
    
    @NotNull(message = "初始资金不能为空")
    @Positive(message = "初始资金必须为正数")
    BigDecimal initialCapital
) {}
```

---

## 异常设计规范

### 继承体系

所有领域异常必须继承 `KoduckException`：

```
KoduckException (koduck-common)
├── MarketDataException
├── PortfolioException
├── StrategyException
├── CommunityException
└── AiAnalysisException
```

### 异常类模板

```java
package com.koduck.market.exception;

import com.koduck.exception.ErrorCode;
import com.koduck.exception.KoduckException;

/**
 * 行情数据异常。
 *
 * <p>当行情数据不存在或格式非法时抛出。</p>
 */
public class MarketDataException extends KoduckException {
    
    /**
     * 使用错误消息构造异常。
     *
     * @param message 错误消息
     */
    public MarketDataException(String message) {
        super(ErrorCode.MARKET_DATA_ERROR, message);
    }
    
    /**
     * 使用错误消息和原因构造异常。
     *
     * @param message 错误消息
     * @param cause 原始异常
     */
    public MarketDataException(String message, Throwable cause) {
        super(ErrorCode.MARKET_DATA_ERROR, message, cause);
    }
}
```

### 错误码定义

在 `koduck-common` 的 `ErrorCode` 枚举中定义：

```java
public enum ErrorCode {
    // Market 领域
    MARKET_DATA_ERROR("M001", "行情数据错误"),
    SYMBOL_NOT_FOUND("M002", "股票代码不存在"),
    
    // Portfolio 领域
    PORTFOLIO_NOT_FOUND("P001", "投资组合不存在"),
    INSUFFICIENT_BALANCE("P002", "余额不足"),
    
    // ...
}
```

---

## ACL 设计原则

### 什么是 ACL

ACL（Anti-Corruption Layer，防腐层）用于：
- 隔离不同领域模型
- 防止外部概念污染本领域
- 提供跨模块查询的抽象

### 设计原则

1. **只暴露必要数据**
   ```java
   // 好的做法：只返回需要的数据
   public interface PortfolioQueryService {
       Optional<PortfolioSnapshot> getSnapshot(Long portfolioId);
   }
   
   // 避免：返回完整 DTO 包含敏感信息
   Optional<PortfolioDto> getPortfolio(Long portfolioId);  // 不推荐
   ```

2. **使用不可变值对象**
   ```java
   // 使用 Snapshot 而非完整 Dto
   public record PortfolioSnapshot(
       Long id,
       String name,
       BigDecimal totalValue,
       List<PositionSnapshot> positions
   ) {}
   ```

3. **只读接口**
   - ACL 接口通常只包含查询方法
   - 写操作通过领域服务完成

4. **位置统一**
   - 所有 ACL 接口放在 `api/acl/` 包下

### ACL 接口示例

```java
package com.koduck.market.api.acl;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
     * @return 行情数据快照
     */
    Optional<MarketDataSnapshot> getMarketData(String symbol);
    
    /**
     * 检查股票代码是否存在。
     *
     * @param symbol 股票代码
     * @return 是否存在
     */
    boolean existsSymbol(String symbol);
}
```

---

## 版本管理策略

### 版本号格式

遵循语义化版本（Semantic Versioning）：`x.y.z`

| 位置 | 含义 | 变更时机 |
|------|------|----------|
| `x` | 主版本 | 不兼容的 API 变更 |
| `y` | 次版本 | 向后兼容的功能添加 |
| `z` | 修订版本 | 向后兼容的问题修复 |

### 版本声明

在 `pom.xml` 中声明，与父项目版本保持一致：

```xml
<artifactId>koduck-market-api</artifactId>
<version>0.1.0-SNAPSHOT</version>
```

### 兼容性保证

- **次版本升级**：保证向后兼容
- **主版本升级**：允许破坏性变更，需同步升级依赖方

---

## 依赖管理规范

### 允许的依赖

| 依赖 | 用途 | scope |
|------|------|-------|
| `koduck-common` | 共享工具、异常基类 | compile |
| `jakarta.validation-api` | Bean Validation 注解 | optional |
| `spring-context` | 领域事件支持 | optional |

### 禁止的依赖

| 依赖 | 原因 |
|------|------|
| `spring-web`, `spring-webmvc` | API 模块应保持技术无关 |
| `spring-data-jpa` | 数据访问应在 impl 模块 |
| `mybatis` | 数据访问应在 impl 模块 |
| `*-impl` 模块 | API 模块不依赖实现 |
| 其他 `*-api` 模块 | 通过 ACL 解耦 |

### pom.xml 模板

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-backend-parent</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>

    <artifactId>koduck-market-api</artifactId>
    <name>Koduck Market API</name>
    <description>Market domain API module - interfaces and DTOs</description>
    <packaging>jar</packaging>

    <dependencies>
        <!-- 仅依赖 common，不依赖任何其他模块 -->
        <dependency>
            <groupId>com.koduck</groupId>
            <artifactId>koduck-common</artifactId>
        </dependency>
        
        <!-- 可选：验证注解 -->
        <dependency>
            <groupId>jakarta.validation</groupId>
            <artifactId>jakarta.validation-api</artifactId>
            <optional>true</optional>
        </dependency>
        
        <!-- 可选：领域事件 -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>
</project>
```

---

## 文档规范

### Javadoc 要求

所有公共 API 必须包含完整的 Javadoc：

**类级别**：
```java
/**
 * 行情数据查询服务。
 *
 * <p>提供实时行情、K线数据等查询能力。</p>
 *
 * <p>数据来源于缓存，若缓存未命中则从数据源获取。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface MarketQueryService { }
```

**方法级别**：
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

### 文档元素

| 元素 | 用途 | 必需 |
|------|------|------|
| 类描述 | 说明类的职责 | 是 |
| `@author` | 作者 | 可选 |
| `@since` | 版本 | 推荐 |
| `@param` | 参数说明 | 是 |
| `@return` | 返回值说明 | 是 |
| `@throws` | 异常说明 | 是 |

---

## 代码示例

### 完整 API 模块示例

#### 1. 查询服务接口

```java
package com.koduck.market.api;

import com.koduck.market.dto.MarketDataDto;
import com.koduck.market.dto.KlineDataDto;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 行情数据查询服务。
 *
 * <p>提供实时行情、K线数据等查询能力。</p>
 */
public interface MarketQueryService {
    
    /**
     * 查询指定股票的实时行情。
     *
     * @param symbol 股票代码，格式：market.code（如 sz.000001）
     * @return 行情数据，不存在时返回 Optional.empty()
     * @throws IllegalArgumentException 当 symbol 格式非法时
     */
    Optional<MarketDataDto> getRealTimePrice(@NotNull String symbol);
    
    /**
     * 批量查询行情。
     *
     * @param symbols 股票代码列表
     * @return 行情数据列表
     */
    List<MarketDataDto> getRealTimePrices(@NotNull List<String> symbols);
    
    /**
     * 查询 K 线数据。
     *
     * @param symbol 股票代码
     * @param timeframe 时间周期（1m, 5m, 1d 等）
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return K线数据列表
     */
    List<KlineDataDto> getKlineData(
        @NotNull String symbol,
        @NotNull String timeframe,
        @NotNull Instant startTime,
        @NotNull Instant endTime
    );
}
```

#### 2. 命令服务接口

```java
package com.koduck.portfolio.api;

import com.koduck.portfolio.dto.CreatePortfolioRequest;
import com.koduck.portfolio.dto.PortfolioDto;
import com.koduck.portfolio.dto.UpdatePortfolioRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 投资组合命令服务。
 *
 * <p>提供投资组合的创建、更新、删除等写操作。</p>
 */
public interface PortfolioCommandService {
    
    /**
     * 创建投资组合。
     *
     * @param request 创建请求
     * @return 创建后的投资组合
     */
    PortfolioDto createPortfolio(@Valid @NotNull CreatePortfolioRequest request);
    
    /**
     * 更新投资组合。
     *
     * @param id 投资组合 ID
     * @param request 更新请求
     * @throws PortfolioException 当投资组合不存在时
     */
    void updatePortfolio(
        @NotNull @Positive Long id,
        @Valid @NotNull UpdatePortfolioRequest request
    );
    
    /**
     * 删除投资组合。
     *
     * @param id 投资组合 ID
     * @throws PortfolioException 当投资组合不存在时
     */
    void deletePortfolio(@NotNull @Positive Long id);
}
```

#### 3. DTO（Java Record）

```java
package com.koduck.market.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 行情数据传输对象。
 *
 * <p>不可变对象，使用 Record 定义。</p>
 *
 * @param symbol 股票代码
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

#### 4. ACL 接口

```java
package com.koduck.market.api.acl;

import com.koduck.market.vo.MarketDataSnapshot;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
     * @return 行情数据快照
     */
    Optional<MarketDataSnapshot> getMarketData(String symbol);
}
```

#### 5. 领域事件

```java
package com.koduck.market.event;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 行情数据更新事件。
 *
 * <p>当某只股票的行情数据发生变化时发布。</p>
 *
 * @param symbol 股票代码
 * @param currentPrice 当前价格
 * @param changePercent 涨跌幅
 * @param timestamp 事件时间戳
 */
public record MarketDataUpdatedEvent(
    String symbol,
    BigDecimal currentPrice,
    BigDecimal changePercent,
    Instant timestamp
) {}
```

#### 6. 领域异常

```java
package com.koduck.market.exception;

import com.koduck.exception.ErrorCode;
import com.koduck.exception.KoduckException;

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

---

## 检查清单

创建新的 API 模块时，使用以下检查清单：

### 结构检查

- [ ] 目录结构符合规范（api/, dto/, event/, exception/, vo/）
- [ ] 包名使用 `com.koduck.{domain}` 格式
- [ ] ACL 接口放在 `api/acl/` 子包下

### 接口检查

- [ ] 查询服务使用 `QueryService` 后缀
- [ ] 命令服务使用 `CommandService` 后缀
- [ ] 方法命名符合规范（get/find/list/create/update/delete）
- [ ] 所有公共方法有完整 Javadoc

### DTO 检查

- [ ] 使用 Java Record 或 `@Value` 实现不可变性
- [ ] 命名符合规范（Dto/Request/Response/Snapshot）
- [ ] 使用包装类型（Long, BigDecimal）而非基本类型
- [ ] 时间类型使用 `Instant` 或 `LocalDateTime`

### 异常检查

- [ ] 继承 `KoduckException`
- [ ] 使用 `ErrorCode` 定义错误码
- [ ] 提供带消息和原因的构造方法

### ACL 检查

- [ ] 接口放在 `api/acl/` 包下
- [ ] 返回不可变值对象（Snapshot/Summary）
- [ ] 只包含查询方法（只读）
- [ ] 只暴露必要数据

### 依赖检查

- [ ] 只依赖 `koduck-common`
- [ ] 不依赖任何 `*-impl` 模块
- [ ] 不依赖 `spring-web` 或数据访问层

### 文档检查

- [ ] 所有公共类有 Javadoc
- [ ] 所有公共方法有 Javadoc
- [ ] 包含 `@param`, `@return`, `@throws` 说明

---

## 参考

- [ADR-0141](./ADR-0141-api-module-guidelines.md) - API 模块编码规范决策记录
- [ARCHITECTURE-PLAYBOOK.md](./ARCHITECTURE-PLAYBOOK.md) - 架构改进执行手册
- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md) - 架构改进计划
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html) - 架构测试工具

---

> **提示**: 本文档是活文档，如有建议请提交 Issue 讨论。
