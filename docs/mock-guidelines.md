# Mock 开发规范

本文档定义 koduck-quant 项目中 Mock 对象的使用规范，确保测试的可维护性和一致性。

---

## 📋 目录

1. [规范概述](#规范概述)
2. [Java 后端 Mock 规范](#java-后端-mock-规范)
3. [前端 Mock 规范](#前端-mock-规范)
4. [Mock 数据管理](#mock-数据管理)
5. [最佳实践](#最佳实践)

---

## 规范概述

### 为什么需要 Mock

1. **隔离被测单元**：避免外部依赖影响测试结果
2. **提高测试速度**：避免网络、数据库等 IO 操作
3. **控制测试场景**：模拟边界条件、异常情况
4. **并行执行**：无共享状态，测试可并行运行

### Mock 使用原则

1. **优先使用 `@Mock`**：单元测试首选 Mockito 原生 Mock
2. **慎用 `@MockBean`**：仅在集成测试中替换 Spring Bean
3. **避免过度 Mock**：不要 Mock 被测类本身
4. **验证交互行为**：使用 `verify()` 验证关键交互

---

## Java 后端 Mock 规范

### 1. 命名规范

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| Mock 文件 | `*Mock.java` | `StockDataClientMock.java` |
| Mock 配置 | `Mock*Config.java` | `MockClientConfig.java` |
| Test Double | `Fake*.java` | `FakeStockRepository.java` |
| Mock Factory | `*MockFactory.java` | `StockMockFactory.java` |
| Mock Data | `*Fixtures.java` | `StockFixtures.java` |

### 2. 目录结构

```
koduck-backend/src/test/
├── java/com/koduck/
│   ├── mocks/                  # Mock 实现类
│   │   ├── client/
│   │   │   └── StockDataClientMock.java
│   │   ├── config/
│   │   │   └── MockClientConfig.java
│   │   └── factory/
│   │       └── StockMockFactory.java
│   ├── fixtures/               # 测试数据工厂
│   │   └── StockFixtures.java
│   └── ...
└── resources/
    └── mocks/                  # Mock 数据文件（JSON等）
        ├── stock-basic.json
        └── stock-realtime.json
```

### 3. 基础 Mock 示例

```java
@ExtendWith(MockitoExtension.class)
class MarketServiceImplTest {

    @Mock
    private StockRealtimeRepository stockRealtimeRepository;

    @Mock
    private StockCacheService stockCacheService;

    @InjectMocks
    private MarketServiceImpl marketService;

    @Test
    @DisplayName("当缓存命中时，应直接返回缓存数据")
    void shouldReturnCachedDataWhenCacheHit() {
        // Given
        String symbol = "000001.SZ";
        StockRealtime cachedData = StockFixtures.createRealtimePrice(symbol);
        when(stockCacheService.get(anyString())).thenReturn(cachedData);

        // When
        StockRealtime result = marketService.getRealtimePrice(symbol);

        // Then
        assertThat(result).isEqualTo(cachedData);
        verify(stockCacheService).get(symbol);
        verifyNoInteractions(stockRealtimeRepository);
    }
}
```

### 4. @Mock vs @MockBean 选择指南

| 场景 | 推荐注解 | 说明 |
|------|----------|------|
| 纯单元测试 | `@Mock` | 快速，无 Spring 上下文 |
| 需要 Spring 上下文的测试 | `@MockBean` | 替换上下文中的 Bean |
| Web MVC 测试 | `@MockBean` | 配合 `@WebMvcTest` 使用 |
| 数据层测试 | `@Mock` | 测试 Repository 接口 |

### 5. Fixtures 工厂模式

```java
public final class StockFixtures {

    private StockFixtures() {
        // 工具类，禁止实例化
    }

    /**
     * 创建标准股票实时价格 Mock 数据
     */
    public static StockRealtime createRealtimePrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("测试股票")
                .price(new BigDecimal("10.50"))
                .changePercent(new BigDecimal("0.025"))
                .changeAmount(new BigDecimal("0.25"))
                .openPrice(new BigDecimal("10.25"))
                .highPrice(new BigDecimal("10.80"))
                .lowPrice(new BigDecimal("10.20"))
                .preClosePrice(new BigDecimal("10.25"))
                .volume(1000000L)
                .amount(new BigDecimal("10500000"))
                .updateTime(LocalDateTime.now())
                .build();
    }

    /**
     * 创建多只股票 Mock 数据
     */
    public static List<StockRealtime> createRealtimePriceList(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> createRealtimePrice(String.format("%06d.SZ", i + 1)))
                .collect(Collectors.toList());
    }

    /**
     * 创建异常场景 Mock 数据（如跌停）
     */
    public static StockRealtime createLimitDownPrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("跌停股票")
                .price(new BigDecimal("9.50"))
                .changePercent(new BigDecimal("-0.100"))
                .updateTime(LocalDateTime.now())
                .build();
    }
}
```

### 6. Mock 配置类（用于集成测试）

```java
@TestConfiguration
public class MockClientConfig {

    @Bean
    @Primary
    public StockDataClient stockDataClient() {
        return Mockito.mock(StockDataClient.class);
    }

    @Bean
    @Primary
    public MarketDataProvider marketDataProvider() {
        return Mockito.mock(MarketDataProvider.class);
    }
}
```

### 7. 静态资源 Mock

```java
@ExtendWith(MockitoExtension.class)
class StaticResourceMockExample {

    private static final String MOCK_DATA_PATH = "mocks/stock-basic.json";

    @Test
    @DisplayName("从 JSON 文件加载 Mock 数据")
    void shouldLoadMockDataFromJson() throws IOException {
        // 从 classpath 加载 JSON 文件
        ClassPathResource resource = new ClassPathResource(MOCK_DATA_PATH);
        String json = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        List<StockBasic> stocks = objectMapper.readValue(json, 
                new TypeReference<List<StockBasic>>() {});

        assertThat(stocks).hasSize(3);
    }
}
```

---

## 前端 Mock 规范

### 1. 技术选型

使用 [Mock Service Worker (MSW)](https://mswjs.io/) 作为前端 Mock 方案：
- 拦截网络请求，无需修改业务代码
- 支持浏览器和 Node.js 测试环境
- 与 React/Vue/Angular 框架无关

### 2. 目录结构

```
koduck-frontend/src/
├── mocks/
│   ├── handlers.ts           # API 请求处理器
│   ├── browser.ts            # 浏览器端初始化
│   ├── server.ts             # Node.js 测试端初始化
│   ├── data/                 # Mock 数据
│   │   ├── stocks.ts
│   │   ├── users.ts
│   │   └── market.ts
│   └── fixtures/             # 测试夹具
│       └── index.ts
└── main.tsx
```

### 3. Handlers 示例

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import { mockStocks, mockRealtimePrices } from './data/stocks';

export const handlers = [
    // 获取股票列表
    http.get('/api/v1/market/stocks', async () => {
        await delay(150); // 模拟网络延迟
        return HttpResponse.json({
            code: 200,
            data: mockStocks,
            message: 'success'
        });
    }),

    // 获取实时价格
    http.get('/api/v1/market/realtime/:symbol', ({ params }) => {
        const { symbol } = params;
        const price = mockRealtimePrices.find(p => p.symbol === symbol);
        
        if (!price) {
            return HttpResponse.json(
                { code: 404, message: 'Stock not found' },
                { status: 404 }
            );
        }

        return HttpResponse.json({
            code: 200,
            data: price,
            message: 'success'
        });
    }),

    // 模拟错误响应
    http.get('/api/v1/market/error', () => {
        return HttpResponse.json(
            { code: 500, message: 'Internal Server Error' },
            { status: 500 }
        );
    }),
];
```

### 4. Mock Data

```typescript
// src/mocks/data/stocks.ts
import type { Stock, StockRealtime } from '@/types/market';

export const mockStocks: Stock[] = [
    {
        symbol: '000001.SZ',
        name: '平安银行',
        industry: '银行',
        market: 'SZ',
    },
    {
        symbol: '000002.SZ',
        name: '万科A',
        industry: '房地产',
        market: 'SZ',
    },
];

export const mockRealtimePrices: StockRealtime[] = [
    {
        symbol: '000001.SZ',
        name: '平安银行',
        price: 10.50,
        changePercent: 0.025,
        changeAmount: 0.25,
        volume: 1000000,
        amount: 10500000,
        updateTime: new Date().toISOString(),
    },
];

// 工厂函数
export function createMockStock(overrides?: Partial<Stock>): Stock {
    return {
        symbol: '000001.SZ',
        name: '测试股票',
        industry: '其他',
        market: 'SZ',
        ...overrides,
    };
}
```

### 5. 浏览器端初始化

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

async function enableMocking() {
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true') {
        const { worker } = await import('./mocks/browser');
        return worker.start();
    }
}

enableMocking().then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
});
```

### 6. 测试端初始化

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/setup.ts
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Mock 数据管理

### 1. 共享 Mock 数据

在 `tests/fixtures/` 目录存放跨模块共享的 Mock 数据：

```
tests/fixtures/
├── stocks/
│   ├── stock-basic.json
│   └── stock-realtime.json
├── klines/
│   ├── daily-kline.json
│   └── minute-kline.json
└── users/
    └── user-profile.json
```

### 2. JSON 数据示例

```json
{
    "stocks": [
        {
            "symbol": "000001.SZ",
            "name": "平安银行",
            "industry": "银行",
            "market": "SZ"
        }
    ],
    "klines": [
        {
            "symbol": "000001.SZ",
            "date": "2024-01-15",
            "open": 10.25,
            "high": 10.50,
            "low": 10.20,
            "close": 10.45,
            "volume": 1000000
        }
    ]
}
```

---

## 最佳实践

### 1. 不要 Mock 被测类

```java
// ❌ 错误：Mock 了被测类本身
@Mock
private MarketServiceImpl marketService;

@Test
void test() {
    when(marketService.getPrice(any())).thenReturn(mockPrice);
    // ...
}

// ✅ 正确：Mock 依赖，测试真实实现
@Mock
private StockRepository stockRepository;

@InjectMocks
private MarketServiceImpl marketService; // 真实实例

@Test
void test() {
    when(stockRepository.findById(any())).thenReturn(Optional.of(mockStock));
    Price price = marketService.getPrice("000001.SZ");
    // ...
}
```

### 2. 验证关键交互

```java
@Test
@DisplayName("当缓存未命中时，应查询数据库并写入缓存")
void shouldQueryDbAndCacheWhenCacheMiss() {
    // Given
    String symbol = "000001.SZ";
    Stock stock = StockFixtures.createRealtimePrice(symbol);
    when(stockCacheService.get(symbol)).thenReturn(null);
    when(stockRepository.findById(symbol)).thenReturn(Optional.of(stock));

    // When
    marketService.getRealtimePrice(symbol);

    // Then
    verify(stockRepository).findById(symbol);
    verify(stockCacheService).set(eq(symbol), any(), anyLong());
}
```

### 3. 使用 ArgumentCaptor 验证参数

```java
@Test
@DisplayName("应使用正确的过期时间写入缓存")
void shouldCacheWithCorrectExpiration() {
    // Given
    String symbol = "000001.SZ";
    ArgumentCaptor<Long> ttlCaptor = ArgumentCaptor.forClass(Long.class);
    
    // When
    marketService.getRealtimePrice(symbol);

    // Then
    verify(stockCacheService).set(eq(symbol), any(), ttlCaptor.capture());
    assertThat(ttlCaptor.getValue()).isEqualTo(300); // 5分钟
}
```

### 4. 避免过度使用 any()

```java
// ❌ 过于宽松
when(service.process(any())).thenReturn(result);

// ✅ 明确参数匹配
when(service.process(eq("000001.SZ"))).thenReturn(result);
when(service.process(argThat(s -> s.startsWith("000")))).thenReturn(result);
```

### 5. 清理测试数据

```java
@AfterEach
void tearDown() {
    // 清理 ThreadLocal、缓存等
    MDC.clear();
}
```

---

## 参考

- [Mockito 文档](https://javadoc.io/doc/org.mockito/mockito-core/latest/org/mockito/Mockito.html)
- [Mock Service Worker](https://mswjs.io/)
- [Testing Library](https://testing-library.com/)
