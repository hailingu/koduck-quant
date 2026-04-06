# ADR-0149: 拆分 koduck-core 上帝模块，迁移业务逻辑到对应领域模块

- Status: Accepted
- Date: 2026-04-06
- Issue: #627

## Context

根据 ARCHITECTURE-EVALUATION.md 报告（缺陷 D-01），koduck-core 当前是"上帝模块"（God Module），包含 146 个 Java 文件，涵盖 8+ 个不同业务领域，严重违反单一职责原则。

### koduck-core 当前结构

```
koduck-core/src/main/java/com/koduck/
├── controller/
│   ├── backtest/BacktestController.java          ← 应迁移到 strategy
│   ├── credential/CredentialController.java      ← 应迁移到 auth
│   ├── watchlist/WatchlistController.java        ← 应迁移到 portfolio
│   ├── user/UserController.java                  ← 应迁移到 auth
│   ├── auth/                                     ← 应迁移到 auth
│   ├── HealthController.java                     ← 保留（系统级）
│   ├── MonitoringController.java                 ← 保留（系统级）
│   ├── SettingsController.java                   ← 评估后决定
│   └── WebSocketEventController.java             ← 评估后决定
├── service/
│   ├── BacktestService.java                      ← 应迁移到 strategy
│   ├── StrategyService.java                      ← 应迁移到 strategy
│   ├── CredentialService.java                    ← 应迁移到 auth
│   ├── WatchlistService.java                     ← 应迁移到 portfolio
│   ├── UserService.java                          ← 应迁移到 auth
│   ├── AuthService.java                          ← 应迁移到 auth
│   ├── Market*Service.java (多个)                ← 应迁移到 market
│   └── impl/                                     ← 对应实现类
├── entity/
│   ├── backtest/                                 ← 应迁移到 strategy
│   ├── strategy/                                 ← 应迁移到 strategy
│   ├── credential/                               ← 应迁移到 auth
│   └── user/                                     ← 应迁移到 auth
├── repository/
│   ├── backtest/                                 ← 应迁移到 strategy
│   ├── strategy/                                 ← 应迁移到 strategy
│   ├── credential/                               ← 应迁移到 auth
│   ├── user/                                     ← 应迁移到 auth
│   └── market/                                   ← 应迁移到 market
└── ...
```

### 问题分析

1. **违反单一职责原则**：一个模块管理 8+ 个不同业务领域
2. **与领域模块重复**：策略/回测代码同时存在于 core 和 strategy-impl
3. **依赖混乱**：core 依赖所有 *-api 模块，形成隐式双向依赖
4. **维护成本高**：新人理解成本高，修改影响范围大
5. **模块化评分低**：当前模块化评分 72 分 (B-)

## Decision

### 决策方案

**分阶段将 koduck-core 中的业务逻辑迁移到对应的领域模块，core 仅保留跨域协调逻辑和系统级组件。**

### 迁移策略

#### 第一阶段：高优先级迁移（回测/策略/凭证/自选股）

| 源位置 | 目标位置 | 文件/包 |
|--------|----------|---------|
| `controller/backtest/BacktestController.java` | `koduck-bootstrap` | Controller 作为 HTTP 入口 |
| `service/BacktestService.java` | `koduck-strategy-api` | 接口定义 |
| `service/impl/backtest/BacktestServiceImpl.java` | `koduck-strategy-impl` | 实现类 |
| `entity/backtest/*` | `koduck-strategy-impl` | 实体类 |
| `repository/backtest/*` | `koduck-strategy-impl` | 仓库接口 |
| `service/StrategyService.java` | `koduck-strategy-api` | 接口定义 |
| `entity/strategy/*` | `koduck-strategy-impl` | 实体类 |
| `repository/strategy/*` | `koduck-strategy-impl` | 仓库接口 |
| `controller/credential/CredentialController.java` | `koduck-bootstrap` | Controller |
| `service/CredentialService.java` | `koduck-auth` | 接口和实现 |
| `entity/credential/*` | `koduck-auth` | 实体类 |
| `repository/credential/*` | `koduck-auth` | 仓库接口 |
| `controller/watchlist/WatchlistController.java` | `koduck-bootstrap` | Controller |
| `service/WatchlistService.java` | `koduck-portfolio-api` | 接口定义 |
| `service/impl/watchlist/*` | `koduck-portfolio-impl` | 实现类 |

#### 第二阶段：中优先级迁移（用户/认证/市场数据）

| 源位置 | 目标位置 | 说明 |
|--------|----------|------|
| `controller/user/UserController.java` | `koduck-bootstrap` | 用户相关 API |
| `service/UserService.java` | `koduck-auth` | 用户服务 |
| `entity/user/*` | `koduck-auth` | 用户实体 |
| `repository/user/*` | `koduck-auth` | 用户仓库 |
| `controller/auth/*` | `koduck-bootstrap` | 认证相关 API |
| `service/AuthService.java` | `koduck-auth` | 认证服务 |
| `service/impl/auth/*` | `koduck-auth` | 认证实现 |
| `service/Market*Service.java` | `koduck-market-api/impl` | 市场数据服务 |
| `repository/market/*` | `koduck-market-impl` | 市场数据仓库 |

#### 第三阶段：core 精简后保留内容

迁移完成后，koduck-core 仅保留：

1. **系统级 Controller**：
   - `HealthController.java` - 健康检查
   - `MonitoringController.java` - 监控接口

2. **跨域协调逻辑**（如有）：
   - 需要访问多个领域的聚合服务

3. **待评估内容**：
   - `SettingsController.java` - 可能迁移到 bootstrap
   - `WebSocketEventController.java` - 可能迁移到 infrastructure
   - `PricePushService.java` - 可能迁移到 market
   - `RateLimiterService.java` - 可能迁移到 infrastructure

### 依赖调整

迁移过程中需要调整以下依赖关系：

1. **koduck-bootstrap** 需要依赖：
   - koduck-strategy-api（BacktestService 接口）
   - koduck-portfolio-api（WatchlistService 接口）
   - koduck-auth（CredentialService, UserService 等）

2. **koduck-core** 精简后依赖：
   - 可能仅保留 koduck-common 和 koduck-infrastructure

## Consequences

### Positive

1. **消除上帝模块**：每个模块职责单一，符合单一职责原则
2. **明确依赖关系**：消除隐式双向依赖，依赖关系清晰
3. **降低维护成本**：修改影响范围可控，新人理解成本降低
4. **提升模块化评分**：预计模块化评分从 72 分提升到 80+ 分
5. **为微服务拆分奠基**：清晰的模块边界为后续微服务化做准备

### Negative

1. **迁移复杂度高**：涉及 146 个文件的移动和依赖调整
2. **需要仔细处理循环依赖**：确保迁移过程中不引入新的循环依赖
3. **测试需要同步调整**：大量测试文件需要更新包引用
4. **短期内可能影响开发**：迁移期间需要冻结相关代码

### Compatibility

- **API 兼容性**：Controller 迁移后 URL 保持不变，对外 API 无变化
- **数据库兼容性**：Entity 迁移不改变表结构，数据无影响
- **服务接口兼容性**：Service 接口迁移后保持相同方法签名

## Implementation Plan

### 执行顺序

按依赖关系从底层到上层迁移：

1. **Entity + Repository**（最底层，无业务逻辑依赖）
2. **Service Impl**（依赖 Entity/Repository）
3. **Service Interface**（定义接口）
4. **Controller**（最上层，依赖 Service）

### 验证步骤

每个领域迁移后执行：
1. `mvn clean compile` 编译通过
2. `mvn test` 相关测试通过
3. `mvn checkstyle:check` 无异常
4. `./scripts/quality-check.sh` 通过

### 回滚策略

- 每个领域迁移作为一个独立的 commit
- 发现问题可单独回滚该领域的迁移

## Notes

- 本 ADR 与 ADR-0148（双重源码清理）是互补的
- ADR-0148 清理了领域模块顶层的遗留 src，本任务清理 koduck-core 中的对应代码
- 建议分多个 PR 完成，每个领域一个 PR，降低风险
- 迁移过程中注意保持 Git 历史（使用 git mv）
