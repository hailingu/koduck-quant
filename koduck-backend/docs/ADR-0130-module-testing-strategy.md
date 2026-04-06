# ADR-0130: 模块独立测试策略

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #576

## 背景

随着 Phase 2 各领域模块的拆分完成，每个模块都有了清晰的职责边界。为了确保模块质量和可维护性，需要为每个模块建立独立的测试体系。

目前存在的问题：
1. 各模块缺乏独立的单元测试
2. 代码覆盖率无法量化评估
3. 模块变更时难以评估影响范围

## 决策

为每个 impl 模块建立独立的单元测试体系，并配置 JaCoCo 代码覆盖率检查。

### 测试策略

```
koduck-market-impl/
├── src/
│   ├── main/java/
│   └── test/java/           # 单元测试
│       └── com/koduck/market/
│           ├── service/
│           │   └── MarketDataServiceTest.java
│           └── repository/
│               └── MarketDataRepositoryTest.java
└── pom.xml                  # JaCoCo 配置

koduck-portfolio-impl/
├── src/
│   ├── main/java/
│   └── test/java/           # 单元测试
└── pom.xml                  # JaCoCo 配置

... 其他模块类似
```

### 覆盖率目标

| 模块 | 目标覆盖率 | 说明 |
|------|------------|------|
| koduck-market-impl | 60% | Service 层和 Repository 层 |
| koduck-portfolio-impl | 60% | Service 层和 Repository 层 |
| koduck-community-impl | 50% | Service 层为主 |
| koduck-ai-impl | 50% | Service 层（LLM 调用 Mock）|

### 测试类型

1. **单元测试**: 测试单个类或方法，使用 Mockito 模拟依赖
2. **集成测试**: 测试多个组件的协作，使用 @DataJpaTest 等
3. **切片测试**: 使用 Spring Boot 的测试切片（@WebMvcTest, @DataJpaTest）

## 权衡

### 替代方案

1. **集中测试**: 在 koduck-bootstrap 中统一测试所有模块
   - ❌ 无法独立测试单个模块
   - ❌ 测试运行时间长
   - ❌ 难以定位问题

2. **仅测试 API**: 只测试 API 模块的接口
   - ❌ 无法覆盖实现逻辑
   - ❌ 无法测试 Repository 层

3. **使用 TestContainers**: 使用真实数据库进行集成测试
   - ✅ 更接近生产环境
   - ❌ 测试运行时间长
   - ❌ 资源消耗大
   - ⏸️ 可作为补充，不作为主要方案

### 选择当前方案的理由

1. **独立性**: 每个模块可以独立测试，不依赖其他模块
2. **快速反馈**: 单元测试运行快，开发时快速验证
3. **可维护性**: 测试代码与业务代码在一起，便于维护
4. **CI 友好**: 可以在 CI 中并行运行各模块测试

## 影响

### 模块变更

每个 impl 模块需要：
1. 添加 `src/test/java` 目录
2. 添加测试依赖（spring-boot-starter-test, h2）
3. 配置 JaCoCo 插件
4. 编写测试类

### 构建流程

```bash
# 运行单个模块测试
mvn -pl koduck-market/koduck-market-impl test

# 运行所有模块测试
mvn test

# 生成覆盖率报告
mvn jacoco:report
```

### CI 集成

GitHub Actions 需要更新：
1. 运行各模块测试
2. 收集覆盖率报告
3. 检查覆盖率是否达标

## 实施计划

### Phase 1: 配置 JaCoCo
1. 在各 impl 模块 pom.xml 中添加 JaCoCo 插件
2. 配置覆盖率目标
3. 验证报告生成

### Phase 2: 添加测试
1. 为 koduck-market-impl 添加测试
2. 为 koduck-portfolio-impl 添加测试
3. 为 koduck-community-impl 添加测试
4. 为 koduck-ai-impl 添加测试

### Phase 3: 验证
1. 运行所有测试
2. 检查覆盖率
3. 修复失败的测试

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
- [JaCoCo Documentation](https://www.jacoco.org/jacoco/trunk/doc/)
