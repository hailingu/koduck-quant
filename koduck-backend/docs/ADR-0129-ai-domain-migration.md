# ADR-0129: AI 领域模块迁移

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #574

## 背景

koduck-ai 模块目前是一个独立的 jar 模块，包含 AI 分析服务的接口和实现。为了与其他领域模块保持一致，遵循 API/Impl 分离的架构原则，需要将其重构为父模块 + api/impl 子模块的结构。

## 决策

重构 koduck-ai 模块：
1. 将 koduck-ai 从 jar 改为 pom 父模块
2. 创建 koduck-ai-api 子模块（接口与 DTO）
3. 创建 koduck-ai-impl 子模块（实现）

### 架构变更

```
Before:
koduck-ai (jar)
├── service/
│   ├── AiAnalysisService.java      (接口)
│   └── impl/
│       └── AiAnalysisServiceImpl.java  (实现)
├── dto/
│   ├── PortfolioRiskAssessment.java
│   └── PortfolioOptimizationSuggestion.java
├── config/
│   └── AiModuleConfig.java
└── pom.xml

After:
koduck-ai (pom)
├── koduck-ai-api/
│   ├── api/
│   │   └── AiAnalysisService.java      (接口)
│   ├── dto/
│   │   ├── PortfolioRiskAssessment.java
│   │   └── PortfolioOptimizationSuggestion.java
│   └── pom.xml
├── koduck-ai-impl/
│   ├── service/
│   │   └── AiAnalysisServiceImpl.java  (实现)
│   ├── config/
│   │   └── AiModuleConfig.java
│   └── pom.xml
└── pom.xml
```

### 依赖关系

```
koduck-ai-api
    ├── koduck-common (工具类)
    ├── koduck-portfolio-api (ACL)
    ├── koduck-strategy-api (ACL)
    └── koduck-market-api (ACL)

koduck-ai-impl
    ├── koduck-ai-api (接口)
    ├── koduck-infrastructure (技术实现)
    └── koduck-common (工具类)
```

## 权衡

### 替代方案

1. **保持现状**: 不重构 koduck-ai 模块
   - ❌ 与其他模块架构不一致
   - ❌ 接口和实现耦合
   - ❌ 不利于独立测试

2. **完全移除 AI 模块**: 将 AI 功能分散到其他模块
   - ✅ 减少模块数量
   - ❌ AI 是独立领域，应该独立存在
   - ❌ 破坏领域边界

3. **合并到 koduck-core**: 将 AI 功能移回 Core
   - ❌ 违反模块化原则
   - ❌ Core 模块已经瘦身

### 选择当前方案的理由

1. **架构一致性**: 与其他领域模块（Market、Portfolio、Strategy、Community）保持一致
2. **可测试性**: 可以独立测试 AI 接口和实现
3. **依赖清晰**: API 模块只暴露必要接口，隐藏实现细节
4. **未来扩展**: 便于后续添加更多 AI 功能

## 影响

### 兼容性影响

- **koduck-ai**: 从 jar 变为 pom，需要更新所有依赖它的模块
- **koduck-bootstrap**: 需要改为依赖 koduck-ai-impl
- **koduck-core**: 如果依赖 koduck-ai，需要改为依赖 koduck-ai-api

### 数据模型

AI 领域目前包含：
- **AiAnalysisService**: AI 分析服务接口
- **PortfolioRiskAssessment**: 投资组合风险评估
- **PortfolioOptimizationSuggestion**: 投资组合优化建议

## 实施计划

### Phase 1: 创建 koduck-ai-api 模块
1. 创建目录结构
2. 创建 pom.xml
3. 迁移 AiAnalysisService 接口
4. 迁移 DTO 类

### Phase 2: 创建 koduck-ai-impl 模块
1. 创建目录结构
2. 创建 pom.xml
3. 迁移 AiAnalysisServiceImpl
4. 迁移 AiModuleConfig

### Phase 3: 更新 koduck-ai 父模块
1. 更新 pom.xml 为父模块
2. 添加 api 和 impl 子模块

### Phase 4: 更新依赖
1. 更新 koduck-backend/pom.xml dependency management
2. 更新 koduck-bootstrap/pom.xml

### Phase 5: 验证
1. 编译检查
2. 运行测试
3. 验证功能正常

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
- ADR-0125: AI 模块 Portfolio ACL 集成
