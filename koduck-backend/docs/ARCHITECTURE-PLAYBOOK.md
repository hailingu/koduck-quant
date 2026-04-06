# 架构改进执行手册

> **目的**: 为架构改进计划提供详细的操作指南  
> **适用对象**: 参与架构改进的开发人员  
> **关联文档**: 
> - [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
> - [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
> - [ARCHITECTURE-TASKS-GITHUB.md](./ARCHITECTURE-TASKS-GITHUB.md)

---

## 一、准备工作

### 1.1 创建功能分支

```bash
# 1. 确保 dev 分支最新
git checkout dev
git pull origin dev

# 2. 创建架构改进专用分支
git checkout -b feature/architecture-improvement

# 3. 推送分支
git push -u origin feature/architecture-improvement
```

### 1.2 创建 Worktree（推荐）

```bash
# 创建独立工作目录进行架构改进
git worktree add ../koduck-architecture-work feature/architecture-improvement
cd ../koduck-architecture-work

# 完成后清理
git worktree remove ../koduck-architecture-work
```

### 1.3 环境检查

```bash
# 检查 Maven 版本（需要 3.9+）
mvn -v

# 检查 Java 版本（需要 23）
java -version

# 验证当前构建
mvn -f koduck-backend/pom.xml clean compile
```

---

## 二、Phase 1 执行指南

### 2.1 创建 API 模块模板

每个 API 模块遵循以下结构：

```
koduck-{domain}/koduck-{domain}-api/
├── pom.xml
└── src/main/java/com/koduck/{domain}/
    ├── api/
    │   ├── {Domain}QueryService.java
    │   ├── {Domain}CommandService.java
    │   └── acl/
    │       └── {Domain}Acl.java
    ├── dto/
    │   ├── {Domain}Dto.java
    │   └── ...
    ├── event/
    │   └── {Domain}Event.java
    └── exception/
        └── {Domain}Exception.java
```

### 2.2 API 模块 pom.xml 模板

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

    <artifactId>koduck-{domain}-api</artifactId>
    <name>Koduck {Domain} API</name>
    <description>{Domain} domain API module - interfaces and DTOs</description>
    <packaging>jar</packaging>

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
    </dependencies>
</project>
```

### 2.3 接口设计规范

**查询服务接口示例**:

```java
package com.koduck.market.api;

import com.koduck.market.dto.MarketDataDto;
import jakarta.validation.constraints.NotNull;
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
}
```

**DTO 设计示例**:

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

**ACL 接口示例**:

```java
package com.koduck.market.api.acl;

import com.koduck.market.dto.MarketDataDto;
import java.util.List;
import java.util.Map;

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
    Map<String, MarketDataDto> getLatestPrices(List<String> symbols);
}
```

### 2.4 ArchUnit 测试模板

```java
package com.koduck.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;
import org.junit.jupiter.api.Test;

/**
 * API 模块架构规则测试。
 */
class ApiModuleRulesTest {

    private static final JavaClasses classes = new ClassFileImporter()
            .importPackages("com.koduck");

    /**
     * API 模块不应依赖任何实现模块。
     */
    @Test
    void apiModulesShouldNotDependOnImplModules() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage("..api..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage("..impl..")
                .because("API 模块只应包含接口和 DTO，不应依赖实现");

        rule.check(classes);
    }

    /**
     * API 模块不应依赖 Spring 的 web 层。
     */
    @Test
    void apiModulesShouldNotDependOnSpringWeb() {
        ArchRule rule = ArchRuleDefinition.noClasses()
                .that()
                .resideInAPackage("..api..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage("org.springframework.web..")
                .because("API 模块应保持技术无关性");

        rule.check(classes);
    }

    /**
     * 领域模块间不应有循环依赖。
     */
    @Test
    void domainModulesShouldBeFreeOfCycles() {
        SlicesRuleDefinition.slices()
                .matching("com.koduck.(*)..")
                .should()
                .beFreeOfCycles()
                .check(classes);
    }
}
```

---

## 三、Phase 2 执行指南

### 3.1 代码迁移步骤

以 Market 领域为例：

```bash
# 1. 创建 impl 模块目录
mkdir -p koduck-market/koduck-market-impl/src/main/java/com/koduck/market
mkdir -p koduck-market/koduck-market-impl/src/test/java/com/koduck/market

# 2. 创建 pom.xml
cat > koduck-market/koduck-market-impl/pom.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-backend-parent</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>koduck-market-impl</artifactId>
    <dependencies>
        <!-- API 模块 -->
        <dependency>
            <groupId>com.koduck</groupId>
            <artifactId>koduck-market-api</artifactId>
        </dependency>
        <!-- 其他依赖 -->
        <dependency>
            <groupId>com.koduck</groupId>
            <artifactId>koduck-infrastructure</artifactId>
        </dependency>
        <dependency>
            <groupId>com.koduck</groupId>
            <artifactId>koduck-common</artifactId>
        </dependency>
    </dependencies>
</project>
EOF
```

### 3.2 代码迁移检查清单

迁移每个类时检查：

- [ ] 包名是否正确（`com.koduck.{domain}`）
- [ ] 导入是否正确（替换旧包名）
- [ ] 依赖是否正确（只依赖 api、infrastructure、common）
- [ ] 是否有循环依赖
- [ ] 单元测试是否迁移
- [ ] 原类是否标记 `@Deprecated`

### 3.3 ACL 迁移步骤

以 AI 模块使用 Portfolio ACL 为例：

**步骤 1**: 在 portfolio-api 定义 ACL 接口
```java
// koduck-portfolio-api/src/.../acl/PortfolioQueryService.java
public interface PortfolioQueryService {
    Optional<PortfolioSnapshot> getSnapshot(Long portfolioId);
}
```

**步骤 2**: 在 portfolio-impl 实现 ACL
```java
// koduck-portfolio-impl/src/.../acl/PortfolioQueryServiceImpl.java
@Service
@RequiredArgsConstructor
public class PortfolioQueryServiceImpl implements PortfolioQueryService {
    private final PortfolioRepository repository;
    
    @Override
    public Optional<PortfolioSnapshot> getSnapshot(Long portfolioId) {
        return repository.findById(portfolioId)
                .map(this::convertToSnapshot);
    }
}
```

**步骤 3**: 在 AI 模块使用 ACL
```java
// koduck-ai-impl/src/.../AiAnalysisServiceImpl.java
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl {
    // 不再直接依赖 PortfolioRepository
    private final PortfolioQueryService portfolioQueryService;
    
    public AnalysisResult analyze(Long portfolioId) {
        PortfolioSnapshot snapshot = portfolioQueryService
                .getSnapshot(portfolioId)
                .orElseThrow(() -> new ResourceNotFoundException("Portfolio not found"));
        // ... 分析逻辑
    }
}
```

**步骤 4**: 更新 AI 模块的 pom.xml
```xml
<!-- 删除 -->
<dependency>
    <groupId>com.koduck</groupId>
    <artifactId>koduck-portfolio</artifactId>
</dependency>

<!-- 改为 -->
<dependency>
    <groupId>com.koduck</groupId>
    <artifactId>koduck-portfolio-api</artifactId>
</dependency>
```

---

## 四、Phase 3 执行指南

### 4.1 koduck-core 瘦身步骤

**步骤 1**: 识别待迁移代码
```bash
# 列出 koduck-core 中的所有 Service
grep -r "@Service" koduck-core/src/main/java --include="*.java" | head -20

# 列出所有 Repository
grep -r "@Repository" koduck-core/src/main/java --include="*.java" | head -20

# 列出所有 Entity
grep -r "@Entity" koduck-core/src/main/java --include="*.java" | head -20
```

**步骤 2**: 逐步迁移
- 按领域分组（Market、Portfolio、Strategy...）
- 每次迁移一个领域
- 迁移后立即运行测试

**步骤 3**: 保留内容检查
瘦身后 koduck-core 应只保留：
- 跨领域事务协调器
- 全局异常处理器（如无法下沉）
- 共享工具类（考虑移到 common）

### 4.2 领域事件配置

**步骤 1**: 添加 Spring Event 支持
```java
// koduck-common/src/.../event/DomainEvent.java
public abstract class DomainEvent {
    private final String eventId = UUID.randomUUID().toString();
    private final Instant occurredOn = Instant.now();
    
    // getters
}

// koduck-common/src/.../event/DomainEventPublisher.java
public interface DomainEventPublisher {
    void publish(DomainEvent event);
}
```

**步骤 2**: 在 infrastructure 实现
```java
@Service
@RequiredArgsConstructor
public class SpringDomainEventPublisher implements DomainEventPublisher {
    private final ApplicationEventPublisher publisher;
    
    @Override
    public void publish(DomainEvent event) {
        publisher.publishEvent(event);
    }
}
```

---

## 五、Phase 4 执行指南

### 5.1 ArchUnit 完整规则集

```java
package com.koduck.architecture;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.Architectures;

@AnalyzeClasses(packages = "com.koduck")
public class ArchitectureRules {

    /**
     * 分层架构规则。
     */
    @ArchTest
    static final ArchRule layeredArchitecture = Architectures.layeredArchitecture()
            .consideringAllDependencies()
            .layer("API").definedBy("..api..")
            .layer("Impl").definedBy("..impl..")
            .layer("Infrastructure").definedBy("..infrastructure..")
            .layer("Common").definedBy("..common..")
            .whereLayer("API").mayNotAccessAnyLayer()
            .whereLayer("Impl").mayOnlyAccessLayers("API", "Infrastructure", "Common")
            .whereLayer("Infrastructure").mayOnlyAccessLayers("API", "Common")
            .whereLayer("Common").mayNotAccessAnyLayer();
}
```

### 5.2 性能测试示例

```java
package com.koduck.market.benchmark;

import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.runner.Runner;
import org.openjdk.jmh.runner.options.Options;
import org.openjdk.jmh.runner.options.OptionsBuilder;

import java.util.concurrent.TimeUnit;

@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@State(Scope.Thread)
@Fork(2)
@Warmup(iterations = 3)
@Measurement(iterations = 5)
public class MarketDataQueryBenchmark {

    @Benchmark
    public void testGetRealTimePrice() {
        // 测试代码
    }

    public static void main(String[] args) throws Exception {
        Options opt = new OptionsBuilder()
                .include(MarketDataQueryBenchmark.class.getSimpleName())
                .build();
        new Runner(opt).run();
    }
}
```

### 5.3 N+1 查询优化

**优化前**:
```java
// N+1 问题
for (Position position : positions) {
    Price price = priceRepository.findBySymbol(position.getSymbol());
    // ...
}
```

**优化后**:
```java
// 批量查询
List<String> symbols = positions.stream()
        .map(Position::getSymbol)
        .toList();
Map<String, Price> priceMap = priceRepository
        .findBySymbolIn(symbols)
        .stream()
        .collect(Collectors.toMap(Price::getSymbol, p -> p));

for (Position position : positions) {
    Price price = priceMap.get(position.getSymbol());
    // ...
}
```

### 5.4 Dockerfile 多阶段构建

```dockerfile
# 阶段 1: 依赖缓存
FROM maven:3.9.9-eclipse-temurin-23-alpine AS deps
WORKDIR /build

# 先复制所有 pom.xml 以利用缓存
COPY pom.xml .
COPY koduck-bom/pom.xml koduck-bom/
COPY koduck-common/pom.xml koduck-common/
COPY koduck-infrastructure/pom.xml koduck-infrastructure/
COPY koduck-auth/pom.xml koduck-auth/
COPY koduck-core/pom.xml koduck-core/
COPY koduck-market/pom.xml koduck-market/
COPY koduck-market/koduck-market-api/pom.xml koduck-market/koduck-market-api/
COPY koduck-market/koduck-market-impl/pom.xml koduck-market/koduck-market-impl/
# ... 其他模块

RUN mvn dependency:go-offline -B

# 阶段 2: 构建
FROM deps AS builder
COPY . .
RUN mvn clean package -DskipTests -B

# 阶段 3: 运行
FROM eclipse-temurin:23-jre-alpine
WORKDIR /app
COPY --from=builder /build/koduck-bootstrap/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 六、常见问题排查

### 6.1 循环依赖问题

**症状**: Maven 构建失败，提示循环依赖

**排查**:
```bash
# 生成依赖树
mvn dependency:tree -pl koduck-core | grep koduck

# 检查是否有 impl 模块相互依赖
```

**解决**:
1. 将共同依赖提取到 api 模块
2. 使用事件机制替代直接调用
3. 引入防腐层接口

### 6.2 类找不到问题

**症状**: 编译错误，找不到类

**排查**:
```bash
# 检查包名是否正确
grep -r "package com.koduck" koduck-market-api/src

# 检查导入是否正确
grep -r "import com.koduck.core" koduck-market-impl/src
```

**解决**:
1. 更新 import 语句
2. 确保依赖正确声明
3. 执行 `mvn clean install`

### 6.3 Spring Bean 找不到

**症状**: 启动失败，提示 Bean 未找到

**排查**:
```bash
# 检查组件扫描路径
grep -r "@ComponentScan" koduck-bootstrap/src

# 检查是否有 @Service 注解
grep -r "@Service" koduck-market-impl/src
```

**解决**:
1. 在 bootstrap 添加组件扫描路径
2. 确保有 `@Service` 或 `@Component` 注解
3. 检查条件注解（如 `@ConditionalOnProperty`）

---

## 七、提交规范

### 7.1 Commit Message 格式

```
feat(architecture): create koduck-market-api module

- Add MarketQueryService and MarketCommandService interfaces
- Add MarketDataDto, KlineDto, IndicatorDto
- Add MarketDataAcl for cross-module access

Refs: #1
```

### 7.2 PR 描述模板

```markdown
## 变更内容
- 创建了 koduck-market-api 模块
- 提取了 Market 领域接口和 DTO

## 关联 Issue
Closes #1

## 检查清单
- [ ] 代码编译通过
- [ ] 单元测试通过
- [ ] ArchUnit 测试通过
- [ ] 文档已更新

## 影响范围
- koduck-core（后续将移除相关代码）
- koduck-market（新增模块）
```

---

## 八、联系与支持

如有问题，请参考：
1. [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md) - 整体计划
2. [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md) - 详细任务
3. [ARCHITECTURE-TASKS-TRACKING.md](./ARCHITECTURE-TASKS-TRACKING.md) - 进度跟踪

---

> **版本**: 1.0.0  
> **更新日期**: 2026-04-05
