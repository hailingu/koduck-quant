# ADR-0098: Koduck-AI 模块拆分重新评估与决策

- Status: Accepted
- Date: 2026-04-05
- Issue: #493

## Context

根据 ADR-0097，Phase 3 (koduck-ai 拆分) 被暂缓，原因是发现了复杂的依赖关系：

- AiAnalysisServiceImpl 依赖 PortfolioPositionRepository, StrategyRepository, BacktestResultRepository
- MemoryServiceImpl 依赖 UserMemoryProfileRepository
- Support 类交叉依赖

经过深入分析，我们认为通过引入**防腐层 (Anti-Corruption Layer, ACL)**，这些依赖是可以解耦的。

## Decision

### 接受 koduck-ai 模块拆分方案

**决策**: 实施 koduck-ai 模块拆分，采用**防腐层模式**解耦依赖关系。

### 解耦方案

#### 防腐层接口（koduck-core 中定义）

```java
// com.koduck.acl.PortfolioQueryService
public interface PortfolioQueryService {
    List<PortfolioPositionSummary> findPositionsByUserId(Long userId);
    Optional<PortfolioPositionSummary> findPositionById(Long positionId);
}

// com.koduck.acl.StrategyQueryService
public interface StrategyQueryService {
    Optional<StrategySummary> findStrategyById(Long strategyId);
    List<StrategySummary> findStrategiesByUserId(Long userId);
}

// com.koduck.acl.BacktestQueryService
public interface BacktestQueryService {
    Optional<BacktestResultSummary> findResultById(Long resultId);
}

// com.koduck.acl.UserSettingsQueryService
public interface UserSettingsQueryService {
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}

// com.koduck.acl.UserMemoryProfileQueryService
public interface UserMemoryProfileQueryService {
    Optional<UserMemoryProfileDto> findByUserId(Long userId);
    void updateProfile(Long userId, UserMemoryProfileDto profile);
}
```

#### 架构调整

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

## Consequences

### 正向影响

1. **编译效率提升**: 修改 AI 代码无需编译整个 koduck-core
2. **独立演进**: AI 模块可独立版本发布
3. **独立部署**: 未来可将 AI 模块独立部署/扩容（计算密集型）
4. **团队并行**: AI 团队可独立开发
5. **技术栈独立**: AI 模块未来可独立升级技术栈

### 代价与影响

1. **防腐层维护成本**: 需要维护额外的接口和实现
2. **性能损耗**: 额外的转换层（本地方法调用，影响极小）
3. **实施工作量**: 需要分阶段实施，工作量较大

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 路径、请求/响应格式保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 部署兼容 | ✅ 无变化 | 最终产出仍为单个可执行 JAR（Phase 3.2 后）|

## Implementation Plan

### Phase 3.1: 引入防腐层（1-2 周）

1. 创建 `com.koduck.acl` 包
2. 定义防腐层接口（PortfolioQueryService, StrategyQueryService, BacktestQueryService, UserSettingsQueryService, UserMemoryProfileQueryService）
3. 在 koduck-core 中实现上述接口
4. 修改 AiAnalysisServiceImpl，使用防腐层接口替代直接 Repository 访问
5. 修改 MemoryServiceImpl，使用防腐层接口替代直接 Repository 访问
6. 验证编译通过，所有测试通过

### Phase 3.2: 迁移 koduck-ai（1 周）

1. 更新 koduck-ai/pom.xml，添加 koduck-core 依赖
2. 创建 koduck-ai 目录结构
3. 迁移 Controller: AiAnalysisController
4. 迁移 ServiceImpl: AiAnalysisServiceImpl, MemoryServiceImpl
5. 迁移 Entity: MemoryChatMessage, MemoryChatSession
6. 迁移 Repository: MemoryChatMessageRepository, MemoryChatSessionRepository
7. 迁移 DTO: 所有 AI DTO
8. 迁移 Support: AiConversationSupport, AiRecommendationSupport, AiStreamRelaySupport
9. 从 koduck-core 删除已迁移的代码
10. 验证编译通过

### Phase 3.3: 优化和清理（2-3 天）

1. 运行 quality-check.sh
2. 运行 checkstyle:check
3. 运行所有测试
4. 更新文档
5. 代码审查

## Alternatives Considered

### 1. 保持现状，不拆分 koduck-ai
- **拒绝**: AI 模块代码量较大，且有独立部署需求
- **当前方案**: 通过防腐层解耦后拆分

### 2. 微服务架构，通过 HTTP API 解耦
- **暂不采用**: 当前阶段过于复杂，会增加运维负担
- **未来演进**: 模块化完成后，可平滑演进为微服务架构

### 3. 事件驱动架构
- **暂不采用**: 引入消息队列会增加系统复杂度
- **未来演进**: 若需要完全独立部署，可考虑引入事件驱动

## Risks

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 防腐层接口设计不完善 | 中 | 中 | 充分评审，预留扩展点 |
| 性能损耗 | 低 | 低 | 本地方法调用，无网络开销 |
| 测试覆盖率下降 | 中 | 中 | 增加防腐层单元测试 |
| 回滚复杂 | 低 | 高 | 分阶段实施，每阶段可独立回滚 |

## Verification

- [ ] Phase 3.1 完成：防腐层接口定义和实现
- [ ] Phase 3.2 完成：koduck-ai 代码迁移
- [ ] Phase 3.3 完成：优化和清理
- [ ] mvn clean compile 编译通过
- [ ] ./scripts/quality-check.sh 全绿
- [ ] mvn checkstyle:check 无异常
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过

## References

- AI-MODULE-SPLIT-REASSESSMENT.md (详细评估报告)
- ADR-0095: 拆分 koduck-market 模块 (Phase 1)
- ADR-0096: 拆分 koduck-strategy 模块 (Phase 2)
- ADR-0097: 拆分 koduck-ai 模块 (Phase 3) - 暂缓版
- ADR-0093: 重新评估业务模块拆分策略
- ADR-0082: Maven 多模块重构
- DDD 领域驱动设计 - 防腐层模式
