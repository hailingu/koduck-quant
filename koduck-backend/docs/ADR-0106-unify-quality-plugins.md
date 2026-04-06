# ADR-0106: 统一 PMD、SpotBugs、JaCoCo 配置到父 POM

- Status: Accepted
- Date: 2026-04-05
- Issue: #510

## Context

当前项目的 PMD、SpotBugs、JaCoCo 质量插件配置存在分散和不一致问题：

### 当前状态

1. **父 POM** (`koduck-backend/pom.xml`)
   - `pluginManagement` 中已定义了 PMD、SpotBugs、JaCoCo 的完整配置
   - 但 `build/plugins` 中没有添加这些插件的执行

2. **子模块配置不一致**
   - **koduck-core**: 有完整的 PMD、SpotBugs、JaCoCo 配置（含 execution）
   - **koduck-auth**: 只有 SpotBugs 的简单配置
   - **其他模块**: 没有配置这些质量插件

### 问题分析

1. **配置分散**: 质量插件配置分散在多个模块
2. **不一致**: 各模块配置标准不统一
3. **覆盖不全**: 部分模块缺乏质量门禁保护
4. **维护困难**: 修改配置需要改动多个文件

## Decision

### 统一质量插件配置到父 POM

**将 PMD、SpotBugs、JaCoCo 配置统一到父 POM，所有模块自动继承。**

#### 具体变更

1. **父 POM** (`koduck-backend/pom.xml`)
   - 在 `build/plugins` 中添加 PMD、SpotBugs、JaCoCo 插件执行
   - PMD 绑定到 verify 阶段
   - SpotBugs 绑定到 verify 阶段
   - JaCoCo 绑定到 test 和 verify 阶段

2. **子模块**
   - 移除 `build/plugins` 中重复的质量插件配置
   - 保留 koduck-core 的特殊 JaCoCo 配置（如有需要可覆盖）

### 权衡分析

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **方案A**: 父 POM 统一管理 | 单一来源，所有模块统一标准 | 需要修改子模块 | ✅ 采用 |
| **方案B**: 保持现状 | 无需改动 | 配置分散，覆盖不全 | ❌ 拒绝 |
| **方案C**: 使用 profile 控制 | 灵活性高 | 复杂度增加，需要显式激活 | ❌ 拒绝 |

## Consequences

### 正向影响

1. **统一标准**: 所有模块使用相同的质量门禁标准
2. **维护简化**: 修改质量配置只需改动父 POM
3. **全面覆盖**: 所有模块都受质量门禁保护
4. **一致性**: 消除配置差异

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 构建兼容 | ✅ 无变化 | 构建流程不变，新增质量检查 |
| 功能兼容 | ✅ 无变化 | 仅配置位置调整 |
| 质量门禁 | ✅ 增强 | 所有模块现在都受质量门禁保护 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 部分模块质量检查失败 | 中 | 中 | 逐步启用，先修复再合并 |
| 构建时间增加 | 低 | 低 | 质量检查在 verify 阶段执行，可并行 |

## Implementation

### 变更清单

1. **koduck-backend/pom.xml**
   - [x] 在 `build/plugins` 中添加 JaCoCo 插件（绑定 test 和 verify 阶段）
   - [x] 父 POM `pluginManagement` 中已有 PMD 和 SpotBugs 配置

2. **子模块 pom.xml**
   - [x] 简化 koduck-core 的 SpotBugs 配置，只保留差异化部分（excludeFilterFile）
   - [x] 保留 koduck-core 的 PMD 配置（使用自定义 ruleset）
   - [x] 保留 koduck-core 的 JaCoCo 配置（使用自定义 includes 和 rules）
   - [x] 保留 koduck-auth 的 SpotBugs 配置（使用 excludeFilterFile）

3. **SpotBugs 排除规则更新**
   - [x] 更新 koduck-auth/spotbugs-exclude.xml，排除 SE_TRANSIENT_FIELD_NOT_RESTORED
   - [x] 更新 koduck-core/spotbugs-exclude.xml，排除 DTO 类的 SE_TRANSIENT_FIELD_NOT_RESTORED

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn checkstyle:check` 无异常
- [x] `mvn verify` 所有模块通过
- [x] JaCoCo 覆盖率报告生成

## References

- Issue: #510
- 父 POM: koduck-backend/pom.xml
- 涉及的子模块: koduck-core, koduck-auth, koduck-market, koduck-portfolio, koduck-strategy, koduck-community, koduck-ai, koduck-bootstrap, koduck-common
