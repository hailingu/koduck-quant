# ADR-0136: Phase 3.4 - koduck-core 代码分析与清理

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

Phase 3.3 已经完成了 Market 相关代码的迁移，koduck-core 代码行数从 ~28,589 行减少到 ~18,496 行。现在需要继续分析和迁移剩余代码。

## 当前 koduck-core 代码分布

### 按类型统计

| 类型 | 代码行数 | 占比 |
|------|---------|------|
| dto | 3,906 | 21% |
| entity | 2,216 | 12% |
| service | 5,671 | 31% |
| controller | 2,674 | 14% |
| repository | 1,322 | 7% |
| 其他 | 2,707 | 15% |
| **总计** | **18,496** | **100%** |

### 按领域统计

#### DTO (3,906 行)

| 领域 | 代码行数 | 说明 |
|------|---------|------|
| settings | 404 | 用户设置相关 |
| credential | 414 | 凭证管理相关 |
| websocket | 308 | WebSocket 消息 |
| indicator | 267 | 技术指标相关 |
| user | 522 | 用户信息相关 |
| backtest | 819 | 回测相关 |
| profile | 276 | 用户资料相关 |
| monitoring | 29 | 监控相关 |
| watchlist | 259 | 自选股相关 |
| strategy | 608 | 策略相关 |

#### Entity (2,216 行)

| 领域 | 代码行数 | 说明 |
|------|---------|------|
| credential | 126 | 凭证实体 |
| enums | 37 | 枚举定义 |
| user | 1,040 | 用户实体 |
| backtest | 464 | 回测实体 |
| strategy | 549 | 策略实体 |

#### Service (5,671 行)

| 类型 | 代码行数 | 说明 |
|------|---------|------|
| impl | 2,891 | Service 实现 |
| support | 1,630 | 支持类 |

## 与其他模块的对比

### koduck-auth 模块

koduck-auth 已包含：
- DTO: LoginRequest, RegisterRequest, TokenResponse 等
- Entity: User, Role, RefreshToken 等
- Repository: UserRepository, RoleRepository 等

koduck-core 中仍有：
- DTO: CreateUserRequest, UpdateUserRequest, UserDetailResponse 等
- Entity: UserSettings, UserMemoryProfile 等
- Service: AuthServiceImpl, UserServiceImpl 等

### koduck-strategy 模块

koduck-strategy 已包含：
- DTO: StrategyDto, BacktestRequestDto 等
- API: StrategyQueryService, BacktestCommandService 等

koduck-core 中仍有：
- DTO: BacktestResultDto, BacktestTradeDto 等
- Entity: BacktestResult, BacktestTrade, Strategy 等
- Service: BacktestServiceImpl, StrategyServiceImpl 等

## 决策

### 1. 保留在 koduck-core 的代码

以下代码暂时保留在 koduck-core：
- Controller 层（后续迁移到 gateway）
- 跨领域协调服务
- 全局配置

### 2. 需要进一步分析的代码

以下代码需要进一步分析是否可以迁移：
- backtest 相关代码（可能迁移到 koduck-strategy）
- credential 相关代码（可能迁移到 koduck-auth）
- user/settings/profile 相关代码（可能迁移到 koduck-auth）

### 3. 暂不迁移的代码

以下代码暂不迁移：
- websocket 相关（需要与前端协调）
- indicator 相关（需要确定归属模块）
- monitoring 相关（需要确定归属模块）
- watchlist 相关（可能迁移到 koduck-portfolio）

## 下一步行动

1. 分析 backtest 代码与 koduck-strategy 的关系
2. 分析 credential 代码与 koduck-auth 的关系
3. 分析 user/settings 代码与 koduck-auth 的关系
4. 制定详细的迁移计划

## 目标

- **当前 koduck-core 代码行数**: ~18,496 行
- **Phase 3.4 目标**: 完成分析并迁移可识别的重复代码
- **最终目标**: koduck-core 代码行数 < 15,000 行

## 相关文档

- [ADR-0132-core-slimming.md](./ADR-0132-core-slimming.md)
- [ADR-0134-core-slimming-implementation.md](./ADR-0134-core-slimming-implementation.md)
- [ADR-0135-entity-repository-migration.md](./ADR-0135-entity-repository-migration.md)
- Issue #596

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本，完成代码分析 |
