# ADR-0108: Phase 2 - 迁移 Portfolio 和 Community 的 DTO 和 Entity

- Status: Accepted
- Date: 2026-04-05
- Issue: #515

## Context

根据 ADR-0107 的规划，Phase 2 的任务是迁移 Portfolio 和 Community 的 DTO 和 Entity 到对应模块。

### Phase 1 完成情况

Phase 1 已完成，建立了模块依赖关系：
- koduck-portfolio 和 koduck-community 已添加 koduck-core 依赖
- 模块目录结构已创建

### Phase 2 目标

将 koduck-core 中的以下 DTO 和 Entity 迁移到对应模块：

**Portfolio 模块：**
- DTO: PortfolioSummaryDto, AddTradeRequest, UpdatePositionRequest, TradeDto, AddPositionRequest, PortfolioPositionDto
- Entity: PortfolioPosition, WatchlistItem

**Community 模块：**
- DTO: SignalListResponse, CreateCommentRequest, UpdateSignalRequest, CommentResponse, SignalResponse, UserSignalStatsResponse, CreateSignalRequest, SignalSubscriptionResponse
- Entity: CommunitySignal, SignalComment, SignalFavorite, SignalLike, SignalSubscription, UserSignalStats

## Decision

### 迁移 DTO 和 Entity 到对应模块

**迁移策略：**

1. **创建目录结构**
   - 在 koduck-portfolio 创建 com.koduck.dto.portfolio 和 com.koduck.entity.portfolio 包
   - 在 koduck-community 创建 com.koduck.dto.community 和 com.koduck.entity.community 包

2. **移动文件**
   - 将 DTO 和 Entity 文件从 koduck-core 移动到对应模块
   - 保持包路径不变

3. **更新 koduck-core 依赖**
   - 在 koduck-core/pom.xml 中添加对 koduck-portfolio 和 koduck-community 的依赖
   - 修复 koduck-core 中引用迁移类的 import 语句

### 依赖关系调整

迁移后，模块依赖关系将变为：

```
koduck-portfolio → koduck-core
koduck-community → koduck-core
koduck-core → koduck-portfolio (新增)
koduck-core → koduck-community (新增)
```

注意：这会形成循环依赖，需要在 Phase 3/4 中进一步解决。

## Consequences

### 正向影响

1. **代码组织清晰**: DTO 和 Entity 归属于对应的业务模块
2. **模块化进展**: 向真正的模块化架构迈进一步
3. **减少 koduck-core 体积**: 移除 14 个 DTO/Entity 文件

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 类全名保持不变 |
| 功能兼容 | ✅ 无变化 | 仅文件位置调整 |
| 依赖关系 | ⚠️ 循环依赖 | koduck-core 与 portfolio/community 形成循环依赖，需后续解决 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 循环依赖 | 高 | 高 | 后续 Phase 需要解决，暂时通过 Maven 依赖管理 |
| 编译错误 | 中 | 中 | 仔细处理 import 语句和依赖关系 |

## Implementation

### 执行过程与问题

在尝试执行 Phase 2 时遇到了**循环依赖问题**：

```
koduck-portfolio → koduck-core (Phase 1 添加)
koduck-core → koduck-portfolio (Phase 2 尝试添加，导致循环)
```

**根本原因分析：**
1. koduck-portfolio 需要 koduck-core 中的基础设施（ApiResponse, AuthUserPrincipal 等）
2. koduck-core 中的代码（Controller, Service, Repository）需要 portfolio 的 DTO 和 Entity
3. 直接迁移会导致不可避免的循环依赖

### 解决方案调整

**短期方案（当前阶段）：**
- 保持 DTO 和 Entity 在 koduck-core 中
- portfolio 和 community 模块保持对 koduck-core 的依赖
- 在 koduck-portfolio/community 中创建 Facade/ACL 层来访问 koduck-core 的业务逻辑

**长期方案（后续阶段）：**
1. **提取共享基础设施**：将 ApiResponse, AuthUserPrincipal 等提取到 koduck-common
2. **反向依赖调整**：让 koduck-core 依赖 portfolio/community 的接口，而非实现
3. **使用事件驱动**：模块间通过领域事件通信，而非直接方法调用

### 变更清单

由于循环依赖问题，Phase 2 的实际变更为：

1. **保持现状**
   - DTO 和 Entity 继续保留在 koduck-core 中
   - 避免引入循环依赖

2. **文档更新**
   - 记录循环依赖问题
   - 更新 ADR-0107，调整后续阶段计划

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常

### 后续工作调整

| 原阶段 | 原计划 | 调整后 |
|--------|--------|--------|
| Phase 2 | 迁移 DTO 和 Entity | 提取共享基础设施到 common 模块 |
| Phase 3 | 迁移 Repository | 使用 ACL 模式隔离依赖 |
| Phase 4 | 迁移 Service 和 Controller | 通过事件驱动重构 |
| Phase 5 | 处理 koduck-core 依赖 | 逐步解耦，最终消除循环依赖 |

## References

- Issue: #515
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- Phase 1 Issue: #514
