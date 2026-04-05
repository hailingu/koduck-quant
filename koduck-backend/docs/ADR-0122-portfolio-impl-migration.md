# ADR-0122: Portfolio 领域实现模块迁移

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #562

## 背景

在 Phase 2.1 中，我们成功创建了 koduck-market-impl 模块并迁移了 Market 领域的实现。现在需要继续 Phase 2.2，创建 koduck-portfolio-impl 模块并迁移 Portfolio 领域的实现代码。

当前 Portfolio 相关代码分布在 koduck-core 和 koduck-portfolio 中：
- koduck-core: PortfolioServiceImpl, PositionServiceImpl, Repository, Entity
- koduck-portfolio: 目前是 jar 模块，包含实体和仓库

这种混合结构导致了：
1. 代码耦合度高
2. 循环依赖风险
3. 测试困难
4. 不符合领域驱动设计的分层架构

## 决策

创建 koduck-portfolio-impl 模块，将 Portfolio 领域的实现代码从 koduck-core 迁移出来。

### 模块结构

```
koduck-portfolio/
├── koduck-portfolio-api/         # 已存在 - API 模块
│   ├── PortfolioQueryService     # 查询接口
│   ├── PortfolioCommandService   # 命令接口
│   └── DTOs
│
└── koduck-portfolio-impl/        # 新建 - 实现模块
    ├── service/
    │   ├── PortfolioServiceImpl  # 实现 PortfolioCommandService
    │   └── PositionServiceImpl   # 持仓服务实现
    ├── repository/               # Repository 实现
    ├── entity/                   # JPA 实体
    └── acl/
        └── PortfolioQueryServiceImpl  # ACL 实现
```

### 迁移内容

1. **Service 实现**
   - PortfolioServiceImpl（从 koduck-core 迁移，需拆分）
   - PositionServiceImpl（从 koduck-core 迁移）

2. **数据访问层**
   - PortfolioRepository
   - PositionRepository
   - WatchlistRepository
   - TradeRepository

3. **实体类**
   - Portfolio
   - PortfolioPosition
   - WatchlistItem
   - Trade

4. **ACL 实现**
   - PortfolioQueryServiceImpl（实现 api 模块的 ACL 接口）

## 权衡

### 替代方案

1. **保持现状**: 继续将实现放在 koduck-core
   - ❌ 不符合架构改进目标
   - ❌ koduck-core 过于臃肿
   - ❌ 无法独立部署和测试

2. **直接迁移到 koduck-portfolio**: 不创建单独的 impl 模块
   - ❌ 无法区分接口和实现
   - ❌ 违反依赖倒置原则
   - ❌ 其他模块无法只依赖接口

### 选择当前方案的理由

1. **清晰的依赖关系**: api 模块不依赖任何其他业务模块
2. **可替换性**: 可以在不影响调用方的情况下替换实现
3. **测试友好**: 可以独立测试每个模块
4. **符合 DDD**: 领域层与技术实现分离

## 影响

### 兼容性影响

- **koduck-core**: 需要移除 Portfolio 相关代码，改为依赖 koduck-portfolio-api
- **koduck-ai**: 后续需要通过 ACL 接口访问 Portfolio 数据（Phase 2.5）
- **koduck-bootstrap**: 需要添加 koduck-portfolio-impl 依赖

### 构建影响

- 新增 koduck-portfolio-impl 模块
- 更新父 POM dependencyManagement
- 调整 koduck-portfolio 为 pom packaging（聚合模块）

### 运行时影响

- 无影响，功能保持不变
- Spring Boot 自动扫描会加载 impl 模块中的 @Service 组件

## 实施计划

1. 创建 koduck-portfolio-impl 模块结构
2. 迁移 Entity 和 Repository
3. 迁移 Service 实现（适当拆分）
4. 实现 ACL 接口
5. 编写单元测试
6. 更新 koduck-bootstrap 依赖
7. 运行 ArchUnit 测试验证

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-PLAYBOOK.md](./ARCHITECTURE-PLAYBOOK.md)
- ADR-0121: Market 领域实现模块迁移
