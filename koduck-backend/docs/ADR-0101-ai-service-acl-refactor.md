# ADR-0101: AiAnalysisServiceImpl 和 MemoryServiceImpl 使用防腐层接口

- Status: Accepted
- Date: 2026-04-05
- Issue: #500

## Context

Phase 3.2 代码迁移已完成（PR #499），但核心架构目标未达成：AiAnalysisServiceImpl 和 MemoryServiceImpl 仍直接依赖 koduck-core 的 Repository，而非使用防腐层接口。

### 当前问题

**AiAnalysisServiceImpl 直接依赖**：
- `BacktestResultRepository`
- `PortfolioPositionRepository`
- `StrategyRepository`
- `UserSettingsService`

**MemoryServiceImpl 直接依赖**：
- `UserMemoryProfileRepository`

这种直接依赖导致：
1. koduck-ai 与 koduck-core 紧耦合
2. 无法独立编译 koduck-ai（需要 koduck-core 的 Repository 实现）
3. 违背 ADR-0098 和 ADR-0100 的设计目标

## Decision

### 使用防腐层接口替代直接 Repository 依赖

将 ServiceImpl 中的 Repository 依赖替换为对应的防腐层接口：

| 原依赖 | 替换为 |
|--------|--------|
| `BacktestResultRepository` | `BacktestQueryService` |
| `PortfolioPositionRepository` | `PortfolioQueryService` |
| `StrategyRepository` | `StrategyQueryService` |
| `UserSettingsService` | `UserSettingsQueryService` |
| `UserMemoryProfileRepository` | `UserMemoryProfileQueryService` |

### 代码变更示例

**AiAnalysisServiceImpl Before**:
```java
@Service
public class AiAnalysisServiceImpl implements AiAnalysisService {
    private final BacktestResultRepository backtestResultRepository;
    private final PortfolioPositionRepository portfolioPositionRepository;
    private final StrategyRepository strategyRepository;
    private final UserSettingsService userSettingsService;
    // ...
}
```

**AiAnalysisServiceImpl After**:
```java
@Service
public class AiAnalysisServiceImpl implements AiAnalysisService {
    private final BacktestQueryService backtestQueryService;
    private final PortfolioQueryService portfolioQueryService;
    private final StrategyQueryService strategyQueryService;
    private final UserSettingsQueryService userSettingsQueryService;
    // ...
}
```

## Consequences

### 正向影响

1. **真正的解耦**: koduck-ai 只依赖 koduck-core 的 ACL 接口，不依赖具体实现
2. **编译隔离**: 修改 koduck-core 的 Repository 实现不影响 koduck-ai
3. **符合 DDD**: 通过防腐层实现 bounded context 隔离
4. **可测试性**: 更容易 mock ACL 接口进行单元测试

### 代价与影响

1. **代码变更量**: 需要修改 AiAnalysisServiceImpl 和 MemoryServiceImpl 的所有依赖点
2. **DTO 转换**: 需要使用 ACL 返回的 DTO 而非 Entity
3. **功能验证**: 需要确保重构后功能完全一致

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 行为兼容 | ✅ 无变化 | 业务逻辑保持不变 |

## Implementation

### 任务清单

1. [ ] 重构 AiAnalysisServiceImpl
   - 替换 BacktestResultRepository → BacktestQueryService
   - 替换 PortfolioPositionRepository → PortfolioQueryService
   - 替换 StrategyRepository → StrategyQueryService
   - 替换 UserSettingsService → UserSettingsQueryService
   - 更新方法实现，使用 DTO 替代 Entity

2. [ ] 重构 MemoryServiceImpl
   - 替换 UserMemoryProfileRepository → UserMemoryProfileQueryService
   - 更新方法实现

3. [ ] 更新 AiAnalysisServiceImplTest
   - Mock ACL 接口而非 Repository

4. [ ] 验证
   - mvn clean compile 编译通过
   - 所有测试通过
   - quality-check.sh 全绿

## Verification

- [ ] AiAnalysisServiceImpl 使用防腐层接口
- [ ] MemoryServiceImpl 使用防腐层接口
- [ ] 编译通过
- [ ] 测试通过
- [ ] quality-check.sh 全绿

## References

- ADR-0098: Koduck-AI 模块拆分重新评估与决策
- ADR-0100: 迁移 koduck-ai 代码到独立模块 (Phase 3.2)
- AI-MODULE-SPLIT-REASSESSMENT.md
- Issue: #500
