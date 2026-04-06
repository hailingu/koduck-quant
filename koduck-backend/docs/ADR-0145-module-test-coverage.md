# ADR-0145: 模块测试覆盖率提升

- Status: Accepted
- Date: 2026-04-06
- Issue: #622

## Context

随着架构改进的推进，各业务领域模块已拆分完成。当前测试覆盖情况：

| 模块 | 当前状态 | 目标覆盖率 | 缺口 |
|------|---------|-----------|------|
| koduck-market-impl | 基础测试 | 60% | 需补充 Service 测试 |
| koduck-portfolio-impl | 部分测试 | 60% | 需补充 Repository 测试 |
| koduck-ai-impl | 少量测试 | 50% | 需补充算法测试 |
| koduck-community-impl | 基础测试 | 50% | 需补充集成测试 |

### 当前问题

1. **测试分散**：测试主要集中在 koduck-core 和 koduck-bootstrap
2. **覆盖率不足**：部分模块未达到 JaCoCo 60% 门禁要求
3. **缺乏独立测试**：模块无法独立运行 `mvn test` 验证
4. **测试类型单一**：缺少切片测试和集成测试

## Decision

### 1. 测试分层策略

采用三层测试架构：

```
┌─────────────────────────────────────────────────────────────┐
│  Unit Test (单元测试)                                        │
│  - 范围：单个类/方法                                         │
│  - 依赖：全部 Mock                                           │
│  - 速度：快 (< 100ms)                                        │
│  - 占比：40%                                                 │
├─────────────────────────────────────────────────────────────┤
│  Slice Test (切片测试)                                       │
│  - 范围：Service + Repository                                │
│  - 依赖：H2 内存数据库                                       │
│  - 速度：中 (< 1s)                                           │
│  - 占比：30%                                                 │
├─────────────────────────────────────────────────────────────┤
│  Integration Test (集成测试)                                 │
│  - 范围：完整请求链路                                        │
│  - 依赖：TestContainers                                      │
│  - 速度：慢 (> 1s)                                           │
│  - 占比：10%                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2. 各模块测试策略

#### koduck-market-impl

| 测试类型 | 测试类 | 说明 |
|---------|--------|------|
| Unit | MarketServiceImplTest | 行情服务逻辑 |
| Unit | StockCacheServiceTest | 缓存逻辑 |
| Slice | KlineDataRepositoryTest | K线数据访问 |

#### koduck-portfolio-impl

| 测试类型 | 测试类 | 说明 |
|---------|--------|------|
| Unit | PortfolioCommandServiceImplTest | 组合命令服务 |
| Unit | PortfolioPriceServiceTest | 价格服务 |
| Slice | PortfolioPositionRepositoryTest | 持仓数据访问 |

#### koduck-ai-impl

| 测试类型 | 测试类 | 说明 |
|---------|--------|------|
| Unit | AiAnalysisServiceImplTest | AI 分析算法 |
| Unit | RiskCalculatorTest | 风险计算 |

#### koduck-community-impl

| 测试类型 | 测试类 | 说明 |
|---------|--------|------|
| Unit | SignalCommandServiceTest | 信号命令服务 |
| Slice | SignalRepositoryTest | 信号数据访问 |
| Integration | SignalControllerIntegrationTest | 信号 API 集成 |

### 3. 测试基类

#### 单元测试基类

```java
package com.koduck.market;

import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 单元测试基类。
 */
@ExtendWith(MockitoExtension.class)
public abstract class AbstractUnitTest {
    // 公共工具方法
}
```

#### 切片测试基类

```java
package com.koduck.market;

import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Repository 切片测试基类。
 */
@DataJpaTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
public abstract class AbstractSliceTest {
    // 公共配置
}
```

### 4. 测试命名规范

遵循 `should{Expected}_when{Condition}` 模式：

```java
@Test
void shouldReturnCachedPrice_whenPriceExistsInCache() { }

@Test
void shouldFetchFromDataSource_whenCacheMiss() { }

@Test
void shouldThrowException_whenSymbolNotFound() { }
```

### 5. JaCoCo 配置

各模块 `pom.xml` 配置：

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>**/config/**</exclude>
            <exclude>**/entity/**</exclude>
            <exclude>**/dto/**</exclude>
        </excludes>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit>
                        <counter>INSTRUCTION</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.60</minimum>
                    </limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</plugin>
```

### 6. 测试数据管理

使用 Test Fixtures：

```java
package com.koduck.market.fixtures;

public class MarketDataFixtures {
    
    public static PriceQuoteDto createPriceQuoteDto() {
        return new PriceQuoteDto(
            "AAPL",
            new BigDecimal("150.00"),
            // ...
        );
    }
}
```

## Consequences

### 正向影响

1. **质量保证**：覆盖率达标，减少回归 Bug
2. **模块独立**：各模块可独立验证
3. **快速反馈**：单元测试快速发现问题
4. **重构安全网**：测试保护重构
5. **文档价值**：测试用例作为 API 使用示例

### 代价与风险

1. **开发时间**：编写测试需要额外 20-30% 时间
2. **维护成本**：测试代码需要随业务代码同步维护
3. **构建时间**：测试增加 CI 构建时间

### 兼容性影响

- **现有测试**：保留并补充
- **CI/CD**：增加测试阶段
- **覆盖率报告**：模块级 + 聚合报告

## Alternatives Considered

1. **仅保留集成测试**
   - 拒绝：反馈慢，定位问题困难
   - 当前方案：分层测试

2. **100% 覆盖率**
   - 拒绝：成本过高，边际收益递减
   - 当前方案：60% 核心模块，50% 辅助模块

3. **使用 TestContainers 进行所有测试**
   - 拒绝：运行慢，开发体验差
   - 当前方案：单元测试用 H2，集成测试用 TestContainers

## Implementation

### 交付物

1. **ADR-0145**: 本决策记录
2. **新增测试类**:
   - koduck-market-impl: 3+ 个测试类
   - koduck-portfolio-impl: 3+ 个测试类
   - koduck-ai-impl: 2+ 个测试类
   - koduck-community-impl: 3+ 个测试类
3. **测试基类**: AbstractUnitTest, AbstractSliceTest
4. **Test Fixtures**: 测试数据工厂

### 验证清单

- [x] 各模块 `mvn test` 独立通过
- [x] 整体覆盖率 ≥ 60%
- [x] 质量检查脚本全绿
- [x] 代码编译通过

## References

- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md) - Task 4.2
- [JaCoCo Documentation](https://www.jacoco.org/jacoco/trunk/doc/) - 覆盖率工具
- [Spring Boot Testing](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.testing) - Spring 测试文档
