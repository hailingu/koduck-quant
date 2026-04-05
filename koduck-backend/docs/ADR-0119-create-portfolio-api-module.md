# ADR-0119: 创建 koduck-portfolio-api 模块

- Status: Proposed
- Date: 2026-04-05
- Issue: #556

## Context

根据 ARCHITECTURE-EVALUATION.md 的评估结果，当前 koduck-backend 存在严重的架构问题，其中之一是 koduck-core 成为"上帝模块"。Portfolio 领域（投资组合管理）是核心业务领域之一，需要将其从 koduck-core 中拆分出来。

### 当前问题

1. **Portfolio 代码集中在 koduck-core**: PortfolioService、PositionService 等都在 koduck-core 中
2. **AI 模块直接依赖 Portfolio Repository**: 缺乏防腐层，耦合度高
3. **循环依赖风险**: koduck-portfolio → koduck-core → koduck-portfolio

### 目标

建立 Portfolio 领域的清晰边界，通过 API 模块定义领域契约，为后续完全拆分奠定基础。

## Decision

### 创建 koduck-portfolio-api 模块

创建 Portfolio 领域的 API 模块，定义该领域的契约（接口、DTO、事件、异常），特别为 AI 模块提供防腐层接口。

### 模块结构

```
koduck-portfolio/
└── koduck-portfolio-api/
    ├── pom.xml
    └── src/main/java/com/koduck/portfolio/
        ├── api/
        │   ├── PortfolioQueryService.java
        │   ├── PortfolioCommandService.java
        │   ├── PositionQueryService.java
        │   ├── PositionCommandService.java
        │   └── acl/
        │       └── PortfolioQueryService.java
        ├── dto/
        │   ├── PortfolioDto.java
        │   ├── PortfolioSummaryDto.java
        │   ├── PositionDto.java
        │   ├── TransactionDto.java
        │   └── PortfolioSnapshot.java
        ├── event/
        │   ├── PortfolioCreatedEvent.java
        │   ├── PortfolioUpdatedEvent.java
        │   └── PositionChangedEvent.java
        └── exception/
            └── PortfolioException.java
```

### 设计原则

| 原则 | 说明 | 实现方式 |
|------|------|----------|
| **接口与实现分离** | API 模块只定义契约 | 接口 + DTO 定义在 api 包 |
| **DTO 不可变** | 防止数据被意外修改 | 使用 Java Record |
| **防腐层** | 为 AI 模块提供只读访问 | PortfolioQueryService (ACL) |
| **值对象** | ACL 返回的数据不可变 | PortfolioSnapshot (Record) |

### ACL 设计

**PortfolioQueryService (ACL 接口)**:
```java
public interface PortfolioQueryService {
    Optional<PortfolioSnapshot> getSnapshot(Long portfolioId);
    List<PortfolioSnapshot> getSnapshots(List<Long> portfolioIds);
}
```

**PortfolioSnapshot (值对象)**:
```java
public record PortfolioSnapshot(
    Long portfolioId,
    String portfolioName,
    List<PositionSnapshot> positions,
    BigDecimal totalValue,
    BigDecimal totalCost,
    BigDecimal totalReturn,
    BigDecimal totalReturnPercent
) {}
```

### 接口拆分策略

**投资组合管理**:
- **PortfolioQueryService**: 查询投资组合信息
- **PortfolioCommandService**: 创建、更新、删除投资组合

**持仓管理**:
- **PositionQueryService**: 查询持仓信息
- **PositionCommandService**: 添加、更新、删除持仓

### 依赖关系

```
koduck-portfolio-api
    └── koduck-common (异常基类、工具类)
```

**禁止依赖**：
- koduck-core
- koduck-market (通过 ACL 反向依赖)
- Spring Web、Spring Data 等技术实现

## Consequences

### 正向影响

1. **清晰的 Portfolio 边界**: 投资组合领域的契约明确定义
2. **AI 模块解耦**: AI 通过 ACL 接口访问 Portfolio 数据，不直接依赖 Repository
3. **可独立演进**: API 模块稳定后，实现可以独立修改
4. **便于测试**: 可以基于接口编写测试，不依赖具体实现

### 权衡

| 方面 | 权衡 | 决策 |
|------|------|------|
| **复杂度** | 增加模块数量 | 接受，换取长期可维护性 |
| **DTO 映射** | 需要 Entity 与 DTO 转换 | 使用 MapStruct |
| **数据一致性** | ACL 返回的是快照，非实时 | 文档中明确说明 |

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 现有代码 | ✅ 无影响 | 新模块，不影响现有代码 |
| 包结构 | ✅ 无变化 | 新包路径 com.koduck.portfolio |
| AI 模块 | ⚠️ 后续需更新 | Phase 2.5 更新 AI 依赖 |

## Implementation

### 创建步骤

1. **创建目录结构**
   ```bash
   mkdir -p koduck-portfolio/koduck-portfolio-api/src/main/java/com/koduck/portfolio/{api/acl,dto,event,exception}
   ```

2. **创建 pom.xml**
   - 继承 koduck-backend-parent
   - 仅依赖 koduck-common

3. **定义接口和 DTO**
   - 参考 koduck-core 中的 PortfolioService
   - DTO 改为 Java Record
   - 创建 PortfolioSnapshot 值对象

4. **创建 ACL 接口**
   - PortfolioQueryService 供 AI 模块使用
   - 返回 PortfolioSnapshot 不可变值对象

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] DTO 全部使用 Java Record
- [ ] PortfolioSnapshot 不可变
- [ ] 接口有完整 Javadoc

## References

- Issue: #556
- ARCHITECTURE-EVALUATION.md: 关键缺陷 S-01, S-02
- ARCHITECTURE-IMPROVEMENT-PLAN.md: Phase 1
- ADR-0118: 创建 koduck-market-api 模块
