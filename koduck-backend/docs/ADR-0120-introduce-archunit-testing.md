# ADR-0120: 引入 ArchUnit 架构测试

- Status: Proposed
- Date: 2026-04-05
- Issue: #558

## Context

根据 ARCHITECTURE-EVALUATION.md 的评估结果，当前 koduck-backend 存在严重的架构问题：

1. **模块依赖方向混乱**: koduck-core 依赖 koduck-portfolio，koduck-market 又依赖 koduck-core，形成循环依赖
2. **缺乏架构守护**: 没有自动化机制防止架构退化，违规依赖可能在代码审查中被遗漏
3. **API 模块约束**: 需要确保 API 模块（koduck-*-api）不依赖实现模块

为解决这些问题，需要引入架构测试框架，在 CI 中自动验证架构规则。

### 技术选型

| 框架 | 用途 | 版本 |
|------|------|------|
| ArchUnit | Java 架构测试 | 1.2.1 |
| JUnit 5 | 测试运行 | 内置 |

ArchUnit 是业界标准的 Java 架构测试框架，可以：
- 验证包依赖关系
- 检查循环依赖
- 验证分层架构
- 检查命名规范

## Decision

### 引入 ArchUnit 架构测试

在 koduck-bootstrap 模块中引入 ArchUnit 测试，编写以下架构规则：

### 规则设计

#### 1. API 模块规则 (ApiModuleRulesTest)

```java
// API 模块不应依赖实现模块
noClasses()
    .that().resideInAPackage("..api..")
    .should().dependOnClassesThat()
    .resideInAPackage("..impl..");

// API 模块不应依赖 Spring Web
noClasses()
    .that().resideInAPackage("..api..")
    .should().dependOnClassesThat()
    .resideInAPackage("org.springframework.web..");
```

#### 2. 领域依赖规则 (DomainDependencyRulesTest)

```java
// 领域模块间不应有循环依赖
slices()
    .matching("com.koduck.(*)..")
    .should().beFreeOfCycles();

// koduck-core 不应依赖其他领域模块的实现
noClasses()
    .that().resideInAPackage("com.koduck.core..")
    .should().dependOnClassesThat()
    .resideInAnyPackage(
        "com.koduck.market.impl..",
        "com.koduck.portfolio.impl.."
    );
```

#### 3. 分层架构规则 (LayeredArchitectureTest)

```java
layeredArchitecture()
    .layer("API").definedBy("..api..")
    .layer("Impl").definedBy("..impl..")
    .layer("Infrastructure").definedBy("..infrastructure..")
    .layer("Common").definedBy("..common..")
    .whereLayer("API").mayNotAccessAnyLayer()
    .whereLayer("Impl").mayOnlyAccessLayers("API", "Infrastructure", "Common");
```

#### 4. 命名规范规则 (NamingConventionTest)

```java
// Service 接口应以 Service 结尾
classes()
    .that().resideInAPackage("..api..")
    .and().areInterfaces()
    .should().haveNameMatching(".*Service");

// DTO 应以 Dto 结尾
classes()
    .that().resideInAPackage("..dto..")
    .should().haveNameMatching(".*Dto");
```

### 测试结构

```
koduck-bootstrap/src/test/java/com/koduck/architecture/
├── ArchitectureConstants.java       # 包结构常量定义
├── ApiModuleRulesTest.java          # API 模块规则测试
├── DomainDependencyRulesTest.java   # 领域依赖规则测试
├── LayeredArchitectureTest.java     # 分层架构规则测试
└── NamingConventionTest.java        # 命名规范规则测试
```

### CI 集成

架构测试将在以下阶段运行：
1. **本地开发**: `./scripts/quality-check.sh` 包含架构测试
2. **CI 构建**: GitHub Actions 中运行 `mvn test`
3. **PR 检查**: 架构测试失败将阻断 PR 合并

## Consequences

### 正向影响

1. **自动架构守护**: 违规依赖在 CI 阶段即被发现，不会进入主分支
2. **文档化架构**: 架构规则以代码形式存在，成为活文档
3. **降低审查负担**: 机器自动检查架构规则，人工审查专注于业务逻辑
4. **渐进式改进**: 可以逐步添加新规则，持续改进架构

### 权衡

| 方面 | 权衡 | 决策 |
|------|------|------|
| **构建时间** | 架构测试增加构建时间（约 10-30 秒） | 接受，换取架构质量 |
| **学习成本** | 团队需要学习 ArchUnit API | 提供培训和文档 |
| **规则维护** | 架构变更时需要同步更新规则 | 由架构负责人维护 |

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 现有代码 | ⚠️ 可能需要调整 | 如果现有代码违反规则，需要修复 |
| 构建流程 | ✅ 增强 | 新增架构测试阶段 |
| CI/CD | ✅ 增强 | 新增架构检查门禁 |

## Implementation

### 实施步骤

1. **添加依赖**
   ```xml
   <dependency>
       <groupId>com.tngtech.archunit</groupId>
       <artifactId>archunit-junit5</artifactId>
       <version>1.2.1</version>
       <scope>test</scope>
   </dependency>
   ```

2. **创建测试类**
   - ArchitectureConstants: 定义包结构常量
   - ApiModuleRulesTest: API 模块规则
   - DomainDependencyRulesTest: 领域依赖规则
   - LayeredArchitectureTest: 分层架构规则
   - NamingConventionTest: 命名规范规则

3. **验证现有代码**
   - 运行所有架构测试
   - 修复违规代码（如有）
   - 确保所有测试通过

4. **集成到 CI**
   - 更新 quality-check.sh
   - 更新 GitHub Actions

### 验证步骤

- [ ] `mvn test` 包含架构测试
- [ ] 所有架构测试通过
- [ ] CI 中架构测试失败阻断构建
- [ ] 规则有中文注释说明

## References

- Issue: #558
- ARCHITECTURE-EVALUATION.md: 关键缺陷 S-02
- ARCHITECTURE-IMPROVEMENT-PLAN.md: Phase 1
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)
- ADR-0118: 创建 koduck-market-api 模块
- ADR-0119: 创建 koduck-portfolio-api 模块
