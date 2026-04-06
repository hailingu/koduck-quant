# ADR-0121: 迁移 Market 领域实现到 koduck-market-impl 模块

- Status: Proposed
- Date: 2026-04-05
- Issue: #560

## Context

根据 ARCHITECTURE-IMPROVEMENT-PLAN.md 的规划，Phase 2 的目标是将 koduck-core 中的业务逻辑迁移到独立的领域模块。Market 领域是首批迁移的目标之一。

### 当前状态

- **koduck-market-api**: 已创建，定义了 MarketQueryService、MarketCommandService 接口和 DTO
- **koduck-core**: 包含 MarketServiceImpl、Market Repository、Market Entity 等实现代码
- **问题**: 实现代码与 koduck-core 耦合，不符合模块化架构目标

### 目标

- 将 Market 领域实现从 koduck-core 迁移到 koduck-market-impl
- 实现 koduck-market-api 定义的接口
- 保持 koduck-core 中的代码暂时可用（向后兼容）

## Decision

### 创建 koduck-market-impl 模块

创建 koduck-market-impl 模块，包含 Market 领域的所有实现代码。

### 模块结构

```
koduck-market/
├── koduck-market-api/          (已存在)
│   ├── api/MarketQueryService
│   ├── api/MarketCommandService
│   ├── api/acl/MarketDataAcl
│   └── dto/
└── koduck-market-impl/         (新建)
    ├── pom.xml
    └── src/main/java/com/koduck/market/
        ├── service/
        │   └── MarketServiceImpl
        ├── repository/
        │   └── MarketDataRepository
        └── entity/
            └── MarketData
```

### 依赖关系

```
koduck-market-impl
    ├── koduck-market-api (接口)
    ├── koduck-infrastructure (Repository 支持)
    └── koduck-common (工具类)
```

### 迁移内容

| 类型 | koduck-core 中的位置 | koduck-market-impl 中的位置 |
|------|---------------------|---------------------------|
| ServiceImpl | service/impl/MarketServiceImpl | service/MarketServiceImpl |
| Repository | repository/market/* | repository/* |
| Entity | entity/market/* | entity/* |

### 接口实现

MarketServiceImpl 需要实现 koduck-market-api 中定义的接口：

```java
@Service
@RequiredArgsConstructor
public class MarketServiceImpl implements MarketQueryService, MarketCommandService {
    // 实现接口方法
}
```

### 向后兼容策略

1. **Phase 2**: 在 koduck-market-impl 创建新实现，koduck-core 保留原代码
2. **Phase 3**: 移除 koduck-core 中的 Market 相关代码，完全迁移到 koduck-market-impl

## Consequences

### 正向影响

1. **清晰的模块边界**: Market 领域实现独立，不依赖 koduck-core
2. **可独立测试**: koduck-market-impl 可以独立编译和测试
3. **可独立部署**: 未来可以独立部署 Market 服务
4. **接口与实现分离**: 符合 DDD 分层架构原则

### 权衡

| 方面 | 权衡 | 决策 |
|------|------|------|
| **代码重复** | Phase 2 期间 koduck-core 和 koduck-market-impl 都有 Market 代码 | 接受，Phase 3 移除 koduck-core 代码 |
| **依赖管理** | 需要确保 koduck-bootstrap 正确引入 koduck-market-impl | 更新 bootstrap 的 pom.xml |

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 现有功能 | ✅ 无影响 | koduck-core 代码暂时保留 |
| 包路径 | ⚠️ 变化 | 从 com.koduck.service 变为 com.koduck.market.service |
| 依赖关系 | ✅ 改善 | 从 koduck-core 依赖变为 koduck-market-impl 依赖 |

## Implementation

### 创建步骤

1. **创建目录结构**
   ```bash
   mkdir -p koduck-market/koduck-market-impl/src/main/java/com/koduck/market/{service,repository,entity}
   mkdir -p koduck-market/koduck-market-impl/src/test/java/com/koduck/market/service
   ```

2. **创建 pom.xml**
   - 继承 koduck-backend-parent
   - 依赖 koduck-market-api
   - 依赖 koduck-infrastructure
   - 依赖 koduck-common

3. **迁移代码**
   - 复制 MarketServiceImpl，调整包名
   - 复制 Repository 接口和实现
   - 复制 Entity
   - 实现 koduck-market-api 接口

4. **创建测试**
   - 单元测试覆盖率 ≥ 60%
   - 集成测试（可选）

### 验证步骤

- [ ] `mvn clean test` 通过
- [ ] 单元测试覆盖率 ≥ 60%
- [ ] ArchUnit 测试通过
- [ ] koduck-bootstrap 正常启动

## References

- Issue: #560
- ARCHITECTURE-IMPROVEMENT-PLAN.md: Phase 2
- ADR-0118: 创建 koduck-market-api 模块
- ADR-0120: 引入 ArchUnit 架构测试
