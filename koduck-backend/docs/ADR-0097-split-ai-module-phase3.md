# ADR-0097: 拆分 koduck-ai 模块 (Phase 3) - 修订版

- Status: Accepted
- Date: 2026-04-04
- Issue: #491

## Context

根据 REALISTIC-MODULE-SPLIT-PLAN.md、ADR-0095 (Phase 1) 和 ADR-0096 (Phase 2)，koduck-market 和 koduck-strategy 模块已成功拆分。Phase 3 原计划拆分 AI 分析 (AI) 领域。

### 依赖分析

在尝试迁移 AI 相关代码时，发现了以下复杂的依赖关系：

1. **AiAnalysisServiceImpl 依赖：**
   - `BacktestResultRepository` (backtest 领域)
   - `PortfolioPositionRepository` (portfolio 领域)
   - `StrategyRepository` (strategy 领域)
   - `UserSettingsService` (user 领域)
   - 多个 DTO: `StockAnalysisRequest`, `StockAnalysisResponse`, `ChatStreamRequest`, etc.

2. **MemoryServiceImpl 依赖：**
   - `MemoryChatSessionRepository`, `MemoryChatMessageRepository` (ai 领域)
   - `UserMemoryProfileRepository` (user 领域)
   - `MemoryChatSession`, `MemoryChatMessage` (ai 领域实体)
   - `UserMemoryProfile` (user 领域实体)

3. **Support 类交叉依赖：**
   - `AiConversationSupport` → `MemoryService`, `TechnicalIndicatorService`
   - `AiRecommendationSupport` → `AiAnalysisService`
   - `AiStreamRelaySupport` → `AiAnalysisService`

### 与 Phase 1/2 的对比

| 模块 | 依赖复杂度 | 迁移可行性 |
|------|-----------|-----------|
| koduck-market | 低 | ✅ 高 - 被依赖方，不依赖其他业务域 |
| koduck-strategy | 低 | ✅ 高 - 相对独立，仅被 backtest 依赖 |
| koduck-ai | **高** | ⚠️ **低** - 依赖多个业务域的 Repository 和 Service |

## Decision

### 暂缓 koduck-ai 完整拆分

基于上述分析，**决定暂缓 koduck-ai 的完整拆分**。当前 koduck-ai 内部的业务域耦合度过高，强行拆分会导致：

1. 模块间循环依赖
2. 需要大量防腐层接口
3. 代码分散难以维护
4. 构建复杂度增加但收益有限

### 调整后的方案

保持 koduck-ai 模块声明（已有 POM），但**不迁移代码**。待以下条件满足后再进行拆分：

1. **依赖解耦**：AiAnalysisServiceImpl 不再直接依赖其他领域的 Repository
2. **防腐层就绪**：通过 Service 接口而非直接 Repository 访问其他领域数据
3. **DDD 重构**：引入明确的 bounded context 和防腐层

### 当前架构保持不变

```
koduck-backend/
├── koduck-bom              # BOM 管理
├── koduck-common           # 纯工具、常量
├── koduck-auth             # 认证授权（已拆分）
├── koduck-core             # 核心业务（保持现状）
│   ├── AI 业务代码
│   ├── Market 业务代码（部分已迁移到 koduck-market）
│   ├── Strategy 业务代码（部分已迁移到 koduck-strategy）
│   └── 共享基础设施
├── koduck-market           # 行情数据（Phase 1 完成）
│   └── Controller/Service 实现
├── koduck-strategy         # 策略管理（Phase 2 完成）
│   └── Controller/Service 实现
├── koduck-ai               # AI 分析（保留声明，暂缓拆分）
└── koduck-bootstrap        # 启动入口
```

## Consequences

### 正向影响

1. **避免过度工程**：不强行拆分高耦合代码，保持代码可维护性
2. **减少复杂度**：避免模块间循环依赖问题
3. **保持开发效率**：开发人员无需处理复杂的模块依赖关系
4. **保留未来可能性**：koduck-ai 模块声明保留，未来条件成熟时可继续拆分

### 代价与影响

1. **koduck-core 仍然包含 AI 代码**：编译时间未进一步改善
2. **变更影响面**：修改 AI 业务仍可能触发整个 koduck-core 重新编译
3. **团队并行**：多人同时修改 koduck-core 时冲突风险仍在

## Alternatives Considered

### 1. 继续尝试完整拆分 koduck-ai
- **拒绝**：依赖关系过于复杂，需要大量重构工作
- **当前方案**：暂缓拆分，待依赖解耦后再进行

### 2. 引入防腐层 (ACL) 解耦
- **暂不采用**：当前阶段过于复杂，会增加不必要的抽象层
- **未来演进**：若需要完全独立部署，可引入 ACL

### 3. 微服务架构，通过 HTTP API 解耦
- **暂不采用**：当前团队规模和运维能力更适合单体架构
- **未来演进**：模块化完成后，可平滑演进为微服务架构

## Implementation

本次 Phase 3 实际完成的工作：

1. ✅ 创建 Issue #491 记录决策过程
2. ✅ 创建 ADR-0097 文档说明决策和权衡
3. ✅ 分析 koduck-ai 依赖关系
4. ✅ 做出暂缓拆分的决策

## Future Work

### Phase 3 Retry（未来）
- 重构 AiAnalysisServiceImpl，通过 Service 接口访问其他领域数据
- 引入防腐层接口
- 重新评估 koduck-ai 拆分可行性

### Phase 4（未来）
- 拆分 koduck-portfolio（待 koduck-ai 问题解决后）
- 拆分 koduck-community（待 koduck-ai 问题解决后）

## Verification

- [x] Issue #491 创建完成
- [x] ADR-0097 文档创建完成
- [x] koduck-ai 依赖关系分析完成
- [x] 暂缓拆分决策记录完成

## References

- REALISTIC-MODULE-SPLIT-PLAN.md
- ADR-0095: 拆分 koduck-market 模块 (Phase 1)
- ADR-0096: 拆分 koduck-strategy 模块 (Phase 2)
- ADR-0093: 重新评估业务模块拆分策略
- ADR-0082: Maven 多模块重构
- Issue: #491
