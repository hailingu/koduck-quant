# ADR-0103: 统一 ta4j 版本管理到 BOM 模块

- Status: Accepted
- Date: 2026-04-05
- Issue: #504

## Context

根据架构评估报告（ARCHITECTURE-EVALUATION.md），当前项目存在 BOM 与父 POM 版本不一致的问题：

### 当前状态

| 位置 | ta4j 版本 | 说明 |
|------|-----------|------|
| koduck-bom/pom.xml | 0.16 | BOM 模块定义 |
| koduck-backend/pom.xml | 0.17 | 父 POM 定义 |

### 问题分析

1. **版本不一致**: BOM 和父 POM 中 ta4j 版本不同，可能导致依赖解析混乱
2. **版本管理分散**: 依赖版本定义分散在两个位置，维护成本高
3. **违反单一职责**: BOM 模块本应集中管理所有依赖版本，但父 POM 仍重复定义

## Decision

### 统一依赖版本管理到 BOM 模块

**将所有依赖版本定义集中到 BOM 模块，父 POM 仅通过 import BOM 来管理依赖版本。**

#### 具体变更

1. **更新 BOM 模块** (koduck-bom/pom.xml)
   - 将 ta4j 版本从 0.16 更新为 0.17
   - 确保所有依赖版本在 BOM 中统一定义

2. **简化父 POM** (koduck-backend/pom.xml)
   - 移除 `ta4j.version` 属性定义
   - 移除 `mapstruct.version` 等已在 BOM 中定义的属性
   - 移除 `dependencyManagement` 中已在 BOM 中定义的依赖
   - 添加 BOM import 引用

### 权衡分析

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **方案A**: 集中到 BOM | 版本统一管理，维护简单，符合 Maven BOM 最佳实践 | 需要修改父 POM 结构 | ✅ 采用 |
| **方案B**: 保留现状 | 无需改动 | 版本不一致风险，维护困难 | ❌ 拒绝 |
| **方案C**: 移除 BOM | 简化结构 | 失去 BOM 带来的版本统一管理优势 | ❌ 拒绝 |

## Consequences

### 正向影响

1. **版本一致性**: 消除 BOM 与父 POM 版本不一致问题
2. **维护简化**: 所有依赖版本集中在一处管理
3. **最佳实践**: 符合 Maven BOM 设计模式
4. **可扩展性**: 新增依赖版本管理更加规范

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| API 兼容 | ✅ 无变化 | 仅版本管理调整，无 API 变更 |
| 功能兼容 | ✅ 无变化 | ta4j 版本保持 0.17，功能不变 |
| 构建兼容 | ✅ 无变化 | Maven 构建流程不变 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 依赖解析错误 | 低 | 中 | 充分测试 Maven 编译和依赖树 |
| 版本冲突 | 低 | 中 | 使用 `mvn dependency:tree` 验证 |

## Implementation

### 变更清单

1. **koduck-bom/pom.xml**
   - [ ] 更新 `ta4j.version` 从 0.16 到 0.17

2. **koduck-backend/pom.xml**
   - [ ] 添加 BOM import 依赖
   - [ ] 移除重复的属性定义（ta4j.version, mapstruct.version 等）
   - [ ] 移除 `dependencyManagement` 中重复的依赖定义

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn dependency:tree` 检查依赖版本正确 (ta4j-core:0.17)
- [x] `mvn checkstyle:check` 无异常
- [x] `mvn pmd:check` 通过

## References

- Issue: #504
- ADR-0094: 升级 Ta4j 从 0.16 到 0.17
- 架构评估: ARCHITECTURE-EVALUATION.md
