# ADR-0100: 迁移 koduck-ai 代码到独立模块 (Phase 3.2)

- Status: Accepted
- Date: 2026-04-05
- Issue: #495

## Context

根据 ADR-0098 和 ADR-0099 (Phase 3.1)，防腐层已成功引入 koduck-core。现在可以安全地将 koduck-ai 代码迁移到独立模块。

Phase 3.1 完成的防腐层接口：
- PortfolioQueryService
- StrategyQueryService
- BacktestQueryService
- UserSettingsQueryService
- UserMemoryProfileQueryService

## Decision

### 迁移 koduck-ai 代码到独立模块

将 koduck-core 中的 AI 相关代码迁移到 koduck-ai 模块，包括：

#### 迁移内容

```
koduck-ai/
├── controller/
│   └── AiAnalysisController
├── service/
│   ├── AiAnalysisServiceImpl (修改后)
│   └── MemoryServiceImpl (修改后)
├── entity/
│   ├── MemoryChatMessage
│   └── MemoryChatSession
├── repository/
│   ├── MemoryChatMessageRepository
│   └── MemoryChatSessionRepository
├── dto/ai/
│   └── (所有 AI DTO)
└── support/
    ├── AiConversationSupport
    ├── AiRecommendationSupport
    └── AiStreamRelaySupport
```

#### 保留在 koduck-core

```
koduck-core/
├── acl/ (防腐层接口和实现)
├── service/
│   ├── AiAnalysisService (接口)
│   └── MemoryService (接口)
```

### 关键修改

#### AiAnalysisServiceImpl 修改

**Before (直接依赖 Repository)**:
```java
@Service
public class AiAnalysisServiceImpl implements AiAnalysisService {
    private final PortfolioPositionRepository positionRepository;
    private final StrategyRepository strategyRepository;
    private final BacktestResultRepository backtestResultRepository;
    private final UserSettingsService userSettingsService;
    // ...
}
```

**After (通过防腐层)**:
```java
@Service
public class AiAnalysisServiceImpl implements AiAnalysisService {
    private final PortfolioQueryService portfolioQueryService;
    private final StrategyQueryService strategyQueryService;
    private final BacktestQueryService backtestQueryService;
    private final UserSettingsQueryService userSettingsQueryService;
    // ...
}
```

#### MemoryServiceImpl 修改

**Before (直接依赖 Repository)**:
```java
@Service
public class MemoryServiceImpl implements MemoryService {
    private final UserMemoryProfileRepository memoryProfileRepository;
    // ...
}
```

**After (通过防腐层)**:
```java
@Service
public class MemoryServiceImpl implements MemoryService {
    private final UserMemoryProfileQueryService userMemoryProfileQueryService;
    // ...
}
```

### 模块依赖关系

```
koduck-bootstrap
    ├── koduck-market → koduck-core
    ├── koduck-strategy → koduck-core
    ├── koduck-ai → koduck-core (通过防腐层接口)
    └── koduck-core (包含防腐层实现)
        ├── koduck-auth
        └── koduck-common
```

## Consequences

### 正向影响

1. **编译效率提升**: 修改 AI 代码无需重新编译整个 koduck-core
2. **职责分离**: AI 业务逻辑与基础设施分离
3. **团队并行**: AI 团队可独立开发 koduck-ai 模块
4. **为未来独立部署奠定基础**: AI 模块可独立扩容

### 代价与影响

1. **防腐层维护**: 需要维护额外的接口和实现
2. **性能损耗**: 额外的对象转换层（本地调用，影响极小）

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 路径、请求/响应格式保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 行为兼容 | ✅ 无变化 | 业务逻辑保持不变 |

## Implementation

### 任务清单

1. [ ] 更新 koduck-ai/pom.xml，添加 koduck-core 依赖
2. [ ] 修改 AiAnalysisServiceImpl，使用防腐层接口
3. [ ] 修改 MemoryServiceImpl，使用防腐层接口
4. [ ] 创建 koduck-ai 目录结构
5. [ ] 迁移 Controller: AiAnalysisController
6. [ ] 迁移 ServiceImpl: AiAnalysisServiceImpl, MemoryServiceImpl
7. [ ] 迁移 Entity: MemoryChatMessage, MemoryChatSession
8. [ ] 迁移 Repository: MemoryChatMessageRepository, MemoryChatSessionRepository
9. [ ] 迁移 DTO: 所有 AI DTO
10. [ ] 迁移 Support: AiConversationSupport, AiRecommendationSupport, AiStreamRelaySupport
11. [ ] 从 koduck-core 删除已迁移的代码
12. [ ] 验证编译通过
13. [ ] 运行所有测试

## Alternatives Considered

### 1. 保留 AiAnalysisServiceImpl 在 koduck-core
- **拒绝**: 无法达到 koduck-ai 模块独立的目标
- **当前方案**: 将 ServiceImpl 迁移到 koduck-ai，保留接口在 koduck-core

### 2. 完全独立 koduck-ai，不依赖 koduck-core
- **拒绝**: 需要复制大量基础设施代码（异常类、常量等）
- **当前方案**: koduck-ai 依赖 koduck-core 的防腐层和基础设施

## Verification

- [ ] koduck-ai/pom.xml 更新完成
- [ ] AiAnalysisServiceImpl 使用防腐层接口
- [ ] MemoryServiceImpl 使用防腐层接口
- [ ] Controller 迁移完成
- [ ] ServiceImpl 迁移完成
- [ ] Entity 迁移完成
- [ ] Repository 迁移完成
- [ ] DTO 迁移完成
- [ ] Support 迁移完成
- [ ] koduck-core 清理完成
- [ ] mvn clean compile 编译通过
- [ ] ./scripts/quality-check.sh 全绿
- [ ] mvn checkstyle:check 无异常
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过

## References

- AI-MODULE-SPLIT-REASSESSMENT.md
- ADR-0098: Koduck-AI 模块拆分重新评估与决策
- ADR-0099: 引入防腐层解耦 koduck-ai 依赖 (Phase 3.1)
- Issue: #495
