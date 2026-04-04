# ADR-0099: 引入防腐层解耦 koduck-ai 依赖 (Phase 3.1)

- Status: Accepted
- Date: 2026-04-05
- Issue: #493

## Context

根据 ADR-0098 和 AI-MODULE-SPLIT-REASSESSMENT.md，koduck-ai 模块的拆分被暂缓，原因是存在复杂的依赖关系：

1. **AiAnalysisServiceImpl** 直接依赖：
   - `PortfolioPositionRepository` (portfolio 领域)
   - `StrategyRepository` (strategy 领域)
   - `BacktestResultRepository` (backtest 领域)
   - `UserSettingsService` (user 领域)

2. **MemoryServiceImpl** 直接依赖：
   - `UserMemoryProfileRepository` (user 领域)

这些直接 Repository 依赖使得 koduck-ai 无法独立拆分。

## Decision

### 引入防腐层 (Anti-Corruption Layer, ACL)

在 koduck-core 中定义**查询接口**，由 koduck-core 实现，koduck-ai 通过接口访问其他领域数据。

### 防腐层接口定义

#### 1. PortfolioQueryService

```java
package com.koduck.acl;

public interface PortfolioQueryService {
    List<PortfolioPositionSummary> findPositionsByUserId(Long userId);
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
    Optional<StrategySummary> findStrategyById(Long strategyId);
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
    LlmConfigDto getLlmConfig(Long userId, String provider);
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
```

#### 5. UserMemoryProfileQueryService

```java
package com.koduck.acl;

public interface UserMemoryProfileQueryService {
    Optional<UserMemoryProfileDto> findByUserId(Long userId);
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

### 架构调整

**Before (直接依赖)**:
```
AiAnalysisServiceImpl
    ├── PortfolioPositionRepository (直接依赖)
    ├── StrategyRepository (直接依赖)
    ├── BacktestResultRepository (直接依赖)
    └── UserSettingsService (直接依赖)
```

**After (通过 ACL)**:
```
AiAnalysisServiceImpl
    ├── PortfolioQueryService (接口)
    ├── StrategyQueryService (接口)
    ├── BacktestQueryService (接口)
    └── UserSettingsQueryService (接口)

koduck-core
    ├── PortfolioQueryServiceImpl (实现)
    ├── StrategyQueryServiceImpl (实现)
    ├── BacktestQueryServiceImpl (实现)
    └── UserSettingsQueryServiceImpl (实现)
```

## Consequences

### 正向影响

1. **解耦成功**: koduck-ai 不再直接依赖其他领域的 Repository
2. **接口契约化**: 明确的接口契约，便于后续模块拆分
3. **可测试性提升**: 可以 Mock 防腐层接口进行单元测试
4. **为未来拆分奠定基础**: Phase 3.2 可以直接迁移 koduck-ai 代码

### 代价与影响

1. **额外代码**: 需要维护防腐层接口和实现
2. **性能损耗**: 额外的对象转换层（本地调用，影响极小）
3. **开发成本**: 需要修改现有代码，引入接口层

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 路径、请求/响应格式保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 行为兼容 | ✅ 无变化 | 业务逻辑保持不变 |

## Implementation

### 任务清单

1. [ ] 创建 `com.koduck.acl` 包
2. [ ] 定义 PortfolioQueryService 接口和 DTO
3. [ ] 定义 StrategyQueryService 接口和 DTO
4. [ ] 定义 BacktestQueryService 接口和 DTO
5. [ ] 定义 UserSettingsQueryService 接口
6. [ ] 定义 UserMemoryProfileQueryService 接口和 DTO
7. [ ] 实现 PortfolioQueryServiceImpl
8. [ ] 实现 StrategyQueryServiceImpl
9. [ ] 实现 BacktestQueryServiceImpl
10. [ ] 实现 UserSettingsQueryServiceImpl
11. [ ] 实现 UserMemoryProfileQueryServiceImpl
12. [ ] 修改 AiAnalysisServiceImpl，使用防腐层接口
13. [ ] 修改 MemoryServiceImpl，使用防腐层接口
14. [ ] 验证编译通过
15. [ ] 运行所有测试

## Alternatives Considered

### 1. 直接拆分，不引入防腐层
- **拒绝**: 会导致 koduck-ai 直接依赖 koduck-core 的 Repository，形成循环依赖
- **当前方案**: 通过防腐层解耦，保持依赖方向清晰

### 2. 使用 Facade 模式
- **拒绝**: Facade 模式主要用于简化复杂接口，不适合解耦跨领域依赖
- **当前方案**: 防腐层更适合 DDD  bounded context 间的依赖管理

### 3. 使用事件驱动
- **暂不采用**: 引入消息队列会增加系统复杂度
- **未来演进**: 若需要完全独立部署，可考虑引入事件驱动

## Verification

- [ ] 防腐层接口定义完成
- [ ] 防腐层实现完成
- [ ] AiAnalysisServiceImpl 使用防腐层接口
- [ ] MemoryServiceImpl 使用防腐层接口
- [ ] mvn clean compile 编译通过
- [ ] ./scripts/quality-check.sh 全绿
- [ ] mvn checkstyle:check 无异常
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过

## References

- AI-MODULE-SPLIT-REASSESSMENT.md
- ADR-0098: Koduck-AI 模块拆分重新评估与决策
- ADR-0097: 拆分 koduck-ai 模块 (Phase 3) - 暂缓版
- DDD 领域驱动设计 - 防腐层模式
- Issue: #493
