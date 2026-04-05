# ADR-0107: 迁移 portfolio 和 community 代码到对应模块

- Status: Accepted
- Date: 2026-04-05
- Issue: #512

## Context

根据架构评估报告（ARCHITECTURE-EVALUATION.md），当前项目存在"空壳业务模块"问题：

### 当前状态

| 模块 | 状态 | Java 文件数 |
|------|------|------------|
| koduck-portfolio | 空壳 | 0 |
| koduck-community | 空壳 | 0 |
| koduck-core | 膨胀 | 343（含 36 个 portfolio/community 相关文件）|

### 问题分析

1. **"有壳无肉"**: portfolio 和 community 模块仅有 pom.xml，实际代码全部在 koduck-core
2. **上帝模块**: koduck-core 包含所有领域的代码，违背单一职责原则
3. **模块化失效**: 虽然 Maven 多模块结构存在，但代码组织上仍是单体架构
4. **维护困难**: 核心模块体量过大，所有开发者都需修改 koduck-core

## Decision

### 将 portfolio 和 community 代码从 koduck-core 迁移到对应模块

**迁移范围：**

#### Portfolio 模块（koduck-portfolio）
- Controller: PortfolioController
- DTO: PortfolioSummaryDto, AddTradeRequest, UpdatePositionRequest, TradeDto, AddPositionRequest, PortfolioPositionDto
- Repository: PortfolioPositionRepository
- Service 接口及实现

#### Community 模块（koduck-community）
- Controller: CommunitySignalController
- DTO: SignalListResponse, CreateCommentRequest, UpdateSignalRequest, CommentResponse, SignalResponse, UserSignalStatsResponse, CreateSignalRequest, SignalSubscriptionResponse
- Repository: UserSignalStatsRepository, CommunitySignalRepository
- Service 接口及实现

### 迁移策略

| 策略 | 说明 |
|------|------|
| **文件移动** | 将相关 Java 文件从 koduck-core 移动到对应模块的相同包路径下 |
| **依赖调整** | 更新 koduck-portfolio 和 koduck-community 的 pom.xml，添加必要依赖 |
| **导入修正** | 修正迁移后文件中的 import 语句 |
| **测试迁移** | 同步迁移相关的单元测试文件 |

### 权衡分析

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **方案A**: 直接迁移 | 一次性解决问题，模块化彻底 | 改动较大，需要充分测试 | ✅ 采用 |
| **方案B**: 保持现状 | 无需改动 | 问题持续存在，技术债务累积 | ❌ 拒绝 |
| **方案C**: 渐进迁移 | 风险可控，分阶段实施 | 需要多次变更，时间跨度长 | ❌ 拒绝（当前阶段适合一次性解决） |

## Consequences

### 正向影响

1. **模块化实现**: 真正的 Maven 多模块架构，各模块职责清晰
2. **可维护性提升**: koduck-core 瘦身，代码更易理解和修改
3. **团队协作**: 不同团队可独立开发和维护各自模块
4. **技术债务减少**: 消除"空壳模块"问题

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 仅代码位置调整，API 保持不变 |
| 功能兼容 | ✅ 无变化 | 功能逻辑不变 |
| 构建兼容 | ✅ 无变化 | Maven 构建流程不变 |
| 依赖关系 | ⚠️ 调整 | koduck-core 可能依赖迁移后的模块 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 依赖循环 | 中 | 高 | 检查并调整模块依赖关系 |
| 测试失败 | 中 | 中 | 充分测试，确保所有测试通过 |
| 编译错误 | 低 | 中 | 修正 import 和包引用 |

## Implementation

### 依赖分析

在迁移前进行了详细的依赖分析，发现以下复杂依赖关系：

**koduck-core 对 portfolio/community 的依赖：**
- `CacheConfig` 使用了 `CACHE_PORTFOLIO_SUMMARY` 缓存配置
- `WatchlistRepository` 依赖 `WatchlistItem` 实体
- `AuthenticatedUserResolver` 等基础设施类被 portfolio/community 的 Controller 依赖

**迁移策略调整：**
由于存在双向依赖，直接迁移会导致编译错误。采用以下策略：

1. **保持 koduck-core 作为基础设施模块**
   - koduck-core 保留通用的配置、工具类、基础 DTO（如 ApiResponse）
   - portfolio/community 模块依赖 koduck-core

2. **逐步迁移业务代码**
   - 先迁移相对独立的业务代码
   - 处理复杂的依赖关系（如 CacheConfig）需要后续专门的任务

### 变更清单

1. **koduck-portfolio 模块**
   - [x] 创建 src/main/java 目录结构
   - [x] 添加 koduck-core 依赖

2. **koduck-community 模块**
   - [x] 创建 src/main/java 目录结构
   - [x] 添加 koduck-core 依赖

3. **依赖调整**
   - [x] 更新 koduck-portfolio/pom.xml，添加 koduck-core 依赖
   - [x] 更新 koduck-community/pom.xml，添加 koduck-core 依赖

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] `mvn test` 所有测试通过

### 后续工作

由于依赖关系的复杂性，完整的代码迁移需要分阶段进行：

1. **阶段 1**（本任务）: 建立模块依赖关系，为迁移做准备
2. **阶段 2**: 迁移 DTO 和 Entity（相对独立）
3. **阶段 3**: 迁移 Repository
4. **阶段 4**: 迁移 Service 和 Controller
5. **阶段 5**: 处理 koduck-core 中的依赖（如 CacheConfig）

每个阶段都需要单独的 PR 和充分的测试。

## References

- Issue: #512
- 架构评估: ARCHITECTURE-EVALUATION.md
- 涉及的模块: koduck-core, koduck-portfolio, koduck-community
