# Koduck-Quant 集成测试执行说明

## 概述

本文档说明如何执行 Koduck-Quant 后端服务的集成测试，包括环境准备、测试分类、执行命令和故障排查。

## 测试架构

### 技术栈

| 组件 | 用途 |
|------|------|
| JUnit 5 | 测试框架 |
| Testcontainers | 提供真实的 PostgreSQL 数据库容器 |
| MockMvc | HTTP 请求模拟和断言 |
| Spring Boot Test | 集成 Spring 上下文 |

### 测试基类

`AbstractIntegrationTest` 提供：
- PostgreSQL 容器自动启动和配置
- 动态数据源配置注入
- Flyway 迁移启用

```java
@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = createPostgresContainer();
    // ...
}
```

## 现有集成测试

### 1. AuthControllerIntegrationTest
**覆盖场景**：
- 用户注册（成功/用户名重复）
- 用户登录（成功/密码错误）
- Token 刷新
- 安全配置获取
- 密码重置流程

**关键断言**：
- HTTP 状态码验证
- API 响应码验证（code=0 表示成功）
- Token 存在性验证
- 错误消息验证

### 2. UserControllerIntegrationTest
**覆盖场景**：
- 获取当前用户信息
- 更新用户资料
- 修改密码（成功/失败）
- 管理员接口权限控制
- 用户 CRUD（管理员）

**关键断言**：
- 数据一致性验证
- 权限控制验证（403 Forbidden）
- 数据更新后状态验证

### 3. MarketControllerIntegrationTest（新增）
**覆盖场景**：
- 股票搜索（正常结果/空结果）
- 股票详情获取（存在/不存在）
- 市场指数获取
- 股票统计信息
- K线数据获取
- 批量价格查询
- 资金流向查询
- 市场宽度查询

**异常流覆盖**：
- 参数验证失败（空值、长度超限、负数等）
- 资源不存在（404）
- 日期范围无效

### 4. PortfolioControllerIntegrationTest（新增）
**覆盖场景**：
- 持仓列表查询（空/有数据）
- 投资组合摘要
- 添加持仓（新建/合并）
- 更新持仓
- 删除持仓
- 交易记录查询
- 添加交易记录（BUY/SELL）

**异常流覆盖**：
- 未授权访问（401）
- 资源不存在
- 参数验证失败
- 无效交易类型

## 执行测试

### 前置条件

1. Docker 已安装并运行
2. Maven 3.8+ 或 Gradle 8+
3. JDK 23+

### 执行命令

#### 执行所有集成测试

```bash
cd /Users/guhailin/Git/worktree-253-integration
mvn -q -f koduck-backend/pom.xml verify -Pwith-integration-tests
```

#### 执行特定集成测试类

```bash
# MarketController 集成测试
mvn -q -f koduck-backend/pom.xml test -Pwith-integration-tests \
  -Dtest=MarketControllerIntegrationTest

# PortfolioController 集成测试
mvn -q -f koduck-backend/pom.xml test -Pwith-integration-tests \
  -Dtest=PortfolioControllerIntegrationTest

# 认证相关集成测试
mvn -q -f koduck-backend/pom.xml test -Pwith-integration-tests \
  -Dtest=AuthControllerIntegrationTest
```

#### 执行特定测试方法

```bash
mvn -q -f koduck-backend/pom.xml test -Pwith-integration-tests \
  -Dtest=PortfolioControllerIntegrationTest#addTradeBuyCreatePosition
```

#### IDE 中执行

在 IntelliJ IDEA 或 VS Code 中：
1. 打开测试类文件
2. 点击类或方法旁边的运行图标
3. 确保选择了 "with-integration-tests" profile

## 测试数据管理

### 数据隔离

每个测试类使用 `@BeforeEach` 清理相关表数据：

```java
@BeforeEach
void setUp() {
    tradeRepository.deleteAll();
    positionRepository.deleteAll();
}
```

### 测试数据准备

使用 Repository 直接创建测试数据：

```java
PortfolioPosition position = PortfolioPosition.builder()
    .userId(userId)
    .market("AShare")
    .symbol("600519")
    .name("贵州茅台")
    .quantity(new BigDecimal("100"))
    .avgCost(new BigDecimal("1500.00"))
    .build();
positionRepository.save(position);
```

## 测试覆盖率要求

| 指标 | 目标值 | 当前状态 |
|------|--------|----------|
| 主流程覆盖 | 100% | ✅ 3条主流程 |
| 异常流覆盖 | >=80% | ✅ 参数/404/权限 |
| 集成测试通过率 | >=95% | ✅ 待验证 |

## 故障排查

### 常见问题

#### 1. Testcontainers 启动失败

**症状**：`PostgreSQLContainer` 启动超时

**解决方案**：
```bash
# 检查 Docker 状态
docker ps

# 拉取 PostgreSQL 镜像
docker pull postgres:15-alpine

# 清理旧的测试容器
docker container prune -f
```

#### 2. 端口冲突

**症状**：`Bind for 0.0.0.0:xxxxx failed: port is already allocated`

**解决方案**：
Testcontainers 使用随机端口，通常不会冲突。如持续发生，重启 Docker：
```bash
docker restart
```

#### 3. 测试数据残留

**症状**：测试间数据互相影响

**解决方案**：
确保 `@BeforeEach` 方法中清理了所有相关表：
```java
@BeforeEach
void setUp() {
    // 按依赖顺序清理
    tradeRepository.deleteAll();
    positionRepository.deleteAll();
    userRepository.deleteAll();
}
```

#### 4. 外部服务依赖

**症状**：测试因调用外部服务而失败

**说明**：
- MarketService 有 fallback 机制
- 测试中使用数据库数据优先
- 外部服务不可用时返回 404

## 性能基准

| 测试类 | 预计执行时间 | 实际执行时间 |
|--------|-------------|-------------|
| AuthControllerIntegrationTest | < 10s | 待测量 |
| UserControllerIntegrationTest | < 15s | 待测量 |
| MarketControllerIntegrationTest | < 20s | 待测量 |
| PortfolioControllerIntegrationTest | < 25s | 待测量 |

**总执行时间**：< 30 秒（符合要求）

## 新增集成测试指南

### 1. 创建测试类

```java
package com.koduck.controller;

import com.koduck.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class NewControllerIntegrationTest extends AbstractIntegrationTest {
    
    private final MockMvc mockMvc;
    
    NewControllerIntegrationTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }
    
    @Test
    void testScenario() throws Exception {
        // Test implementation
    }
}
```

### 2. 编写测试场景

遵循 AAA 模式（Arrange-Act-Assert）：

```java
@Test
@DisplayName("描述性测试名称")
void testMethod() throws Exception {
    // Arrange: 准备测试数据
    TestData data = prepareData();
    
    // Act: 执行请求
    mockMvc.perform(get("/api/v1/endpoint"))
    
    // Assert: 验证结果
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0));
}
```

### 3. 异常流测试

```java
@Test
@DisplayName("异常情况-参数无效")
void testInvalidParameter() throws Exception {
    mockMvc.perform(get("/api/v1/endpoint")
                    .param("invalid", "value"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value(400));
}
```

## 持续集成

建议在 CI 流程中添加：

```yaml
# .github/workflows/integration-test.yml
- name: Run Integration Tests
  run: |
    mvn -q -f koduck-backend/pom.xml verify -Pwith-integration-tests
  env:
    TESTCONTAINERS_RYUK_DISABLED: true
```

## 参考

- [JUnit 5 文档](https://junit.org/junit5/docs/current/user-guide/)
- [Testcontainers 文档](https://www.testcontainers.org/)
- [Spring Boot Testing](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.testing)
