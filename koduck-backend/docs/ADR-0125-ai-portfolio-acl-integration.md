# ADR-0125: AI 模块 Portfolio ACL 集成

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #564

## 背景

在 Phase 2.2 中，我们成功创建了 koduck-portfolio-impl 模块并迁移了 Portfolio 领域的实现代码。koduck-portfolio-api 模块提供了 `PortfolioQueryService` ACL 接口，供其他领域模块查询投资组合数据。

当前 AI 模块（koduck-ai）在之前的重构中被清理，需要重新建立。本次任务的目标是让 AI 模块通过 ACL 接口访问 Portfolio 数据，而不是直接依赖 Repository。

## 决策

重建 koduck-ai 模块，使其通过 `PortfolioQueryService` ACL 接口访问 Portfolio 数据。

### 架构设计

```
koduck-ai/
├── pom.xml                           # 依赖 koduck-portfolio-api
└── src/main/java/com/koduck/ai/
    ├── service/
    │   └── AiAnalysisServiceImpl.java  # 注入 PortfolioQueryService
    └── dto/
        └── PortfolioAnalysisRequest.java
```

### 依赖关系

```
koduck-ai
    ├── koduck-portfolio-api (ACL 接口)
    ├── koduck-market-api (行情数据)
    └── koduck-common (工具类)
```

### ACL 使用方式

```java
@Service
@RequiredArgsConstructor
public class AiAnalysisServiceImpl {
    
    private final PortfolioQueryService portfolioQueryService;
    
    public AnalysisResult analyzePortfolio(Long userId) {
        // 通过 ACL 获取投资组合快照
        List<PortfolioSnapshot> snapshots = 
            portfolioQueryService.getUserSnapshots(userId);
        
        // AI 分析逻辑...
    }
}
```

## 权衡

### 替代方案

1. **直接依赖 koduck-portfolio-impl**: AI 模块直接依赖实现模块
   - ❌ 违反依赖倒置原则
   - ❌ 无法独立部署 AI 模块
   - ❌ 实现变更会影响 AI 模块

2. **使用事件驱动**: AI 模块监听 Portfolio 变更事件
   - ✅ 更好的解耦
   - ❌ 实现复杂度较高
   - ❌ 需要引入事件总线
   - ⏸️ 未来可考虑，当前使用 ACL 更简单

### 选择当前方案的理由

1. **清晰的边界**: AI 模块只依赖 Portfolio 的 ACL 接口
2. **可测试性**: 可以轻松 Mock ACL 接口进行单元测试
3. **渐进式演进**: 后续可以迁移到事件驱动，不影响现有代码

## 影响

### 兼容性影响

- **koduck-ai**: 需要重新建立，依赖 koduck-portfolio-api
- **koduck-bootstrap**: 需要添加 koduck-ai 依赖

### 数据模型

AI 分析需要的 Portfolio 数据：
- 投资组合汇总（总市值、总成本、总收益）
- 持仓列表（股票代码、数量、成本、市值）
- 交易记录（用于分析交易行为）

这些数据都可以通过 `PortfolioQueryService` ACL 接口获取。

## 实施计划

1. 更新 koduck-ai/pom.xml，添加 koduck-portfolio-api 依赖
2. 创建 AiAnalysisService 接口和实现
3. 注入 PortfolioQueryService ACL 接口
4. 实现 AI 分析逻辑（骨架实现）
5. 编写单元测试
6. 更新 koduck-bootstrap 依赖

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-PLAYBOOK.md](./ARCHITECTURE-PLAYBOOK.md)
- ADR-0122: Portfolio 领域实现模块迁移
