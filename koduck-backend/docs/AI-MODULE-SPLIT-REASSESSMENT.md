# Koduck-AI 模块拆分重新评估报告

> **日期**: 2026-04-05  
> **评估人**: AI Architect  
> **状态**: 建议实施（条件成熟）

## 执行摘要

经过深入分析，**koduck-ai 模块拆分是可行的**，但需要引入**防腐层 (Anti-Corruption Layer, ACL)** 来解耦复杂的依赖关系。

建议采用**分阶段实施**策略：
1. **Phase 3.1**: 引入防腐层接口，解耦 Repository 直接依赖
2. **Phase 3.2**: 迁移 koduck-ai 代码到独立模块
3. **Phase 3.3**: 优化和清理

## 当前依赖分析

### AiAnalysisServiceImpl 依赖矩阵

| 依赖类型 | 具体依赖 | 使用场景 | 解耦难度 |
|---------|---------|---------|---------|
| **Repository** | PortfolioPositionRepository | 获取用户持仓用于风险分析 | 中 |
| **Repository** | StrategyRepository | 获取策略信息用于策略推荐 | 中 |
| **Repository** | BacktestResultRepository | 获取回测结果用于回测解读 | 中 |
| **Service** | UserSettingsService | 获取用户 LLM 配置 | 低 |
| **Support** | AiConversationSupport | 对话上下文增强 | 高 |
| **Support** | AiStreamRelaySupport | SSE 流转发 | 低 |
| **Support** | AiRecommendationSupport | 生成推荐结果 | 高 |

### MemoryServiceImpl 依赖矩阵

| 依赖类型 | 具体依赖 | 使用场景 | 解耦难度 |
|---------|---------|---------|---------|
| **Repository** | MemoryChatSessionRepository | AI 领域内部 | 无需解耦 |
| **Repository** | MemoryChatMessageRepository | AI 领域内部 | 无需解耦 |
| **Repository** | UserMemoryProfileRepository | 用户领域 | 中 |

### Support 类依赖矩阵

| Support 类 | 依赖 | 解耦策略 |
|-----------|------|---------|
| AiConversationSupport | MemoryService, TechnicalIndicatorService | MemoryService 随 AI 迁移，TechnicalIndicatorService 通过 ACL |
| AiRecommendationSupport | 无直接 Service/Repository 依赖 | 可直接迁移 |
| AiStreamRelaySupport | 无直接 Service/Repository 依赖 | 可直接迁移 |

## 解耦方案设计

### 核心思路：防腐层 (ACL)

在 koduck-core 中定义**查询接口**，由 koduck-core 实现，koduck-ai 通过接口访问其他领域数据。

```
koduck-ai
    ├── AiAnalysisServiceImpl
    │   ├── PortfolioQueryService (接口)
    │   ├── StrategyQueryService (接口)
    │   ├── BacktestQueryService (接口)
    │   └── UserSettingsQueryService (接口)
    └── MemoryServiceImpl
        └── UserMemoryProfileQueryService (接口)

koduck-core
    ├── PortfolioQueryServiceImpl (实现)
    ├── StrategyQueryServiceImpl (实现)
    ├── BacktestQueryServiceImpl (实现)
    ├── UserSettingsQueryServiceImpl (实现)
    └── UserMemoryProfileQueryServiceImpl (实现)
```

### 防腐层接口设计

#### 1. PortfolioQueryService

```java
package com.koduck.acl;

public interface PortfolioQueryService {
    
    /**
     * 获取用户持仓列表（简化视图）
     */
    List<PortfolioPositionSummary> findPositionsByUserId(Long userId);
    
    /**
     * 获取单个持仓详情
     */
    Optional<PortfolioPositionSummary> findPositionById(Long positionId);
    
    @Value
    class PortfolioPositionSummary {
        Long id;
        String symbol;
        String market;
        BigDecimal quantity;
        BigDecimal averagePrice;
        BigDecimal currentPrice;
    }
}
```

#### 2. StrategyQueryService

```java
package com.koduck.acl;

public interface StrategyQueryService {
    
    /**
     * 获取策略摘要信息
     */
    Optional<StrategySummary> findStrategyById(Long strategyId);
    
    /**
     * 获取用户策略列表
     */
    List<StrategySummary> findStrategiesByUserId(Long userId);
    
    @Value
    class StrategySummary {
        Long id;
        String name;
        String type;
        String description;
    }
}
```

#### 3. BacktestQueryService

```java
package com.koduck.acl;

public interface BacktestQueryService {
    
    /**
     * 获取回测结果摘要
     */
    Optional<BacktestResultSummary> findResultById(Long resultId);
    
    @Value
    class BacktestResultSummary {
        Long id;
        String symbol;
        String strategyName;
        BigDecimal totalReturn;
        BigDecimal maxDrawdown;
        Integer tradeCount;
    }
}
```

#### 4. UserSettingsQueryService

```java
package com.koduck.acl;

public interface UserSettingsQueryService {
    
    /**
     * 获取用户 LLM 配置
     */
    LlmConfigDto getLlmConfig(Long userId, String provider);
    
    /**
     * 获取有效 LLM 配置（合并默认配置）
     */
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
```

#### 5. UserMemoryProfileQueryService

```java
package com.koduck.acl;

public interface UserMemoryProfileQueryService {
    
    /**
     * 获取用户记忆配置
     */
    Optional<UserMemoryProfileDto> findByUserId(Long userId);
    
    /**
     * 更新用户记忆配置
     */
    void updateProfile(Long userId, UserMemoryProfileDto profile);
    
    @Value
    class UserMemoryProfileDto {
        Long userId;
        String preferredStyle;
        String riskTolerance;
        Map<String, Object> preferences;
    }
}
```

### TechnicalIndicatorService 处理

AiConversationSupport 依赖 TechnicalIndicatorService，这是一个**跨领域依赖**。

**解决方案**：
- 方案 A: TechnicalIndicatorService 接口保留在 koduck-core，koduck-ai 通过依赖注入使用
- 方案 B: 创建 TechnicalIndicatorQueryService 防腐层接口

**建议采用方案 A**，因为 TechnicalIndicatorService 是只读服务，且 koduck-market 已拆分。

## 实施计划

### Phase 3.1: 引入防腐层（1-2 周）

**目标**：在 koduck-core 中创建防腐层接口和实现

**任务清单**：
1. [ ] 创建 `com.koduck.acl` 包
2. [ ] 定义 PortfolioQueryService 接口
3. [ ] 定义 StrategyQueryService 接口
4. [ ] 定义 BacktestQueryService 接口
5. [ ] 定义 UserSettingsQueryService 接口
6. [ ] 定义 UserMemoryProfileQueryService 接口
7. [ ] 在 koduck-core 中实现上述接口
8. [ ] 修改 AiAnalysisServiceImpl，使用防腐层接口替代直接 Repository 访问
9. [ ] 修改 MemoryServiceImpl，使用防腐层接口替代直接 Repository 访问
10. [ ] 验证编译通过，所有测试通过

**代码示例**：

```java
// koduck-core: 防腐层实现
@Service
@RequiredArgsConstructor
public class PortfolioQueryServiceImpl implements PortfolioQueryService {
    
    private final PortfolioPositionRepository repository;
    
    @Override
    public List<PortfolioPositionSummary> findPositionsByUserId(Long userId) {
        return repository.findByUserId(userId).stream()
            .map(this::toSummary)
            .collect(Collectors.toList());
    }
    
    private PortfolioPositionSummary toSummary(PortfolioPosition position) {
        return new PortfolioPositionSummary(
            position.getId(),
            position.getSymbol(),
            position.getMarket(),
            position.getQuantity(),
            position.getAveragePrice(),
            position.getCurrentPrice()
        );
    }
}
```

### Phase 3.2: 迁移 koduck-ai（1 周）

**目标**：将 koduck-ai 代码迁移到独立模块

**任务清单**：
1. [ ] 更新 koduck-ai/pom.xml，添加 koduck-core 依赖
2. [ ] 创建 koduck-ai 目录结构
3. [ ] 迁移 Controller: AiAnalysisController
4. [ ] 迁移 ServiceImpl: AiAnalysisServiceImpl, MemoryServiceImpl
5. [ ] 迁移 Entity: MemoryChatMessage, MemoryChatSession
6. [ ] 迁移 Repository: MemoryChatMessageRepository, MemoryChatSessionRepository
7. [ ] 迁移 DTO: 所有 AI DTO
8. [ ] 迁移 Support: AiConversationSupport, AiRecommendationSupport, AiStreamRelaySupport
9. [ ] 从 koduck-core 删除已迁移的代码
10. [ ] 验证编译通过

### Phase 3.3: 优化和清理（2-3 天）

**任务清单**：
1. [ ] 运行 quality-check.sh
2. [ ] 运行 checkstyle:check
3. [ ] 运行所有测试
4. [ ] 更新文档
5. [ ] 代码审查

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 防腐层接口设计不完善 | 中 | 中 | 充分评审，预留扩展点 |
| 性能损耗（额外转换层） | 低 | 低 | 本地方法调用，无网络开销 |
| 测试覆盖率下降 | 中 | 中 | 增加防腐层单元测试 |
| 回滚复杂 | 低 | 高 | 分阶段实施，每阶段可独立回滚 |

## 收益分析

| 收益 | 描述 |
|------|------|
| **编译效率** | 修改 AI 代码无需编译整个 koduck-core |
| **独立演进** | AI 模块可独立版本发布 |
| **独立部署** | 未来可将 AI 模块独立部署/扩容 |
| **团队并行** | AI 团队可独立开发 |
| **技术栈独立** | AI 模块未来可独立升级技术栈 |

## 结论与建议

### 结论

**koduck-ai 模块拆分是可行的**，通过引入防腐层可以有效解耦复杂的依赖关系。

### 建议

1. **接受本方案**，开始 Phase 3.1 实施
2. **优先实施防腐层**，这是拆分的关键前提
3. **分阶段验证**，每阶段完成后进行充分测试
4. **保留回滚能力**，确保出现问题时可快速回滚

### 决策检查清单

- [x] 技术可行性分析完成
- [x] 解耦方案设计完成
- [x] 实施计划制定完成
- [x] 风险评估完成
- [ ] 团队评审通过
- [ ] 资源分配确认
- [ ] 实施开始

## 参考文档

- ADR-0095: 拆分 koduck-market 模块 (Phase 1)
- ADR-0096: 拆分 koduck-strategy 模块 (Phase 2)
- ADR-0097: 拆分 koduck-ai 模块 (Phase 3) - 暂缓版
- REALISTIC-MODULE-SPLIT-PLAN.md
- DDD 领域驱动设计 - 防腐层模式
