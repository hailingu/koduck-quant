# ADR-0128: Core 模块依赖重构

## 状态
- **日期**: 2026-04-05
- **作者**: Koduck Team
- **状态**: 提议
- **Issue**: #572

## 背景

随着 Phase 2 各领域模块的拆分完成，koduck-core 模块仍然直接依赖一些实现模块（如 koduck-portfolio、koduck-market 等）。这违反了依赖倒置原则，导致：

1. **循环依赖风险**: Core 模块与实现模块之间可能产生循环依赖
2. **测试困难**: 无法独立测试 Core 模块，必须依赖实现模块
3. **部署耦合**: Core 模块的变更可能影响所有实现模块

## 决策

将 koduck-core 的依赖从实现模块改为仅依赖 API 模块，通过接口进行跨模块通信。

### 依赖变更

```
Before:
koduck-core
    ├── koduck-portfolio (impl)  ❌ 需要移除
    ├── koduck-market (impl)     ❌ 需要移除
    ├── koduck-strategy (impl)   ❌ 需要移除
    ├── koduck-community (impl)  ❌ 需要移除
    └── koduck-infrastructure    ✓ 保留

After:
koduck-core
    ├── koduck-portfolio-api     ✓ 新增
    ├── koduck-market-api        ✓ 新增
    ├── koduck-strategy-api      ✓ 新增
    ├── koduck-community-api     ✓ 新增
    └── koduck-infrastructure    ✓ 保留
```

### 代码调整

Core 模块中的代码需要通过 API 接口调用其他模块：

```java
// Before: 直接依赖实现类
@Service
public class SomeCoreService {
    private final PortfolioServiceImpl portfolioService; // ❌
}

// After: 依赖 API 接口
@Service
public class SomeCoreService {
    private final PortfolioQueryService portfolioQueryService; // ✓
}
```

## 权衡

### 替代方案

1. **保持现状**: 继续让 koduck-core 依赖实现模块
   - ❌ 违反依赖倒置原则
   - ❌ 无法独立测试
   - ❌ 循环依赖风险

2. **完全移除 koduck-core**: 将 Core 的功能分散到各模块
   - ✅ 彻底解耦
   - ❌ 需要大量重构
   - ❌ 跨领域协调逻辑难以归属
   - ⏸️ 未来可考虑，当前风险过高

3. **创建协调服务模块**: 将跨领域协调逻辑移到新模块
   - ✅ 更清晰的职责划分
   - ❌ 增加模块数量
   - ⏸️ 未来可考虑

### 选择当前方案的理由

1. **渐进式演进**: 从依赖重构开始，风险可控
2. **符合架构目标**: 实现 API/Impl 分离的设计
3. **可测试性**: Core 模块可以独立测试
4. **为后续瘦身做准备**: Phase 3.2 将基于此次重构继续瘦身 koduck-core

## 影响

### 兼容性影响

- **koduck-core**: 依赖变更，需要更新代码中的引用
- **koduck-bootstrap**: 需要确保所有 impl 模块都被正确引入
- **其他模块**: 无直接影响

### 依赖关系变化

| 模块 | 变更前 | 变更后 |
|------|--------|--------|
| koduck-core | 依赖 impl 模块 | 依赖 api 模块 |
| koduck-bootstrap | 依赖 core + impl | 依赖 core + impl（不变）|
| *-api 模块 | 被 core 间接依赖 | 被 core 直接依赖 |

## 实施计划

### Phase 1: 更新 pom.xml
1. 检查 koduck-core/pom.xml 中的依赖
2. 移除所有 `*-impl` 和 `*`（父模块）依赖
3. 添加对应的 `*-api` 依赖

### Phase 2: 代码调整
1. 检查 koduck-core 中使用其他模块的代码
2. 将具体类引用改为接口引用
3. 使用 ACL 接口进行跨模块调用

### Phase 3: 验证
1. 运行 `mvn dependency:tree` 验证依赖
2. 编译检查
3. 运行测试

## 相关文档

- [ARCHITECTURE-IMPROVEMENT-PLAN.md](./ARCHITECTURE-IMPROVEMENT-PLAN.md)
- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md)
- ADR-0121: Market 领域实现模块迁移
- ADR-0122: Portfolio 领域实现模块迁移
- ADR-0126: Strategy 领域模块迁移
- ADR-0127: Community 领域模块迁移
