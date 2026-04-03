# ADR-0053: Entity 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #398

## Context

根据 `docs/entity-redundancy-analysis.md` 分析报告，koduck-backend 的 Entity 层存在多处冗余问题：

- 10 个实体手写 Builder 模式（约 2,100 行样板代码）
- Trade 与 BacktestTrade 字段高度重叠（8 个共享字段）
- 12 个内部枚举分散在各 Entity 中
- 信号交互实体（Like/Favorite/Subscription）结构同构
- Market 指标三实体共享元数据骨架

## Decision

### 决策 1: 提取 BaseTrade @MappedSuperclass

**理由**: Trade 和 BacktestTrade 共享核心交易数据字段，提取基类可消除重复并明确继承关系。

**实施方案**:
- 创建 `BaseTrade` @MappedSuperclass，包含共享字段
- Trade 和 BacktestTrade 继承 BaseTrade

### 决策 2: 提取内部枚举到 enums/ 包

**理由**: 内部枚举不便于跨模块引用，集中管理提高可维护性。

**提取清单**:
- UserStatus, BacktestStatus, TradeStatus, StrategyStatus
- ParameterType, SignalType, SignalStatus, SignalResultStatus
- CredentialType, CredentialEnvironment, VerificationStatus
- AuditActionType

### 决策 3: 手写 Builder 替换为 Lombok @Builder

**理由**: 手写 Builder 导致约 2,100 行样板代码，Lombok 可自动生成。

**实施方案**:
- 使用 `@Builder` + `@Data` 替代手写 Builder
- 防御性拷贝逻辑移至 Service/DTO 层或 AttributeConverter

### 决策 4: 信号交互/Market 指标实体提取共享基类

**理由**: 结构同构的实体提取基类可减少字段重复。

**实施方案**:
- 信号交互实体提取 `SignalInteractionBase`
- Market 指标实体提取 `MarketDailyIndicatorBase`

## Consequences

### 正向影响

- 消除约 2,250 行冗余代码
- 统一实体设计模式
- 提高可维护性和可读性
- 枚举集中管理便于跨模块引用

### 消极影响

- 需要修改大量文件（20+ 个）
- 需要更新 Repository/Service 层的枚举引用
- 有一定的回归测试工作量

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 数据库 Schema | 无 | @MappedSuperclass 不改变表结构 |
| API 接口 | 无 | DTO 不变，仅实体层调整 |
| 业务逻辑 | 低 | 枚举引用需要更新 import |
| 测试 | 中 | 需要验证实体映射正确 |

## 实施顺序

1. Phase 1: 提取 BaseTrade @MappedSuperclass
2. Phase 2: 提取内部枚举到 enums/ 包
3. Phase 3: 手写 Builder 替换为 Lombok @Builder
4. Phase 4: 信号交互/Market 指标实体提取共享基类

## Related

- Issue #398
- `docs/entity-redundancy-analysis.md`
