# ADR-0113: 阶段5 - 清理 koduck-core 中的 portfolio 缓存配置依赖

- Status: Accepted
- Date: 2026-04-05
- Issue: #535

## Context

根据 ADR-0107 的规划，阶段5的任务是处理 koduck-core 中与 portfolio/community 相关的剩余依赖。经过阶段2-4的迁移，大部分代码已经迁移到各自的模块，但仍有部分配置需要处理。

### 当前状态

**koduck-core 中剩余的 portfolio 相关依赖：**

1. **CacheConfig.CACHE_PORTFOLIO_SUMMARY**: 缓存常量定义在 koduck-core 中，但属于 portfolio 模块的缓存
2. **ACL 层 (PortfolioQueryService)**: 这是防腐层接口，用于 koduck-core 访问 portfolio 数据，属于合理依赖
3. **WatchlistServiceImpl**: 引用了 portfolio 模块的 WatchlistItem，这是正常的业务依赖

### 问题分析

```java
// koduck-core/src/main/java/com/koduck/config/CacheConfig.java
public static final String CACHE_PORTFOLIO_SUMMARY = "portfolioSummary";
```

这个常量定义在 koduck-core 中，但：
1. 它是 portfolio 模块的缓存名称
2. koduck-portfolio 已经定义了相同的常量 `PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY`
3. 导致 koduck-core 需要维护 portfolio 的缓存配置

## Decision

### 将 CACHE_PORTFOLIO_SUMMARY 从 koduck-core 迁移到 koduck-portfolio

**迁移策略：**

1. **删除 koduck-core 中的常量**
   - 从 CacheConfig 中移除 `CACHE_PORTFOLIO_SUMMARY` 常量
   - 从 cacheManager() 方法中移除 portfolioSummaryConfig 的注册

2. **koduck-portfolio 接管缓存配置**
   - koduck-portfolio 已定义 `PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY`
   - 在 koduck-portfolio 中创建 PortfolioCacheManagerConfig 来注册 portfolio 相关的缓存

3. **更新 koduck-core 的依赖**
   - koduck-core 中如有引用 `CacheConfig.CACHE_PORTFOLIO_SUMMARY`，改为引用 `PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY`

### 依赖关系调整

迁移后，模块依赖关系将变为：

```
koduck-common (基础设施)
    ↑
koduck-portfolio (业务模块，包含自己的缓存配置)
    ↑
koduck-core (核心业务，通过 ACL 访问 portfolio)
```

## Consequences

### 正向影响

1. **职责清晰**: koduck-core 不再维护 portfolio 的缓存配置
2. **模块化完整**: portfolio 模块完全独立管理自己的缓存
3. **可维护性**: 缓存配置与业务模块绑定，便于后续调整

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 缓存名称不变，只是定义位置调整 |
| 功能兼容 | ✅ 无变化 | 缓存功能不变 |
| 依赖关系 | ✅ 优化 | koduck-core 不再包含 portfolio 缓存配置 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 缓存失效 | 低 | 中 | 确保缓存名称保持一致 |
| 编译错误 | 低 | 中 | 更新所有引用该常量的代码 |

## Implementation

### 变更清单

1. **koduck-core 模块**
   - [ ] 从 CacheConfig 中移除 `CACHE_PORTFOLIO_SUMMARY` 常量
   - [ ] 从 cacheManager() 方法中移除 portfolioSummaryConfig 的注册
   - [ ] 更新引用该常量的代码（如有）

2. **koduck-portfolio 模块**
   - [ ] 验证 `PortfolioCacheConfig.CACHE_PORTFOLIO_SUMMARY` 已定义
   - [ ] 创建 PortfolioCacheManagerConfig 注册 portfolio 缓存（如需要）

3. **验证**
   - [ ] mvn clean compile 编译通过
   - [ ] mvn checkstyle:check 无异常

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] 缓存功能正常

### 后续工作

完成阶段5后，portfolio 和 community 模块的迁移工作全部完成。后续可考虑：
- 进一步优化 koduck-core 的模块化
- 考虑将其他业务模块（如 market, strategy）也进行类似的迁移

## References

- Issue: #535
- ADR-0107: 迁移 portfolio 和 community 代码到对应模块
- ADR-0112: 迁移 Community 代码到 koduck-community 模块
