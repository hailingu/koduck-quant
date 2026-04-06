# ADR-0104: 统一 Checkstyle 配置到父 POM 管理

- Status: Accepted
- Date: 2026-04-05
- Issue: #506

## Context

当前项目的 Checkstyle 配置存在重复定义问题：

### 当前状态

1. **父 POM** (`koduck-backend/pom.xml`)
   - `pluginManagement` 中已定义了完整的 checkstyle 插件配置
   - 但 `build/plugins` 中没有添加 checkstyle 插件执行

2. **子模块** (koduck-core, koduck-auth, koduck-market 等)
   - 每个子模块的 `build/plugins` 中都重复定义了几乎相同的 checkstyle 配置
   - 配置内容包括：configLocation, consoleOutput, includeTestSourceDirectory, failsOnError, failOnViolation, violationSeverity, excludes 等
   - 每个子模块都定义了 `checkstyle-validate` execution

### 问题分析

1. **配置重复**: 9 个子模块重复定义相同的 checkstyle 配置
2. **维护困难**: 修改配置需要改动多个文件
3. **不一致风险**: 子模块配置可能逐渐 diverge
4. **违反 DRY 原则**: 相同配置应该只定义一次

## Decision

### 将 Checkstyle 配置统一到父 POM 管理

**父 POM 统一管理 Checkstyle 配置，子模块仅做差异化覆盖。**

#### 具体变更

1. **父 POM** (`koduck-backend/pom.xml`)
   - 在 `build/plugins` 中添加 checkstyle 插件，绑定到 validate 阶段
   - 保留 `pluginManagement` 中的完整配置作为默认配置
   - 使用 `${project.basedir}` 确保配置路径正确解析

2. **子模块** (所有 koduck-* 模块)
   - 移除 `build/plugins` 中重复的 checkstyle 插件配置
   - 如有特殊需求，仅保留差异化配置

### 权衡分析

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **方案A**: 父 POM 统一管理 | 单一来源，维护简单，避免重复 | 需要修改多个子模块 | ✅ 采用 |
| **方案B**: 保持现状 | 无需改动 | 配置重复，维护困难 | ❌ 拒绝 |
| **方案C**: 使用 profile 控制 | 灵活性高 | 复杂度增加 | ❌ 拒绝 |

## Consequences

### 正向影响

1. **维护简化**: 修改 Checkstyle 配置只需改动父 POM
2. **一致性**: 所有模块使用统一的代码风格检查规则
3. **DRY 原则**: 消除重复配置
4. **可扩展性**: 新增模块自动继承 Checkstyle 配置

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 构建兼容 | ✅ 无变化 | 构建流程和检查规则不变 |
| 功能兼容 | ✅ 无变化 | 仅配置位置调整，无功能变更 |
| 配置覆盖 | ✅ 支持 | 子模块仍可通过 pluginManagement 覆盖 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 路径解析错误 | 低 | 中 | 使用 `${project.basedir}` 确保路径正确 |
| 子模块特殊配置丢失 | 低 | 低 | 检查每个子模块的差异化配置 |

## Implementation

### 变更清单

1. **koduck-backend/pom.xml**
   - [ ] 在 `build/plugins` 中添加 checkstyle 插件
   - [ ] 绑定到 validate 阶段
   - [ ] 继承 pluginManagement 中的配置

2. **子模块 pom.xml** (koduck-core, koduck-auth, koduck-market, koduck-portfolio, koduck-strategy, koduck-community, koduck-ai, koduck-bootstrap, koduck-common)
   - [ ] 移除 `build/plugins` 中的 checkstyle 插件配置

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn checkstyle:check` 无异常
- [x] `mvn validate` 触发 checkstyle 检查
- [x] `mvn pmd:check` 通过
- [x] 所有模块代码风格检查通过

## References

- Issue: #506
- 父 POM: koduck-backend/pom.xml
- 涉及的子模块: koduck-core, koduck-auth, koduck-market, koduck-portfolio, koduck-strategy, koduck-community, koduck-ai, koduck-bootstrap, koduck-common
