# ADR-0131: Infrastructure 模块重构

## 状态

- **状态**: 草案
- **日期**: 2026-04-05
- **作者**: Koduck Team

## 背景

当前 `koduck-infrastructure` 模块包含了大量的技术实现细节，包括 Repository 实现、缓存配置、消息队列等。随着架构改进计划的推进，各领域模块已经分离出 `*-api` 模块定义接口，但 `koduck-infrastructure` 尚未明确其职责边界。

## 决策

### 1. 明确 Infrastructure 模块职责

`koduck-infrastructure` 模块将作为**技术适配器层**，职责包括：

- 实现各 `*-api` 模块定义的 Repository 接口
- 提供缓存、消息队列等技术基础设施
- 不包含业务逻辑，仅做技术适配

### 2. 依赖关系

```
koduck-infrastructure
    ├── koduck-market-api (依赖)
    ├── koduck-portfolio-api (依赖)
    ├── koduck-strategy-api (依赖)
    ├── koduck-community-api (依赖)
    ├── koduck-ai-api (依赖)
    ├── koduck-auth (依赖)
    └── koduck-common (依赖)
```

**关键约束**: `koduck-infrastructure` 只依赖 `*-api` 模块，不依赖 `*-impl` 模块。

### 3. 实现策略

对于每个 Repository 接口，在 `koduck-infrastructure` 中创建对应的实现类：

```java
// 示例：PortfolioRepositoryImpl
@Repository
@RequiredArgsConstructor
public class PortfolioRepositoryImpl implements PortfolioRepository {
    private final JpaPortfolioRepository jpaRepository;
    private final PortfolioCacheService cacheService;
    
    @Override
    public Optional<Portfolio> findById(Long id) {
        // 先查缓存
        return cacheService.get(id)
            .or(() -> {
                // 再查数据库
                Optional<Portfolio> portfolio = jpaRepository.findById(id);
                portfolio.ifPresent(cacheService::put);
                return portfolio;
            });
    }
}
```

### 4. 缓存迁移策略

当前缓存配置分散在各模块，统一迁移到 `koduck-infrastructure`：

| 原位置 | 新位置 | 说明 |
|--------|--------|------|
| `koduck-market-impl` 缓存 | `koduck-infrastructure` | 行情数据缓存 |
| `koduck-portfolio-impl` 缓存 | `koduck-infrastructure` | 组合数据缓存 |
| `koduck-core` 通用缓存 | `koduck-infrastructure` | 通用缓存服务 |

## 权衡

### 优点

1. **职责清晰**: Infrastructure 模块专注于技术实现，不掺杂业务逻辑
2. **可替换性**: 技术实现（如从 JPA 改为 MongoDB）不影响业务代码
3. **统一治理**: 缓存、数据库访问等技术细节集中管理

### 缺点

1. **依赖复杂**: `koduck-infrastructure` 需要依赖所有 `*-api` 模块
2. **变更影响**: 基础设施变更可能影响所有模块

## 兼容性影响

### 对现有代码的影响

- `*-impl` 模块需要移除 Repository 实现，改为依赖 `koduck-infrastructure`
- 缓存配置需要从各模块迁移到 `koduck-infrastructure`

### 迁移步骤

1. 在 `koduck-infrastructure` 创建 Repository 实现
2. 更新 `*-impl` 模块依赖，移除 Repository 实现
3. 迁移缓存配置
4. 验证所有模块编译和测试通过

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- Issue #577

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-05 | 创建 ADR | 初始版本 |
