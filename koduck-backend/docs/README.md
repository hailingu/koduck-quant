# Koduck Backend

Koduck Quant 后端服务，基于 Spring Boot 3.x 和 Java 23 构建。

## 技术栈

- **Java**: 23
- **Spring Boot**: 3.4.2
- **构建工具**: Maven
- **数据库**: PostgreSQL
- **ORM**: Spring Data JPA

## 快速开始

### 前置要求

- JDK 23+
- Maven 3.9+
- PostgreSQL 15+（可选，开发模式可暂不连接数据库）

### 构建项目

```bash
mvn clean package
```

### 运行项目

```bash
# 使用 Maven
mvn spring-boot:run

# 或使用构建好的 JAR
java -jar target/koduck-backend-0.1.0-SNAPSHOT.jar
```

### 验证服务

服务启动后，访问以下接口验证：

```bash
# 健康检查
curl http://localhost:8080/api/v1/health

# Ping
curl http://localhost:8080/api/v1/health/ping

# Actuator 健康端点
curl http://localhost:8080/actuator/health
```

## 项目结构

```
koduck-backend/
├── src/
│   ├── main/
│   │   ├── java/com/koduck/
│   │   │   ├── KoduckApplication.java    # 启动类
│   │   │   ├── config/                   # 配置类
│   │   │   ├── controller/               # API 控制器层
│   │   │   ├── service/                  # 业务逻辑层
│   │   │   │   └── impl/                 # 实现类
│   │   │   ├── repository/               # 数据访问层
│   │   │   ├── entity/                   # 实体类 (JPA)
│   │   │   ├── dto/                      # 数据传输对象
│   │   │   ├── vo/                       # 值对象 (View Object)
│   │   │   ├── exception/                # 自定义异常
│   │   │   └── util/                     # 工具类
│   │   └── resources/
│   │       ├── application.yml           # 主配置文件
│   │       ├── application-dev.yml       # 开发环境配置
│   │       └── application-prod.yml      # 生产环境配置
│   └── test/
│       └── java/com/koduck/              # 单元/集成测试
├── docs/                                 # 文档
└── pom.xml                               # Maven 配置
```

## 配置说明

### 环境配置

项目支持多环境配置，通过 `spring.profiles.active` 指定：

- `dev` (默认): 开发环境，启用 SQL 日志，自动更新数据库结构
- `prod`: 生产环境，关闭 SQL 日志，仅验证数据库结构

### 数据库配置

在对应环境的配置文件中设置：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/koduck
    username: your_username
    password: your_password
```

或使用环境变量：

```bash
export DB_USERNAME=your_username
export DB_PASSWORD=your_password
mvn spring-boot:run
```

## API 响应格式

所有 API 返回统一格式：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "timestamp": 1740723600000
}
```

- `code`: 响应码，0 表示成功，非 0 表示错误
- `message`: 响应消息
- `data`: 响应数据
- `timestamp`: 时间戳（毫秒）

## API 版本管理

- API 版本策略文档：[`API-VERSIONING.md`](API-VERSIONING.md)
- API 变更历史文档：[`API-CHANGELOG.md`](API-CHANGELOG.md)
- 版本治理 ADR：`ADR-0012-api-versioning-strategy.md`
- Changelog 治理 ADR：`ADR-0020-api-changelog-governance.md`

## 密钥与敏感信息管理

- 密钥管理文档：[`SECRET-MANAGEMENT.md`](SECRET-MANAGEMENT.md)
- 密钥治理 ADR：`ADR-0013-spring-vault-secret-management-baseline.md`
- 生产 JWT 强制 Vault ADR：`ADR-0015-prod-jwt-secret-vault-enforcement.md`

## Security 策略配置

- 公开端点配置文档：[`SECURITY-ENDPOINTS.md`](SECURITY-ENDPOINTS.md)
- 配置化治理 ADR：`ADR-0014-security-permitall-endpoint-externalization.md`

## Market Provider 抽象治理

- Provider 抽象统一 ADR：`ADR-0016-market-provider-abstraction-unification.md`

## 持久化性能治理

- JDBC Batch 优化 ADR：`ADR-0017-jdbc-batch-for-bulk-persistence.md`

## Service 异常治理

- 异常抛出规范统一 ADR：`ADR-0018-service-layer-exception-standardization.md`

## 架构可视化治理

- 架构决策树与关键流程图：[`ARCHITECTURE-FLOWS.md`](ARCHITECTURE-FLOWS.md)
- 可视化文档治理 ADR：`ADR-0019-architecture-decision-tree-and-key-flow-visualization.md`

## DDD 领域建模治理

- 领域模型与模块划分文档：[`DOMAIN-MODEL-DESIGN.md`](DOMAIN-MODEL-DESIGN.md)
- DDD 边界治理 ADR：`ADR-0021-ddd-bounded-context-module-partitioning.md`
- DDD Phase 1 实施 ADR：`ADR-0022-ddd-phase1-code-implementation.md`
- DDD Phase 2 实施 ADR：`ADR-0023-ddd-phase2-complete-service-impl-migration.md`

## 测试

```bash
# 运行所有测试
mvn test

# 运行单个测试类
mvn test -Dtest=HealthControllerTest
```

## 许可证

[LICENSE](../LICENSE)
