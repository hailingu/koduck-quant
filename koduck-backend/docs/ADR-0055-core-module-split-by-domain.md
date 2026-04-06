# ADR-0055: 按业务域拆分 koduck-core 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #480

## Context

koduck-core 模块当前承载了所有业务逻辑，已成为一个"大泥球"（Big Ball of Mud）：

- 28 个 ServiceImpl 实现类
- 30 个 Repository 接口
- 20 个 Controller 类
- 32 个 Entity 实体
- 99 个 DTO 对象
- 总计 385+ 个 Java 文件

业务域涵盖：行情数据(market)、持仓交易(portfolio)、策略回测(strategy/backtest)、社区信号(community)、AI 分析(ai)等。

这带来以下问题：
1. **编译效率低**：任何小改动都需重新编译整个模块
2. **变更影响面大**：修改一个 Service 可能影响其他域
3. **无法按需扩展**：无法针对计算密集型域（如回测）独立扩容
4. **团队并行开发困难**：多人同时修改时冲突频繁
5. **测试边界模糊**：单元测试难以隔离特定业务域

## Decision

将 koduck-core 按业务域拆分为以下独立 Maven 模块：

| 模块名 | 业务域 | 主要职责 |
|--------|--------|----------|
| `koduck-market` | 行情数据 | K线、实时价格、资金流向、市场宽度、技术指标、股票基础信息 |
| `koduck-portfolio` | 持仓交易 | 持仓管理、交易记录、自选股、资产分析 |
| `koduck-strategy` | 策略回测 | 策略管理、策略版本、回测引擎、预警规则、预警历史 |
| `koduck-community` | 社区信号 | 信号发布、评论、点赞、收藏、订阅、用户信号统计 |
| `koduck-ai` | AI 分析 | AI 对话、记忆会话、股票分析、风险评估、策略推荐 |

### 模块依赖关系（调整后）

```
koduck-bootstrap (启动入口)
    ├── koduck-ai → koduck-core
    ├── koduck-market → koduck-core
    ├── koduck-portfolio → koduck-core
    ├── koduck-strategy → koduck-core
    ├── koduck-community → koduck-core
    └── koduck-core (核心业务)
        ├── koduck-auth
        └── koduck-common
            └── koduck-bom
```

### 调整说明

经过深入分析，发现 koduck-core 中的代码高度耦合：
- 工具类（CredentialEncryptionUtil, EntityCopyUtils）依赖 koduck-core 的实体和异常
- Service support 类依赖 koduck-core 的 Service 和 Repository
- 各业务域之间存在交叉引用

因此调整策略：
1. **新模块依赖 koduck-core**：新模块可以访问 koduck-core 的所有功能
2. **逐步迁移**：将特定业务代码从 koduck-core 逐步迁移到新模块
3. **koduck-core 瘦身**：最终 koduck-core 只保留跨域通用功能

### 拆分原则

1. **分层依赖**：新模块依赖 koduck-core，koduck-core 依赖 auth/common
2. **代码复用**：新模块复用 koduck-core 的工具类、实体、异常等
3. **逐步迁移**：按业务域逐步将代码从 koduck-core 迁移到新模块
4. **独立演进**：各模块可独立版本化、独立部署

## Consequences

### 正向影响

1. **编译效率提升**：修改单个业务域只需编译对应模块
2. **变更隔离**：业务域间解耦，降低回归测试范围
3. **团队并行**：不同团队可独立开发和发布各自模块
4. **按需扩展**：未来可将计算密集型模块（如 strategy）独立部署扩容
5. **代码可维护性**：模块内聚度提高，职责边界清晰

### 代价与影响

1. **构建复杂度增加**：多模块构建需要协调依赖关系
2. **模块间通信成本**：跨域调用需通过明确接口，不能随意引用
3. **数据库事务边界**：跨模块操作需考虑分布式事务或最终一致性
4. **迁移工作量**：需要仔细梳理代码依赖关系，分阶段迁移

### 兼容性影响

- **API 兼容性**：对外 REST API 保持不变，前端无感知
- **数据库兼容性**：表结构不变，仅按模块重新组织代码
- **配置兼容性**：application.yml 配置项按模块拆分，需更新配置结构

## Alternatives Considered

### 1. 保持现状，仅优化 koduck-core 内部结构
- **拒绝**：无法解决编译效率、变更影响面、独立扩展等核心问题

### 2. 直接拆分为微服务
- **暂不采用**：当前阶段团队规模和技术栈更适合模块化单体，微服务引入运维复杂度
- **未来演进**：模块化完成后，可平滑演进为微服务架构

### 3. 按技术层拆分（controller/service/repository 各为模块）
- **拒绝**：违背高内聚原则，会导致跨模块调用频繁，增加耦合

## Implementation Plan

### Phase 1: 基础设施
1. 创建新模块目录结构和 pom.xml
2. 配置模块间依赖关系
3. 更新 koduck-bom 版本管理

### Phase 2: 逐个迁移业务域
按业务域逐步迁移代码：
1. `koduck-ai` - 迁移 AI 相关 Service、Controller、DTO
2. `koduck-community` - 迁移社区信号相关代码
3. `koduck-portfolio` - 迁移持仓交易相关代码
4. `koduck-strategy` - 迁移策略回测相关代码
5. `koduck-market` - 迁移行情数据相关代码

**注意**：每个新模块需要依赖 koduck-core，复用其工具类和通用功能。

### Phase 3: 清理 koduck-core
1. 移除已迁移代码
2. 保留通用工具类和跨域服务
3. 验证所有测试通过

## Verification

- [ ] 所有新模块编译通过
- [ ] 质量检查脚本通过（checkstyle/pmd/spotbugs）
- [ ] 单元测试覆盖率不降低
- [ ] 集成测试全部通过
- [ ] API 契约测试验证模块间接口

## References

- 架构评估报告：`docs/ARCHITECTURE-EVALUATION.md` 缺陷 D-01
- 相关 Issue: #480
