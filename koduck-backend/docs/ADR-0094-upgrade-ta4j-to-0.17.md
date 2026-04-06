# ADR-0094: 升级 Ta4j 从 0.16 到 0.17

- Status: Accepted
- Date: 2026-04-04
- Issue: #485

## Context

根据架构评估报告（ARCHITECTURE-EVALUATION.md），Ta4j 0.16 版本较旧，社区活跃度有限。当前项目使用 Ta4j 0.16 作为技术指标计算和回测引擎的核心依赖。

### 当前状态

- **当前版本**: 0.16
- **目标版本**: 0.17
- **使用场景**: 技术指标计算（MA、RSI、MACD、布林带等）、回测引擎
- **影响模块**: koduck-strategy（策略模块）、koduck-core（回测服务）

### Ta4j 0.17 更新内容

根据 [Ta4j 0.17 Release Notes](https://github.com/ta4j/ta4j/releases/tag/0.17)，主要变更包括：

1. **Bug Fixes**
   - 修复了多个指标计算中的边界条件问题
   - 修复了 `TrailingStopLossRule` 的触发逻辑
   - 修复了 `AverageTrueRange` 的初始化问题

2. **新功能**
   - 新增 `ChaikinOscillatorIndicator`
   - 新增 `KeltnerChannel` 指标
   - 增强 `BarSeries` 的线程安全性

3. **API 变更**
   - `BaseStrategy` 构造器参数顺序调整（向后兼容）
   - `Indicator` 接口新增默认方法
   - 部分废弃方法标记为 `@Deprecated`

## Decision

### 升级决策

**将 Ta4j 从 0.16 升级到 0.17**

理由：
1. **Bug 修复**: 0.17 修复了多个指标计算问题，直接影响策略回测准确性
2. **向后兼容**: 0.16 → 0.17 是次要版本升级，无破坏性变更
3. **技术债务**: 保持依赖更新，避免版本落后过多导致后续升级困难
4. **风险可控**: 升级范围单一，影响模块有限，易于验证

### 兼容性评估

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Maven 依赖 | ✅ 兼容 | 直接修改版本号 |
| API 兼容性 | ✅ 向后兼容 | 无破坏性变更 |
| 代码变更 | ✅ 无需修改 | 现有代码无需调整 |
| 测试验证 | ✅ 通过 | 所有现有测试通过 |

## Consequences

### 正向影响

1. **准确性提升**: 获得指标计算的 bug 修复
2. **新指标可用**: 可使用 ChaikinOscillator、KeltnerChannel 等新指标
3. **技术债务减少**: 依赖版本保持更新
4. **未来扩展**: 为后续策略引擎升级奠定基础

### 代价与风险

1. **回归测试**: 需要验证所有使用 Ta4j 的功能（回测、指标计算）
2. **文档更新**: 需要记录版本变更

### 回滚策略

如发现问题，可立即回滚：
```xml
<ta4j.version>0.16</ta4j.version>
```

## Implementation

1. ✅ 更新父 POM 中的 `ta4j.version` 属性
2. ✅ 执行 Maven 编译验证
3. ✅ 执行质量检查脚本
4. ✅ 更新 ADR-INDEX.md

## References

- Issue: #485
- 架构评估: ARCHITECTURE-EVALUATION.md
- Ta4j Release: https://github.com/ta4j/ta4j/releases/tag/0.17
