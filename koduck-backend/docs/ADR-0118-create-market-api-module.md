# ADR-0118: 创建 koduck-market-api 模块

- Status: Proposed
- Date: 2026-04-05
- Issue: #554

## Context

根据 ARCHITECTURE-EVALUATION.md 的评估结果，当前 koduck-backend 存在严重的架构问题：

1. **上帝模块问题**: koduck-core 承载全部业务逻辑（~15,000 行），包含 Market/Portfolio/Strategy/Community/AI 所有 Service 实现
2. **模块依赖混乱**: koduck-core 依赖 koduck-portfolio，koduck-market 又依赖 koduck-core，形成循环依赖
3. **缺乏防腐层**: 模块间直接依赖 Repository/Service，未通过接口解耦

为解决这些问题，需要建立清晰的模块边界，采用 DDD 分层架构风格。

## Decision

### 创建 koduck-market-api 模块

作为架构改进 Phase 1 的第一个任务，创建 Market 领域的 API 模块，定义该领域的契约（接口、DTO、事件、异常）。

### 模块结构

```
koduck-market/
└── koduck-market-api/
    ├── pom.xml
    └── src/main/java/com/koduck/market/
        ├── api/
        │   ├── MarketQueryService.java      # 查询接口
        │   ├── MarketCommandService.java    # 命令接口
        │   └── acl/
        │       └── MarketDataAcl.java       # 防腐层接口
        ├── dto/
        │   ├── MarketDataDto.java           # 行情数据 DTO
        │   ├── KlineDto.java                # K线数据 DTO
        │   ├── IndicatorDto.java            # 技术指标 DTO
        │   └── RealTimePriceDto.java        # 实时价格 DTO
        ├── event/
        │   └── MarketDataUpdatedEvent.java  # 行情更新事件
        └── exception/
            └── MarketDataException.java     # 领域异常
```

### 设计原则

| 原则 | 说明 | 实现方式 |
|------|------|----------|
| **接口与实现分离** | API 模块只定义契约，不包含实现 | 接口 + DTO 定义在 api 包 |
| **DTO 不可变** | 防止数据被意外修改 | 使用 Java Record |
| **技术无关** | API 模块不依赖具体技术框架 | 仅依赖 koduck-common，可选 spring-context |
| **防腐层** | 为其他模块提供只读访问接口 | MarketDataAcl 接口 |

### 接口拆分策略

将原 MarketService 拆分为：
- **MarketQueryService**: 只读查询操作（getRealTimePrice, getKlineData 等）
- **MarketCommandService**: 写操作（refreshCache, updateDataSource 等）

### 依赖关系

```
koduck-market-api
    └── koduck-common (异常基类、工具类)
```

**禁止依赖**：
- koduck-core
- koduck-infrastructure
- Spring Web、Spring Data 等技术实现

## Consequences

### 正向影响

1. **清晰的模块边界**: Market 领域的契约明确定义，便于理解和维护
2. **可独立演进**: API 模块稳定后，实现可以独立修改而不影响消费者
3. **便于测试**: 可以基于接口编写测试，不依赖具体实现
4. **防腐层基础**: 为后续其他模块通过 ACL 访问 Market 数据奠定基础

### 权衡

| 方面 | 权衡 | 决策 |
|------|------|------|
| **复杂度** | 增加模块数量，构建复杂度略有提升 | 接受，换取长期可维护性 |
| **DTO 映射** | 需要 DTO 与 Entity 之间的转换 | 使用 MapStruct 自动生成 |
| **接口版本** | API 变更需要同步更新实现和消费者 | 采用语义化版本管理 |

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 现有代码 | ✅ 无影响 | 新模块，不影响现有代码 |
| 包结构 | ✅ 无变化 | 新包路径 com.koduck.market |
| 构建 | ⚠️ 需更新 | 父 POM 需添加新模块 |

## Implementation

### 创建步骤

1. **创建目录结构**
   ```bash
   mkdir -p koduck-market/koduck-market-api/src/main/java/com/koduck/market/{api/acl,dto,event,exception}
   mkdir -p koduck-market/koduck-market-api/src/test/java/com/koduck/market
   ```

2. **创建 pom.xml**
   - 继承 koduck-backend-parent
   - 仅依赖 koduck-common
   - 可选依赖 spring-context（用于事件）

3. **提取接口和 DTO**
   - 从 koduck-core 分析 MarketService
   - 拆分为 Query/Command 接口
   - DTO 改为 Java Record

4. **创建防腐层接口**
   - MarketDataAcl 供其他模块使用
   - 返回不可变值对象

### 验证步骤

- [ ] `mvn clean compile` 编译通过
- [ ] `mvn checkstyle:check` 无异常
- [ ] DTO 全部使用 Java Record
- [ ] 无 Spring Web/Data 依赖
- [ ] 接口有完整 Javadoc

## References

- Issue: #554
- ARCHITECTURE-EVALUATION.md: 关键缺陷 S-01, S-02
- ARCHITECTURE-IMPROVEMENT-PLAN.md: Phase 1
- DDD 分层架构: https://ddd-practitioners.com/layered-architecture
