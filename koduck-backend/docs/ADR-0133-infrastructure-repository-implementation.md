# ADR-0133: Infrastructure Repository Implementation

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

根据 ADR-0131，koduck-infrastructure 模块将作为技术适配器层，负责实现各 `*-api` 模块定义的 Repository 接口。当前 koduck-infrastructure 仅包含配置类，缺少 Repository 实现。

## 决策

### 1. 创建 Repository 实现类

在 koduck-infrastructure 模块中创建 Repository 实现类，遵循以下命名规范：
- 实现类名: `{InterfaceName}Impl`
- 包路径: `com.koduck.infrastructure.repository.{domain}`

### 2. 实现模式

采用委托模式（Delegation Pattern）：
- Repository 实现类委托给 JPA Repository 进行数据访问
- 添加缓存层提高性能
- 不包含业务逻辑，仅做技术适配

```java
@Repository
@RequiredArgsConstructor
public class KlineDataRepositoryImpl implements KlineDataRepository {
    private final JpaKlineDataRepository jpaRepository;
    private final CacheManager cacheManager;
    
    @Override
    public Optional<KlineData> findById(Long id) {
        // 先查缓存
        // 再查数据库
    }
}
```

### 3. 缓存策略

- 使用 Spring Cache 抽象
- 缓存配置集中管理
- 支持缓存失效和更新

## 权衡

### 优点

1. **职责清晰**: Infrastructure 模块专注于技术实现
2. **可替换性**: 技术实现变更不影响业务代码
3. **统一治理**: 数据访问模式集中管理

### 缺点

1. **额外抽象层**: 增加了一层委托
2. **维护成本**: 需要维护接口和实现的一致性

## 兼容性影响

### 对现有代码的影响

- koduck-core 中的 Repository 接口需要保留，但实现移至 koduck-infrastructure
- 依赖注入自动装配新的实现类

### 迁移步骤

1. 在 koduck-infrastructure 创建 Repository 实现类
2. 添加必要的 JPA Repository 接口
3. 配置缓存
4. 验证编译和测试通过

## 相关文档

- [ADR-0131-infrastructure-refactoring.md](./ADR-0131-infrastructure-refactoring.md)
- [ADR-0132-core-slimming.md](./ADR-0132-core-slimming.md)
- Issue #589

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
