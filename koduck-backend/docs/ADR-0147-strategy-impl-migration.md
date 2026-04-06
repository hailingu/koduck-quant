# ADR-0147: Strategy 实现模块迁移

- Status: Accepted
- Date: 2026-04-06
- Issue: #624

## Context

koduck-strategy-api 模块已创建完成，定义了 Strategy 和 Backtest 领域的接口、DTO 和 ACL。现在需要创建 koduck-strategy-impl 实现模块，将实际业务逻辑从 koduck-core 迁移出来，完成 Strategy 领域的完整拆分。

### 当前状态

| 组件 | 位置 | 状态 |
|------|------|------|
| Strategy API | koduck-strategy-api | ✅ 已创建 |
| Strategy Impl | koduck-core / koduck-strategy/src | ❌ 待迁移 |
| Backtest Impl | koduck-core | ❌ 待迁移 |
| Entity | koduck-core | ❌ 待迁移 |
| Repository | koduck-core | ❌ 待迁移 |

### 需迁移的代码统计

```
koduck-core/src/main/java/com/koduck/
├── controller/backtest/BacktestController.java
├── dto/backtest/*.java (3 files)
├── dto/strategy/*.java (6 files)
├── entity/backtest/*.java (2 files)
├── entity/strategy/*.java (3 files)
├── mapper/StrategyMapper.java, BacktestTradeMapper.java
├── repository/backtest/*.java (2 files)
├── repository/strategy/*.java (3 files)
├── service/StrategyService.java, BacktestService.java
├── service/impl/backtest/BacktestServiceImpl.java
└── service/support/*.java (3 files)

koduck-strategy/src/main/java/com/koduck/
├── controller/strategy/StrategyController.java
└── service/impl/strategy/StrategyServiceImpl.java
```

## Decision

### 1. 创建 koduck-strategy-impl 模块

模块结构：
```
koduck-strategy/koduck-strategy-impl/
├── pom.xml
└── src/
    ├── main/java/com/koduck/strategy/
    │   ├── service/
    │   │   ├── impl/
    │   │   │   ├── StrategyServiceImpl.java
    │   │   │   └── BacktestServiceImpl.java
    │   │   └── support/
    │   │       ├── StrategyAccessSupport.java
    │   │       ├── BacktestSignal.java
    │   │       └── BacktestExecutionContext.java
    │   ├── entity/
    │   │   ├── strategy/
    │   │   │   ├── Strategy.java
    │   │   │   ├── StrategyVersion.java
    │   │   │   └── StrategyParameter.java
    │   │   └── backtest/
    │   │       ├── BacktestResult.java
    │   │       └── BacktestTrade.java
    │   ├── repository/
    │   │   ├── strategy/
    │   │   │   ├── StrategyRepository.java
    │   │   │   ├── StrategyVersionRepository.java
    │   │   │   └── StrategyParameterRepository.java
    │   │   └── backtest/
    │   │       ├── BacktestResultRepository.java
    │   │       └── BacktestTradeRepository.java
    │   ├── mapper/
    │   │   ├── StrategyMapper.java
    │   │   └── BacktestTradeMapper.java
    │   └── acl/
    │       └── StrategyQueryServiceImpl.java
    └── test/java/com/koduck/strategy/
        └── service/
            └── BacktestServiceImplTest.java
```

### 2. 依赖设计

```xml
<!-- koduck-strategy-impl/pom.xml -->
<dependencies>
    <!-- API 模块 -->
    <dependency>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-strategy-api</artifactId>
    </dependency>
    
    <!-- 其他领域 API（通过 ACL 访问） -->
    <dependency>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-market-api</artifactId>
    </dependency>
    
    <!-- 基础设施 -->
    <dependency>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-infrastructure</artifactId>
    </dependency>
    
    <!-- 公共模块 -->
    <dependency>
        <groupId>com.koduck</groupId>
        <artifactId>koduck-common</artifactId>
    </dependency>
</dependencies>
```

### 3. 代码迁移策略

采用**复制-验证-删除**策略：

1. **Phase 1**: 复制代码到 koduck-strategy-impl
   - 保持包结构一致
   - 更新 import 语句
   - 确保编译通过

2. **Phase 2**: 验证功能
   - 运行单元测试
   - 验证依赖注入
   - 检查 ACL 接口

3. **Phase 3**: 清理 koduck-core
   - 删除已迁移的代码
   - 更新 koduck-core 的 pom.xml
   - 验证整体编译

### 4. 包名映射

| 原位置 | 新位置 |
|--------|--------|
| com.koduck.controller.backtest | com.koduck.strategy.controller |
| com.koduck.controller.strategy | com.koduck.strategy.controller |
| com.koduck.dto.backtest | com.koduck.strategy.dto |
| com.koduck.dto.strategy | com.koduck.strategy.dto |
| com.koduck.entity.backtest | com.koduck.strategy.entity.backtest |
| com.koduck.entity.strategy | com.koduck.strategy.entity.strategy |
| com.koduck.repository.backtest | com.koduck.strategy.repository.backtest |
| com.koduck.repository.strategy | com.koduck.strategy.repository.strategy |
| com.koduck.service.impl.backtest | com.koduck.strategy.service.impl |
| com.koduck.service.impl.strategy | com.koduck.strategy.service.impl |
| com.koduck.service.support | com.koduck.strategy.service.support |
| com.koduck.mapper | com.koduck.strategy.mapper |

## Consequences

### Positive

1. **模块独立**: Strategy 领域完全独立，可单独编译、测试、部署
2. **代码清晰**: 领域边界明确，代码组织更符合 DDD 原则
3. **可维护性**: 策略相关变更不影响其他模块
4. **Core 瘦身**: koduck-core 代码行数减少约 2000+ 行

### Negative

1. **迁移成本**: 需要仔细处理依赖关系和包名变更
2. **测试回归**: 需要验证回测功能完整性
3. **暂时重复**: 迁移期间会有短暂代码重复

### Compatibility

- **向前兼容**: 保持 API 接口不变，调用方无需修改
- **ACL 兼容**: AI 模块通过 StrategyQueryService ACL 访问，无需变更
- **数据兼容**: 数据库表结构不变，无需迁移脚本

## Implementation Plan

### Step 1: 创建模块结构
- [ ] 创建 koduck-strategy-impl 目录
- [ ] 创建 pom.xml
- [ ] 更新 koduck-strategy/pom.xml

### Step 2: 迁移实体和仓储
- [ ] 迁移 Strategy 相关实体
- [ ] 迁移 Backtest 相关实体
- [ ] 迁移 Repository 接口

### Step 3: 迁移服务实现
- [ ] 迁移 StrategyServiceImpl
- [ ] 迁移 BacktestServiceImpl
- [ ] 迁移 Support 类

### Step 4: 迁移其他组件
- [ ] 迁移 Mapper
- [ ] 迁移 Controller（可选，可保留在 koduck-core）

### Step 5: 更新依赖
- [ ] 更新 koduck-bootstrap
- [ ] 清理 koduck-core

### Step 6: 验证
- [ ] 编译检查
- [ ] 单元测试
- [ ] 集成测试

## Notes

- 保持与 koduck-strategy-api 的包名一致
- Controller 可保留在 koduck-core 或迁移到 koduck-strategy-impl
- 确保 ACL 接口正确实现供 AI 模块使用
