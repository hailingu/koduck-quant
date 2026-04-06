# ADR-0148: 清理领域模块双重源码，完成领域迁移最后一公里

- Status: Accepted
- Date: 2026-04-06
- Issue: #625

## Context

根据 ARCHITECTURE-EVALUATION.md 报告（缺陷 D-02），koduck-backend 中 market/portfolio/strategy/community/ai 五个领域模块存在**双重源码**问题：

### 问题现状

| 模块 | 顶层 src/ 遗留内容 | 子模块状态 |
|------|-------------------|-----------|
| koduck-market | Controller (6个)、Provider、Util、Config | api + impl 已建立 |
| koduck-portfolio | Controller、ServiceImpl、DTO、Entity、Repository | api + impl 已建立 |
| koduck-strategy | Controller、ServiceImpl | api + impl 已建立 |
| koduck-community | Controller、DTO、Entity、Repository、Util | api + impl 已建立 |
| koduck-ai | Controller、Service、ServiceImpl、DTO、Entity、Repository、Config | api + impl 已建立 |

### 导致的问题

1. **代码重复**：同一类在顶层和子模块同时存在（如 `MarketFieldParser`、`DataConverter`）
2. **依赖混乱**：不确定应该依赖顶层还是子模块
3. **维护成本增加**：开发者需要理解两套并存的代码结构
4. **架构清晰度下降**：影响模块化评分（当前 72 分 B-）

### 历史背景

从 ADR-0095 至 ADR-0127，项目已进行多轮领域迁移：
- 建立了 `*-api` 和 `*-impl` 子模块结构
- 定义了领域接口和 ACL 防腐层
- 但顶层 `src/` 的清理工作被延迟，形成技术债务

## Decision

### 决策方案

**彻底清理五个领域模块的顶层 `src/` 目录**，将所有代码迁移到对应的子模块，完成领域拆分的最后一公里。

### 清理策略

#### 1. koduck-market 清理内容

**顶层 src/ 待清理：**
- `controller/admin/KlineAdminController.java` → 迁移到 koduck-bootstrap
- `controller/market/KlineController.java` → 迁移到 koduck-bootstrap
- `controller/market/TechnicalIndicatorController.java` → 迁移到 koduck-bootstrap
- `controller/market/MarketController.java` → 迁移到 koduck-bootstrap
- `controller/market/MarketAdvancedController.java` → 迁移到 koduck-bootstrap
- `controller/market/SentimentController.java` → 迁移到 koduck-bootstrap
- `market/util/MarketFieldParser.java` → 已存在于 koduck-market-impl，删除重复
- `market/util/DataConverter.java` → 已存在于 koduck-market-impl，删除重复
- `market/config/MarketProviderConfig.java` → 迁移到 koduck-market-impl
- `market/provider/*` → 迁移到 koduck-market-impl

#### 2. koduck-portfolio 清理内容

**顶层 src/ 待清理：**
- `dto/portfolio/*` → 检查是否与 koduck-portfolio-api 重复，合并差异
- `repository/portfolio/*` → 已存在于 koduck-portfolio-impl，删除重复
- `entity/portfolio/*` → 已存在于 koduck-portfolio-impl，删除重复
- `controller/portfolio/PortfolioController.java` → 迁移到 koduck-bootstrap
- `controller/support/AuthenticatedUserResolver.java` → 评估是否属于基础设施
- `service/impl/portfolio/PortfolioServiceImpl.java` → 已存在于 koduck-portfolio-impl，删除重复
- `config/PortfolioCacheConfig.java` → 已存在于 koduck-portfolio-impl，删除重复

#### 3. koduck-strategy 清理内容

**顶层 src/ 待清理：**
- `controller/strategy/StrategyController.java` → 迁移到 koduck-bootstrap
- `service/impl/strategy/StrategyServiceImpl.java` → 已存在于 koduck-strategy-impl，删除重复

#### 4. koduck-community 清理内容

**顶层 src/ 待清理：**
- `dto/community/*` → 检查是否与 koduck-community-api 重复
- `repository/community/*` → 已存在于 koduck-community-impl，删除重复
- `entity/community/*` → 已存在于 koduck-community-impl，删除重复
- `util/CommunityEntityCopyUtils.java` → 迁移到 koduck-community-impl

#### 5. koduck-ai 清理内容

**顶层 src/ 待清理：**
- `dto/ai/*` → 检查是否与 koduck-ai-api 重复
- `repository/ai/*` → 已存在于 koduck-ai-impl，删除重复
- `entity/ai/*` → 已存在于 koduck-ai-impl，删除重复
- `config/AiModuleConfig.java` → 已存在于 koduck-ai-impl，删除重复
- `service/AiAnalysisService.java` → 已存在于 koduck-ai-api，删除重复
- `service/impl/AiAnalysisServiceImpl.java` → 已存在于 koduck-ai-impl，删除重复
- `ai/dto/*` → 检查是否与 koduck-ai-api 重复

### 迁移原则

1. **Controller 统一迁移到 koduck-bootstrap**：作为应用的 HTTP 入口层
2. **ServiceImpl 保留在 *-impl 子模块**：业务逻辑实现层
3. **DTO/Entity/Repository 保留在对应子模块**：数据层
4. **Config 根据职责分配**：领域配置在 *-impl，跨领域配置在 infrastructure
5. **Util 类合并重复**：保留一份在合适的模块

## Consequences

### Positive

1. **消除代码重复**：清理后每个类只存在于一个位置
2. **明确依赖关系**：顶层模块仅作为聚合，代码集中在子模块
3. **降低认知负担**：开发者只需关注子模块结构
4. **提升模块化评分**：解决 ARCHITECTURE-EVALUATION.md 中标识的 D-02 缺陷
5. **为后续优化奠基**：清理后可进一步拆分 koduck-core 和 koduck-infrastructure

### Negative

1. **短期风险**：大量文件移动可能导致合并冲突
2. **测试影响**：需要验证所有测试用例仍然通过
3. **文档更新**：需要同步更新架构文档

### Compatibility

- **API 兼容性**：仅移动文件位置，不修改类名和接口签名
- **功能兼容性**：不修改业务逻辑，仅调整代码位置
- **依赖兼容性**：保持现有依赖关系，仅清理重复

## Implementation Plan

### 执行顺序

1. **koduck-ai**（最简单，代码量最少）
2. **koduck-strategy**（简单，主要是 Controller）
3. **koduck-community**（中等，需要合并 DTO）
4. **koduck-portfolio**（中等，需要处理 AuthenticatedUserResolver）
5. **koduck-market**（最复杂，Provider 和 Util 类较多）

### 验证步骤

每个模块清理后执行：
1. `mvn clean compile` 编译通过
2. `mvn checkstyle:check` 无异常
3. `./scripts/quality-check.sh` 通过
4. 运行相关单元测试

## Notes

- 本 ADR 是领域迁移系列（ADR-0095 至 ADR-0127）的最终清理步骤
- 清理后 ARCHITECTURE-EVALUATION.md 中的 D-02 缺陷可标记为已解决
- 建议后续创建 ArchUnit 测试防止双重源码问题再次发生
