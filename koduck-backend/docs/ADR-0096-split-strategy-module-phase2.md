# ADR-0096: 拆分 koduck-strategy 模块 (Phase 2)

- Status: Accepted
- Date: 2026-04-04
- Issue: #489

## Context

根据 REALISTIC-MODULE-SPLIT-PLAN.md 和 ADR-0095 (Phase 1)，koduck-market 模块已成功拆分。Phase 2 的目标是拆分策略管理 (Strategy) 领域。

Strategy 领域的特点：
1. **相对独立**: Strategy 领域主要被 Backtest 依赖，但依赖关系简单
2. **边界清晰**: Strategy、StrategyVersion、StrategyParameter、AlertRule、AlertHistory 等实体关系明确
3. **代码规模适中**: 相比 Market 领域，Strategy 代码量较小，适合作为第二个拆分目标

### 依赖分析

Strategy 领域的依赖关系：
- **BacktestServiceImpl** → `StrategyRepository`, `StrategyVersionRepository` (通过 StrategyAccessSupport)
- **AiAnalysisServiceImpl** → `StrategyRepository` (查询策略信息)
- **CommunitySignalServiceImpl** → `Strategy` (关联信号与策略)

这些依赖表明，Strategy 的 Entity 和 Repository 被 koduck-core 中的其他领域共享，类似于 Phase 1 的情况。

## Decision

### 拆分 koduck-strategy 模块

采用与 Phase 1 相同的策略：**渐进式拆分**，只迁移 Controller 和 Service 实现到 koduck-strategy，保留 Entity、Repository、DTO 在 koduck-core 作为共享基础设施。

### 模块内容

```
koduck-strategy/
├── controller/
│   └── StrategyController
├── service/
│   ├── StrategyServiceImpl
│   └── AlertRuleService (如存在)
└── provider/ (如存在)
```

### 保留在 koduck-core 的共享组件

```
koduck-core/
├── entity/strategy/
│   ├── Strategy
│   ├── StrategyVersion
│   ├── StrategyParameter
│   ├── AlertRule
│   └── AlertHistory
├── repository/strategy/
│   ├── StrategyRepository
│   ├── StrategyVersionRepository
│   ├── StrategyParameterRepository
│   ├── AlertRuleRepository
│   └── AlertHistoryRepository
├── dto/strategy/
│   ├── StrategyDto
│   ├── StrategyParameterDto
│   ├── StrategyVersionDto
│   └── ... (所有 strategy DTO)
├── mapper/
│   └── StrategyMapper
└── service/support/
    └── StrategyAccessSupport
```

### 依赖关系

```
koduck-bootstrap
    ├── koduck-market → koduck-core
    ├── koduck-strategy → koduck-core
    └── koduck-core (包含所有共享基础设施)
        ├── koduck-auth
        └── koduck-common
```

## Consequences

### 正向影响

1. **编译效率提升**: 修改 Strategy Controller/Service 实现无需重新编译整个 koduck-core
2. **职责分离**: Strategy 业务逻辑与基础设施分离
3. **团队并行**: 不同团队可独立开发 koduck-strategy 的 Controller 和 Service
4. **为未来完全拆分奠定基础**: 当其他领域不再直接依赖 Strategy Entity 时，可进一步拆分

### 代价与影响

1. **Entity/Repository 仍在 koduck-core**: 未达到完全模块隔离
2. **双向感知**: koduck-strategy 依赖 koduck-core 的基础设施
3. **部分代码仍在 koduck-core**: 需要后续 Phase 继续迁移

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | HTTP API 路径、请求/响应格式保持不变 |
| 数据库兼容 | ✅ 无变化 | 表结构不变 |
| 配置兼容 | ✅ 无变化 | application.yml 配置项保持不变 |
| 部署兼容 | ✅ 无变化 | 最终产出仍为单个可执行 JAR |

## Alternatives Considered

### 1. 完全拆分（包括 Entity/Repository/DTO）
- **拒绝**: 需要修改大量 koduck-core 中的代码（BacktestServiceImpl、AiAnalysisServiceImpl 等）
- **当前方案**: 先拆分 Controller/Service，保留共享基础设施

### 2. 保持现状，不拆分
- **拒绝**: 无法继续推进 koduck-core 模块化工作
- **当前方案**: 通过渐进式拆分降低风险

### 3. 引入防腐层 (ACL) 解耦
- **暂不采用**: 当前阶段过于复杂，会增加不必要的抽象层
- **未来演进**: 若需要完全独立部署，可引入 ACL

## Implementation

### Phase 1: 创建 koduck-strategy 模块
1. 更新 koduck-strategy/pom.xml，添加 koduck-core 依赖
2. 创建目录结构

### Phase 2: 迁移 Controller
1. 迁移 StrategyController
2. 保持 package 结构不变

### Phase 3: 迁移 Service 实现
1. 迁移 StrategyServiceImpl
2. 保持 Service 接口在 koduck-core

### Phase 4: 验证
1. mvn clean compile 编译通过
2. ./scripts/quality-check.sh 全绿
3. mvn checkstyle:check 无异常

## Future Work

### Phase 3（未来）
- 将 Strategy Entity/Repository/DTO 迁移到 koduck-strategy
- 在 koduck-core 中引入防腐层接口
- 其他领域通过防腐层访问 Strategy 数据

### Phase 4（未来）
- koduck-strategy 可独立部署
- 通过 HTTP API 或消息队列与其他模块通信

## Verification

- [ ] koduck-strategy 模块创建完成
- [ ] Controller 迁移完成
- [ ] Service 实现迁移完成
- [ ] mvn clean compile 编译通过
- [ ] ./scripts/quality-check.sh 全绿
- [ ] mvn checkstyle:check 无异常
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过

## References

- REALISTIC-MODULE-SPLIT-PLAN.md
- ADR-0095: 拆分 koduck-market 模块 (Phase 1)
- ADR-0082: Maven 多模块重构
- ADR-0093: 重新评估业务模块拆分策略
- Issue: #489
