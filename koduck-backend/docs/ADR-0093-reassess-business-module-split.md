# ADR-0093: 重新评估业务模块拆分策略

- Status: Accepted
- Date: 2026-04-04
- Issue: #480

## Context

根据 ADR-0086 和后续 ADR（0089-0092），koduck-auth 模块已成功从 koduck-core 中拆分出来。这验证了模块拆分的可行性：
- koduck-auth 作为基础模块，无外部业务依赖
- koduck-core 依赖 koduck-auth，通过 Maven 依赖使用其功能

然而，在尝试拆分其他业务模块（AI、Market、Portfolio 等）时遇到了困难：
- Issue #482: 尝试迁移 AI 模块失败
- Issue #483: 尝试迁移工具类失败  
- Issue #484: 再次尝试迁移 AI 模块失败

## Problem Analysis

### 失败原因分析

1. **深度耦合的 Support 类**
   - `AiConversationSupport` (koduck-core) → `MemoryService`
   - `AiRecommendationSupport` (koduck-core) → `AiAnalysisService`
   - `AiStreamRelaySupport` (koduck-core) → `AiAnalysisService`

2. **工具类依赖实体**
   - `EntityCopyUtils` → `User`, `CommunitySignal`, `SignalComment`
   - `CredentialEncryptionUtil` → `CredentialEncryptionException`

3. **Service 间交叉依赖**
   - `PortfolioService` → `KlineService` (market)
   - `BacktestService` → `KlineService`, `StrategyService`
   - `CommunitySignalService` → `UserService`

### 与 koduck-auth 成功的对比

| 因素 | koduck-auth | 其他业务模块 |
|------|-------------|-------------|
| 依赖方向 | 无外部业务依赖 | 依赖其他业务域 |
| Support 类 | 无复杂 support 类 | 有交叉引用的 support 类 |
| 工具类 | JwtUtil 独立 | EntityCopyUtils 依赖实体 |
| 基础设施 | 纯认证逻辑 | 依赖 Email、RateLimiter 等 |

## Decision

### 结论

**暂停进一步拆分 koduck-core 中的业务模块**（AI、Market、Portfolio、Strategy、Community）。

当前 koduck-core 内部的业务域耦合度过高，强行拆分会导致：
1. 模块间循环依赖
2. 代码分散难以维护
3. 构建复杂度增加但收益有限

### 调整后的架构

保持当前的模块化结构：

```
koduck-backend/
├── koduck-bom              # BOM 管理
├── koduck-common           # 纯工具、常量（无 Spring 依赖）
├── koduck-auth             # 认证授权（已拆分成功）
│   ├── Entity/Repository
│   ├── Service 接口
│   └── JwtUtil/JwtConfig
├── koduck-core             # 核心业务（保持现状）
│   ├── AI 业务
│   ├── Market 业务
│   ├── Portfolio 业务
│   ├── Strategy 业务
│   ├── Community 业务
│   └── 共享工具类
└── koduck-bootstrap        # 启动入口
```

### 替代优化方案

不再追求物理模块拆分，改为以下优化措施：

1. **包结构强化**
   - 按业务域组织包（已实施）：`controller/ai/`, `service/impl/ai/`
   - 添加 ArchUnit 测试，禁止跨域依赖

2. **接口契约化**
   - Service 接口与实现分离（已实施）
   - 跨域调用通过接口，不直接引用实现类

3. **代码审查加强**
   - PR 审查关注跨域耦合
   - 新增跨域依赖需要技术负责人审批

4. **未来演进方向**
   - 若某业务域需要独立部署，考虑微服务拆分
   - 届时通过 API 调用而非直接方法调用解耦

## Consequences

### 正向影响

1. **避免过度工程**：不强行拆分高耦合代码，保持代码可维护性
2. **减少复杂度**：避免模块间循环依赖问题
3. **保持开发效率**：开发人员无需处理复杂的模块依赖关系

### 代价与影响

1. **koduck-core 仍然较大**：385+ 个 Java 文件，编译时间未改善
2. **变更影响面**：修改一个业务域仍可能触发整个模块重新编译
3. **团队并行**：多人同时修改 koduck-core 时冲突风险仍在

## Alternatives Considered

### 1. 继续尝试拆分，将 support 类一并迁移
- **拒绝**：support 类被多个业务域共享，迁移会导致更多问题

### 2. 创建 koduck-support 模块存放共享 support 类
- **拒绝**：增加模块复杂度，support 类与业务逻辑紧密相关

### 3. 微服务架构，通过 HTTP API 解耦
- **暂不采用**：当前团队规模和运维能力更适合单体架构

## Implementation

1. ✅ 保留 koduck-auth 拆分成果
2. ✅ 保持 koduck-core 现状，不再拆分其他业务模块
3. ⏳ 添加 ArchUnit 测试，强制包依赖规则
4. ⏳ 更新开发文档，说明模块边界

## References

- 相关 ADR: ADR-0086, ADR-0089, ADR-0090, ADR-0091, ADR-0092
- 相关 Issue: #480, #482, #483, #484
- 架构评估: ARCHITECTURE-EVALUATION.md
