# Koduck Quant 开发指南

> 新成员快速上手指南：5 分钟完成本地环境搭建与最小开发闭环

---

## 📋 目录

1. [环境准备](#环境准备)
2. [快速启动（一键启动）](#快速启动)
3. [手动启动（按需启动）](#手动启动)
4. [测试指南](#测试指南)
5. [Mock 开发规范](#mock-开发规范)
6. [常见问题](#常见问题)

---

## 环境准备

### 1. 安装依赖

| 工具 | 版本要求 | 安装命令（macOS） |
|------|----------|-------------------|
| Java | 23+ | `brew install openjdk@23` |
| Maven | 3.9+ | `brew install maven` |
| Node.js | 20+ | `brew install node` |
| Python | 3.12+ | `brew install python@3.12` |
| Docker | 最新 | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| GitHub CLI | 最新 | `brew install gh` |

### 2. 克隆仓库

```bash
git clone git@github.com:hailingu/koduck-quant.git
cd koduck-quant
```

### 3. 环境变量配置（可选）

```bash
# 复制环境变量模板
cp .env.local.example .env.local

# 编辑 .env.local，配置 LLM API 密钥等
```

---

## 快速启动

### 🚀 方式一：Docker 全容器启动（推荐）

适合：快速预览、不修改代码

```bash
# 启动所有服务
make dev-up

# 访问地址
# 前端: http://localhost:3000
# 后端: http://localhost:8080
# Agent: http://localhost:8001
```

### 🚀 方式二：本地开发模式（推荐开发使用）

适合：日常开发、需要热更新

```bash
# 1. 启动基础设施（PostgreSQL, Redis, Data Service）
docker-compose up -d postgresql redis data-service

# 2. 启动后端（终端 1）
cd koduck-backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 3. 启动前端（终端 2）
cd koduck-frontend
npm run dev

# 4. 启动 Agent（终端 3，可选）
cd koduck-agent
python -m koduck
```

### 🚀 方式三：一键启动脚本

```bash
# 使用脚本一键启动（混合模式：Docker + 本地）
./start-dev.sh

# 停止
./stop-dev.sh
```

---

## 手动启动

### 后端服务（koduck-backend）

```bash
cd koduck-backend

# 编译
mvn clean compile

# 运行（开发环境）
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 打包
mvn clean package -DskipTests

# 运行 JAR
java -jar target/koduck-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=dev
```

### 前端服务（koduck-frontend）

```bash
cd koduck-frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 代码检查
npm run lint
```

### Agent 服务（koduck-agent）

```bash
cd koduck-agent

# 安装依赖
pip install -e ".[dev]"

# 运行
python -m koduck

# 或使用脚本
./scripts/start.sh
```

### 数据服务（koduck-data-service）

```bash
cd koduck-data-service

# 安装依赖
pip install -r requirements.txt

# 运行
python -m app.main

# 或使用 Docker
docker-compose up -d data-service
```

---

## 测试指南

### 测试分层

```
koduck-backend/src/test/
├── java/com/koduck/
│   ├── unit/           # 单元测试（纯内存，无 Spring 上下文）
│   ├── service/        # 服务层测试（当前目录，混合）
│   └── controller/     # 控制器测试（集成测试）
└── resources/
    └── application-test.yml
```

### 运行测试

#### Java 后端测试

```bash
cd koduck-backend

# 仅运行单元测试（默认，排除集成测试）
mvn test

# 运行所有测试（含集成测试）
mvn test -P with-integration-tests

# 仅运行集成测试
mvn failsafe:integration-test

# 运行特定测试类
mvn test -Dtest=MarketServiceImplTest

# 运行特定方法
mvn test -Dtest=MarketServiceImplTest#testGetRealtimePrice

# 生成覆盖率报告
mvn clean test jacoco:report
# 报告位置: target/site/jacoco/index.html
```

#### 测试分组配置

| 命令 | 说明 |
|------|------|
| `mvn test` | 仅单元测试（快速） |
| `mvn test -P with-integration-tests` | 全部测试（完整） |
| `mvn failsafe:integration-test` | 仅集成测试 |
| `mvn test -Dtest=*ServiceTest` | 仅 Service 层测试 |
| `mvn test -Dtest=*ControllerTest` | 仅 Controller 层测试 |

#### 前端测试

```bash
cd koduck-frontend

# 运行测试
npm test

# 运行并生成覆盖率报告
npm run test:coverage
```

#### Python 测试

```bash
cd koduck-agent

# 运行测试
pytest

# 运行并生成覆盖率报告
pytest --cov=koduck --cov-report=html

cd koduck-data-service

# 运行测试
pytest
```

---

## Mock 开发规范

### Java 后端 Mock 规范

#### 1. 命名约定

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| Mock 文件 | `*Mock.java` | `StockDataClientMock.java` |
| Mock 配置 | `Mock*Config.java` | `MockClientConfig.java` |
| Test Double | `Fake*.java` | `FakeStockRepository.java` |

#### 2. 存放位置

```
koduck-backend/src/test/
├── java/com/koduck/
│   ├── mocks/              # Mock 实现类
│   │   ├── StockDataClientMock.java
│   │   └── MockClientConfig.java
│   └── ...
└── resources/
    └── mocks/              # Mock 数据文件
        ├── stock-basic.json
        └── stock-realtime.json
```

#### 3. Mock 使用示例

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
        StockRealtime cachedData = createMockStockRealtime(symbol);
        when(stockCacheService.get(anyString())).thenReturn(cachedData);

        // When
        StockRealtime result = marketService.getRealtimePrice(symbol);

        // Then
        assertThat(result).isEqualTo(cachedData);
        verify(stockCacheService).get(symbol);
        verifyNoInteractions(stockRealtimeRepository);
    }

    private StockRealtime createMockStockRealtime(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("平安银行")
                .price(new BigDecimal("10.50"))
                .changePercent(new BigDecimal("0.025"))
                .updateTime(LocalDateTime.now())
                .build();
    }
}
```

#### 4. @Mock vs @MockBean

| 注解 | 使用场景 | 说明 |
|------|----------|------|
| `@Mock` | 单元测试 | Mockito 原生，纯内存，快速 |
| `@MockBean` | Spring 集成测试 | 替换 Spring 上下文中的 Bean |

### 前端 Mock 规范

#### 1. Mock Service Worker (MSW)

```typescript
// koduck-frontend/src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
    http.get('/api/v1/market/realtime/:symbol', ({ params }) => {
        return HttpResponse.json({
            symbol: params.symbol,
            price: 10.50,
            changePercent: 0.025,
        });
    }),
];
```

#### 2. 存放位置

```
koduck-frontend/src/
├── mocks/
│   ├── handlers.ts        # API Mock 处理器
│   ├── browser.ts         # 浏览器端 MSW 初始化
│   ├── server.ts          # 测试端 MSW 初始化
│   └── data/              # Mock 数据
│       ├── stocks.ts
│       └── users.ts
```

### Mock 数据管理

#### 1. 共享 Mock 数据

在 `tests/fixtures/` 目录存放跨模块共享的 Mock 数据：

```
tests/fixtures/
├── stocks/
│   ├── stock-basic.json
│   └── stock-realtime.json
└── users/
    └── user-profile.json
```

#### 2. Mock 数据工厂（Factory Pattern）

```java
@TestComponent
public class StockMockFactory {

    public StockRealtime createRealtimePrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .price(randomPrice())
                .changePercent(randomChange())
                .updateTime(LocalDateTime.now())
                .build();
    }

    public List<StockRealtime> createRealtimePriceList(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> createRealtimePrice("00000" + i + ".SZ"))
                .collect(Collectors.toList());
    }
}
```

---

## 常用 Make 命令

```bash
# 查看所有可用命令
make help

# Docker 环境管理
make dev-up          # 启动本地开发环境（推荐）
make up              # 启动标准开发环境
make down            # 停止所有服务
make down-v          # 停止并删除数据卷（⚠️ 数据丢失）
make restart         # 重启所有服务
make build           # 重新构建镜像
make rebuild         # 完全重建（停止+构建+启动）
make dev-rebuild     # 开发环境快速重建

# 日志查看
make logs            # 查看所有服务日志
```

---

## 常见问题

### Q1: 后端启动失败，提示数据库连接错误

```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgresql

# 如果没运行，启动基础设施
docker-compose up -d postgresql redis
```

### Q2: 前端 npm install 失败

```bash
# 清除缓存后重试
cd koduck-frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Q3: 测试覆盖率报告未生成

```bash
cd koduck-backend
mvn clean test jacoco:report
open target/site/jacoco/index.html
```

### Q4: 如何调试后端代码

1. 启动后端时添加调试参数：
```bash
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005"
```

2. 在 IDE 中配置远程调试，连接 `localhost:5005`

### Q5: 端口冲突

```bash
# 检查端口占用
lsof -i :3000  # 前端
lsof -i :8080  # 后端
lsof -i :8000  # 数据服务

# 终止占用进程
kill -9 <PID>
```

---

## 相关文档

- [项目贡献指南](./CONTRIBUTING.md)
- [PR 审阅指南](./docs/pr-review-guide.md)
- [Docker 部署指南](./DOCKER.md)
- [Python 编码规范](./.github/python-standards/pythonic-python-guidelines.md)
- [Java 编码规范](./.github/java-standards/)

---

## 快速检查清单

新成员完成环境搭建后，请确认：

- [ ] `make dev-up` 或 `./start-dev.sh` 能成功启动服务
- [ ] 前端 http://localhost:3000 可访问
- [ ] 后端 http://localhost:8080/actuator/health 返回 UP
- [ ] `mvn test -f koduck-backend/pom.xml` 测试通过
- [ ] 能完成一次代码修改并看到效果

如有问题，请查看 [常见问题](#常见问题) 或提交 Issue。
