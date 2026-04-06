# ADR-0142: 模块独立测试补充

- Status: Accepted
- Date: 2026-04-06
- Issue: #616

## Context

随着 Phase 2 架构改进的推进，各业务领域模块已完成接口提取和实现迁移：

- `koduck-market-impl`
- `koduck-portfolio-impl`
- `koduck-community-impl`
- `koduck-ai-impl`

然而，各模块的测试覆盖情况存在显著不足：

| 模块 | 当前测试数 | 覆盖率目标 | 缺口 |
|------|-----------|-----------|------|
| koduck-market-impl | 1 | 60% | 需补充 Service、Repository 测试 |
| koduck-portfolio-impl | 2 | 60% | 需补充更多场景覆盖 |
| koduck-community-impl | 0 | 50% | 需新建完整测试套件 |
| koduck-ai-impl | 0 | 50% | 需新建完整测试套件 |
| koduck-strategy | 0 | 60% | 需新建完整测试套件 |

### 当前问题

1. **测试分散**：大部分测试集中在 `koduck-core` 和 `koduck-bootstrap`，模块独立测试能力不足
2. **覆盖率不达标**：各 impl 模块未达到 JaCoCo 覆盖率门禁要求
3. **模块独立验证困难**：无法单独运行 `mvn test` 验证单个模块
4. **回归风险**：缺乏模块级测试，重构时容易引入问题

## Decision

### 1. 测试分层策略

采用三层测试架构：

```
┌─────────────────────────────────────────────────────────────┐
│  Unit Test (单元测试)                                        │
│  - 测试范围：单个类/方法                                      │
│  - 依赖：全部 Mock                                            │
│  - 运行速度：快 (< 100ms)                                     │
│  - 覆盖率目标：60%                                            │
├─────────────────────────────────────────────────────────────┤
│  Slice Test (切片测试)                                       │
│  - 测试范围：Service + Repository 层                         │
│  - 依赖：内存数据库 (H2)                                      │
│  - 运行速度：中 (< 1s)                                        │
│  - 覆盖率目标：20%                                            │
├─────────────────────────────────────────────────────────────┤
│  Integration Test (集成测试)                                 │
│  - 测试范围：完整请求链路                                     │
│  - 依赖：TestContainers (PostgreSQL, Redis, RabbitMQ)        │
│  - 运行速度：慢 (> 1s)                                        │
│  - 覆盖率目标：10%                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. 各模块测试策略

#### koduck-market-impl

| 测试类 | 类型 | 说明 |
|--------|------|------|
| `MarketServiceImplTest` | Unit | 行情服务核心逻辑 |
| `KlineServiceTest` | Unit | K线数据处理 |
| `StockCacheServiceTest` | Unit | 缓存逻辑 |
| `TechnicalIndicatorServiceTest` | Unit | 技术指标计算 |
| `MarketRepositoryTest` | Slice | Repository 数据访问 |

#### koduck-portfolio-impl

| 测试类 | 类型 | 说明 |
|--------|------|------|
| `PortfolioCommandServiceImplTest` | Unit | 补充已有测试 |
| `PortfolioQueryServiceImplTest` | Unit | 补充已有测试 |
| `PortfolioPriceServiceTest` | Unit | 价格计算逻辑 |
| `PortfolioPositionRepositoryTest` | Slice | 持仓数据访问 |

#### koduck-community-impl

| 测试类 | 类型 | 说明 |
|--------|------|------|
| `SignalCommandServiceTest` | Unit | 信号发布/更新/删除 |
| `CommentCommandServiceTest` | Unit | 评论 CRUD |
| `LikeCommandServiceTest` | Unit | 点赞/取消点赞 |
| `SignalRepositoryTest` | Slice | 信号数据访问 |

#### koduck-ai-impl

| 测试类 | 类型 | 说明 |
|--------|------|------|
| `AiAnalysisServiceImplTest` | Unit | AI 分析逻辑（Mock LLM） |
| `AiModuleConfigTest` | Unit | 配置加载 |

### 3. 测试基础设施

#### 3.1 基础测试类

每个模块创建 `AbstractUnitTest` 和 `AbstractSliceTest`：

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

#### 3.2 测试配置

各模块 `pom.xml` 添加测试依赖：

```xml
<dependencies>
    <!-- 已有依赖 -->
    
    <!-- 测试依赖 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### 4. Mock 策略

#### 4.1 LLM 服务 Mock

```java
@Mock
private WebClient webClient;

@Mock
private WebClient.RequestBodyUriSpec requestBodyUriSpec;

@Test
void analyzePortfolio_shouldReturnAnalysisResult() {
    // Given
    when(webClient.post()).thenReturn(requestBodyUriSpec);
    when(requestBodyUriSpec.uri(anyString())).thenReturn(...);
    
    // When
    AiAnalysisResult result = aiAnalysisService.analyze(request);
    
    // Then
    assertThat(result).isNotNull();
    assertThat(result.getRecommendation()).isNotEmpty();
}
```

#### 4.2 Repository Mock

```java
@ExtendWith(MockitoExtension.class)
class SignalCommandServiceTest {
    
    @Mock
    private SignalRepository signalRepository;
    
    @InjectMocks
    private SignalCommandServiceImpl signalCommandService;
    
    @Test
    void createSignal_shouldSaveAndReturnSignal() {
        // Given
        CreateSignalRequest request = new CreateSignalRequest("AAPL", "BUY", ...);
        when(signalRepository.save(any())).thenReturn(mockSignal);
        
        // When
        SignalDto result = signalCommandService.createSignal(request);
        
        // Then
        assertThat(result).isNotNull();
        verify(signalRepository).save(any());
    }
}
```

### 5. 测试命名规范

遵循 `should{Expected}_when{Condition}` 模式：

```java
@Test
void shouldReturnCachedPrice_whenPriceExistsInCache() { }

@Test
void shouldFetchFromDataSource_whenCacheMiss() { }

@Test
void shouldThrowException_whenSymbolNotFound() { }
```

### 6. 覆盖率配置

各模块 `pom.xml` 配置 JaCoCo：

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>**/config/**</exclude>
            <exclude>**/entity/**</exclude>
        </excludes>
    </configuration>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Consequences

### 正向影响

1. **模块独立验证**：各模块可独立运行 `mvn test` 验证
2. **快速反馈**：单元测试运行快，开发反馈周期短
3. **覆盖率达标**：满足 JaCoCo 60% 门禁要求
4. **重构安全网**：模块重构时有测试保护
5. **文档价值**：测试用例作为 API 使用示例

### 代价与风险

1. **开发时间**：编写测试需要额外 20-30% 开发时间
2. **维护成本**：测试代码需要随业务代码同步维护
3. **Mock 复杂性**：复杂依赖的 Mock 设置繁琐
4. **测试数据管理**：需要维护测试 fixtures

### 兼容性影响

- **现有测试**：保留 `koduck-core` 和 `koduck-bootstrap` 的集成测试
- **CI/CD**：各模块测试并行执行，缩短总构建时间
- **覆盖率报告**：模块级报告 + 聚合报告

## Alternatives Considered

1. **仅在 koduck-bootstrap 保留集成测试**
   - 拒绝：反馈慢，定位问题困难
   - 当前方案：分层测试，各模块独立

2. **使用 TestContainers 进行所有测试**
   - 拒绝：运行慢，开发体验差
   - 当前方案：单元测试用 H2，集成测试用 TestContainers

3. **每个模块 80% 覆盖率**
   - 拒绝：成本过高，边际收益递减
   - 当前方案：60% 核心模块，50% 辅助模块

## Implementation

### 交付物

1. **ADR-0142**: 本决策记录
2. **新增测试类**:
   - koduck-market-impl: 5+ 个测试类
   - koduck-portfolio-impl: 3+ 个测试类
   - koduck-community-impl: 4+ 个测试类
   - koduck-ai-impl: 2+ 个测试类

### 验证清单

- [x] 各模块 `mvn test` 独立通过
- [x] JaCoCo 报告达到覆盖率目标
- [x] 质量检查脚本全绿
- [x] 代码编译通过

## References

- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md) - Task 2.10
- [Testing Guide](../docs/testing-guide.md) - 测试指南
- [JaCoCo Documentation](https://www.jacoco.org/jacoco/trunk/doc/) - 覆盖率工具
