# 测试策略与分层规范

## 概述

本文档定义 koduck-backend 的测试分层策略、命名规范与执行实践。

## 测试分层模型

```
┌────────────────────────────────────────────────────────────────────┐
│  Integration Test (集成测试)                                       │
│  - 完整 Spring 上下文启动                                          │
│  - 真实/嵌入式数据库                                               │
│  - 端到端 API 测试                                                 │
│  - 命名: *IntegrationTest.java                                     │
│  - 注解: @SpringBootTest                                           │
│  - 数量占比: ~10%                                                  │
├────────────────────────────────────────────────────────────────────┤
│  Slice Test (切片测试)                                             │
│  - 仅加载特定层 (Web/DataJpa)                                      │
│  - 不加载完整上下文                                                │
│  - Controller/Repository 层测试                                    │
│  - 命名: *ControllerTest.java, *RepositoryTest.java               │
│  - 注解: @WebMvcTest, @DataJpaTest                                │
│  - 数量占比: ~30%                                                  │
├────────────────────────────────────────────────────────────────────┤
│  Unit Test (单元测试)                                              │
│  - 纯 Java 测试，无 Spring                                         │
│  - Mockito 模拟依赖                                                │
│  - Service/Util 层核心业务逻辑                                     │
│  - 命名: *Test.java (非 Integration/Controller/Repository)        │
│  - 注解: @ExtendWith(MockitoExtension.class)                      │
│  - 数量占比: ~60%                                                  │
└────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/test/java/com/koduck/
├── unit/                       # 单元测试
│   ├── service/               # Service 层单元测试
│   ├── util/                  # 工具类单元测试
│   └── mapper/                # Mapper 单元测试
├── slice/                      # 切片测试
│   ├── controller/            # Controller 层切片测试
│   └── repository/            # Repository 层切片测试
├── integration/                # 集成测试
│   ├── api/                   # API 端到端测试
│   └── flow/                  # 业务流程测试
└── config/                     # 测试配置
    ├── TestConfig.java        # 共享测试配置
    ├── TestDataFactory.java   # 测试数据工厂
    └── TestSecurityConfig.java # 测试安全配置
```

## 命名规范

| 类型 | 命名模式 | 示例 |
|------|---------|------|
| 单元测试 | `{ClassName}Test` | `UserServiceTest` |
| Controller 切片 | `{ClassName}ControllerTest` | `UserControllerTest` |
| Repository 切片 | `{ClassName}RepositoryTest` | `UserRepositoryTest` |
| 集成测试 | `{ClassName}IntegrationTest` | `AuthIntegrationTest` |

## 注解使用规范

### 单元测试
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock
    private UserRepository userRepository;
    
    @InjectMocks
    private UserService userService;
}
```

### Controller 切片测试
```java
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private UserService userService;
}
```

### Repository 切片测试
```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.datasource.url=jdbc:tc:postgresql:16:///testdb")
class UserRepositoryTest {
    @Autowired
    private UserRepository userRepository;
}
```

### 集成测试
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
class AuthIntegrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");
}
```

## 测试数据管理

### 数据工厂模式
```java
public class TestDataFactory {
    public static User createUser() {
        return User.builder()
            .id(1L)
            .username("testuser")
            .email("test@example.com")
            .build();
    }
    
    public static User createUser(String username) {
        User user = createUser();
        user.setUsername(username);
        return user;
    }
}
```

### Fixture 模式
```java
public class UserFixture {
    public static final User VALID_USER = TestDataFactory.createUser();
    public static final User INVALID_USER = User.builder().build();
}
```

## Flaky 测试防治

### 常见原因与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Thread.sleep | 依赖固定延迟 | 使用 Awaitility 或 CountDownLatch |
| 固定端口 | 端口冲突 | 使用 `WebEnvironment.RANDOM_PORT` |
| 时间敏感 | 当前时间断言 | 使用 Clock 注入，固定测试时间 |
| 数据库状态 | 测试间数据污染 | 每个测试独立事务，@Transactional |
| 异步操作 | 结果不确定 | 使用 Awaitility 等待条件满足 |

### 异步测试规范
```java
// ❌ 不要这样
@Test
void testAsync() throws InterruptedException {
    service.asyncOperation();
    Thread.sleep(1000); // 不稳定！
    assertEquals(expected, actual);
}

// ✅ 应该这样
@Test
void testAsync() {
    service.asyncOperation();
    await().atMost(Duration.ofSeconds(5))
           .untilAsserted(() -> assertEquals(expected, actual));
}
```

## CI 集成

### Maven 配置
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>**/*IntegrationTest.java</exclude>
        </excludes>
    </configuration>
</plugin>
```

### 分层执行
```bash
# 1. 单元测试 (快速)
mvn test -DexcludedGroups=slice,integration

# 2. 切片测试 (中等)
mvn test -Dtest="*ControllerTest,*RepositoryTest"

# 3. 集成测试 (慢)
mvn test -Dtest="*IntegrationTest" -Dspring.profiles.active=test
```

## 验收标准

- [ ] 测试目录按 unit/slice/integration 分层
- [ ] @SpringBootTest 使用次数 <= 5
- [ ] Flaky 测试数量为 0
- [ ] 单元测试占比 >= 60%
- [ ] 测试执行时间 <= 5 分钟 (不含集成测试)
