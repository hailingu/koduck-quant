# 测试指南

本文档详细说明 koduck-quant 项目的测试分层策略、执行命令和最佳实践。

---

## 📋 目录

1. [测试分层架构](#测试分层架构)
2. [Java 后端测试](#java-后端测试)
3. [前端测试](#前端测试)
4. [Python 测试](#python-测试)
5. [CI/CD 集成](#cicd-集成)

---

## 测试分层架构

### 测试金字塔

```
        /\
       /  \
      / E2E \      <- 端到端测试（少量）
     /--------\
    /   API    \   <- 集成/契约测试（中等）
   /------------\
  /    Unit      \ <- 单元测试（大量）
 /----------------\
```

### 项目测试结构

```
koduck-backend/src/test/
├── java/com/koduck/
│   ├── unit/                      # 纯单元测试（无 Spring）
│   │   ├── domain/               # 领域模型测试
│   │   ├── util/                 # 工具类测试
│   │   └── service/              # 服务纯逻辑测试
│   ├── service/                   # 服务层测试（@ExtendWith(MockitoExtension)）
│   ├── repository/                # 数据层测试（@DataJpaTest）
│   ├── controller/                # 控制器测试（@WebMvcTest）
│   ├── integration/               # 集成测试
│   │   ├── api/                  # API 集成测试
│   │   └── service/              # 服务集成测试
│   └── KoduckApplicationTests.java # 应用上下文测试
└── resources/
    ├── application-test.yml        # 测试配置
    ├── application-integration-test.yml # 集成测试配置
    └── mocks/                      # Mock 数据文件
```

---

## Java 后端测试

### 测试类型对照表

| 测试类型 | 注解 | 特点 | 执行速度 |
|----------|------|------|----------|
| 纯单元测试 | `@ExtendWith(MockitoExtension)` | 无 Spring 上下文，纯内存 | 快（毫秒级） |
| 服务层测试 | `@ExtendWith(MockitoExtension)` | Mock 依赖，测试业务逻辑 | 快（毫秒级） |
| 数据层测试 | `@DataJpaTest` | 使用内存数据库 | 中等（秒级） |
| Web 层测试 | `@WebMvcTest` | 模拟 HTTP 请求，Mock Service | 中等（秒级） |
| 集成测试 | `@SpringBootTest` | 完整 Spring 上下文 | 慢（十秒级） |

### 运行测试命令

#### 基础命令

```bash
cd koduck-backend

# 运行所有单元测试（默认，排除集成测试）
mvn test

# 运行所有测试（含集成测试）
mvn test -P with-integration-tests

# 仅运行集成测试
mvn failsafe:integration-test

# 运行特定测试类
mvn test -Dtest=MarketServiceImplTest

# 运行特定方法
mvn test -Dtest=MarketServiceImplTest#testGetRealtimePrice

# 运行匹配模式的测试类
mvn test -Dtest="*ServiceTest"
mvn test -Dtest="*ControllerTest"
```

#### 高级选项

```bash
# 跳过测试
mvn clean package -DskipTests

# 失败时停止
mvn test -Dmaven.test.failure.ignore=false

# 并行执行测试
mvn test -DforkCount=4

# 生成覆盖率报告
mvn clean test jacoco:report
open target/site/jacoco/index.html

# 生成 XML 报告用于 CI
mvn test -DreportFormat=xml
```

### 测试分组

#### 1. 单元测试（Unit Tests）

**范围**：纯业务逻辑，无外部依赖

```java
@ExtendWith(MockitoExtension.class)
class CalculatorTest {
    
    @Test
    @DisplayName("两数相加应返回正确结果")
    void shouldReturnCorrectSum() {
        Calculator calc = new Calculator();
        assertThat(calc.add(1, 2)).isEqualTo(3);
    }
}
```

**执行**：
```bash
mvn test
# 默认排除 **/*IntegrationTest.java
```

#### 2. 服务层测试（Service Tests）

**范围**：Service 层逻辑，Mock 依赖

```java
@ExtendWith(MockitoExtension.class)
class MarketServiceImplTest {

    @Mock
    private StockRepository stockRepository;

    @InjectMocks
    private MarketServiceImpl marketService;

    @Test
    @DisplayName("应返回实时价格")
    void shouldReturnRealtimePrice() {
        // Given
        String symbol = "000001.SZ";
        when(stockRepository.findById(symbol))
            .thenReturn(Optional.of(createMockStock()));

        // When
        StockRealtime result = marketService.getRealtimePrice(symbol);

        // Then
        assertThat(result.getSymbol()).isEqualTo(symbol);
        verify(stockRepository).findById(symbol);
    }
}
```

#### 3. 集成测试（Integration Tests）

**范围**：多组件协作，真实数据库或 TestContainers

```java
@SpringBootTest
@TestPropertySource(locations = "classpath:application-integration-test.yml")
class MarketApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @DisplayName("API 应返回股票实时价格")
    void shouldReturnStockPriceViaApi() {
        ResponseEntity<StockRealtime> response = restTemplate.getForEntity(
            "/api/v1/market/realtime/000001.SZ",
            StockRealtime.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
    }
}
```

**命名规范**：
- 集成测试类名必须以 `IntegrationTest` 结尾
- 示例：`MarketApiIntegrationTest.java`

### Maven 配置

pom.xml 中的关键配置：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <!-- 默认排除集成测试 -->
        <excludes>
            <exclude>**/*IntegrationTest.java</exclude>
        </excludes>
        <!-- Flaky Test 重试 -->
        <rerunFailingTestsCount>2</rerunFailingTestsCount>
        <!-- 保留完整堆栈 -->
        <trimStackTrace>false</trimStackTrace>
    </configuration>
</plugin>

<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <configuration>
        <includes>
            <include>**/integration/**/*Test.java</include>
            <include>**/*IntegrationTest.java</include>
        </includes>
    </configuration>
</plugin>
```

### 测试 Profile

| Profile | 说明 | 使用场景 |
|---------|------|----------|
| 默认 | 单元测试，排除集成测试 | 日常开发 |
| `with-integration-tests` | 包含所有测试 | CI 完整检查 |
| `integration` | 仅集成测试 | 集成测试阶段 |

---

## 前端测试

### 测试框架

- **单元测试**：Vitest + Testing Library
- **组件测试**：Testing Library React
- **E2E 测试**：Playwright（可选）

### 运行测试

```bash
cd koduck-frontend

# 运行所有测试
npm test

# 运行并监听文件变化
npm run test:watch

# 运行并生成覆盖率报告
npm run test:coverage

# 运行特定文件
npm test -- src/components/Button.test.tsx

# UI 模式
npm run test:ui
```

### 组件测试示例

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
    it('应渲染按钮文本', () => {
        render(<Button>点击我</Button>);
        expect(screen.getByText('点击我')).toBeInTheDocument();
    });

    it('点击时应触发 onClick 事件', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>点击我</Button>);
        
        fireEvent.click(screen.getByText('点击我'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
```

---

## Python 测试

### 测试框架

- **pytest**：主要测试框架
- **pytest-cov**：覆盖率
- **pytest-asyncio**：异步测试

### 运行测试

```bash
cd koduck-agent

# 运行所有测试
pytest

# 运行并生成覆盖率报告
pytest --cov=koduck --cov-report=html

# 运行特定模块
pytest tests/test_market_service.py

# 运行特定测试
pytest tests/test_market_service.py::test_get_price

# 详细输出
pytest -v

# 失败时停止
pytest -x
```

### Python 测试示例

```python
import pytest
from unittest.mock import Mock, patch
from koduck.market.service import MarketService

class TestMarketService:
    """MarketService 测试类"""

    @pytest.fixture
    def mock_repository(self):
        return Mock()

    @pytest.fixture
    def service(self, mock_repository):
        return MarketService(repository=mock_repository)

    def test_get_price_should_return_cached_value(self, service, mock_repository):
        # Given
        symbol = "000001.SZ"
        expected_price = 10.5
        mock_repository.get_cached_price.return_value = expected_price

        # When
        result = service.get_price(symbol)

        # Then
        assert result == expected_price
        mock_repository.get_cached_price.assert_called_once_with(symbol)
```

---

## CI/CD 集成

### GitHub Actions 测试工作流

```yaml
name: Test

on: [push, pull_request]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up JDK 23
        uses: actions/setup-java@v4
        with:
          java-version: '23'
          distribution: 'temurin'
      
      - name: Run Unit Tests
        run: mvn test -f koduck-backend/pom.xml -q
      
      - name: Run Integration Tests
        run: mvn test -f koduck-backend/pom.xml -P with-integration-tests -q
      
      - name: Generate Coverage Report
        run: mvn jacoco:report -f koduck-backend/pom.xml
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: koduck-backend/target/site/jacoco/jacoco.xml

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Dependencies
        run: cd koduck-frontend && npm ci
      
      - name: Run Tests
        run: cd koduck-frontend && npm test
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

### 质量门禁

| 指标 | 阈值 | 说明 |
|------|------|------|
| 单元测试覆盖率 | ≥ 60% | 业务逻辑核心路径 |
| 集成测试通过率 | 100% | 不能有任何失败 |
| 测试执行时间 | < 5 min | 单元测试总耗时 |
| Flaky Test 数量 | 0 | 不允许有非确定性测试 |

---

## 快速参考

### Java 后端常用命令

```bash
# 开发循环
mvn test -Dtest=MarketServiceImplTest      # 测试当前开发的类
mvn test -Dtest="*ServiceTest"             # 测试所有 Service
mvn test -f koduck-backend/pom.xml -q      # 安静模式（CI）

# 覆盖率检查
mvn clean test jacoco:report
open koduck-backend/target/site/jacoco/index.html
```

### 前端常用命令

```bash
npm test                                    # 运行测试
npm run test:watch                          # 监听模式
npm run test:coverage                       # 覆盖率报告
```

### Python 常用命令

```bash
pytest                                      # 运行测试
pytest -v                                   # 详细输出
pytest --cov=koduck --cov-report=html       # 覆盖率
pytest -k "test_market"                     # 匹配名称运行
```

---

## 参考文档

- [JUnit 5 用户指南](https://junit.org/junit5/docs/current/user-guide/)
- [Mockito 文档](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html)
- [Spring Testing](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.testing)
- [Testing Library](https://testing-library.com/)
- [pytest 文档](https://docs.pytest.org/)
