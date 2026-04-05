# ADR-0105: 修正 koduck-bootstrap 的 mainClass 配置

- Status: Accepted
- Date: 2026-04-05
- Issue: #508

## Context

在 koduck-bootstrap 模块的 pom.xml 中发现 mainClass 配置不正确：

### 当前状态

- **pom.xml 配置**: `com.koduck.KoduckApplication`
- **实际主类**: `com.koduck.KoduckBootstrapApplication`

### 问题分析

1. **配置错误**: pom.xml 中配置的 mainClass 与实际主类名称不匹配
2. **启动失败风险**: Spring Boot Maven 插件使用 mainClass 配置来生成可执行 jar 的启动清单（MANIFEST.MF），配置错误可能导致 jar 无法正确启动
3. **打包问题**: `mvn package` 生成的可执行 jar 可能无法找到主类

## Decision

### 修正 mainClass 配置

**将 koduck-bootstrap/pom.xml 中的 mainClass 从 `com.koduck.KoduckApplication` 修正为 `com.koduck.KoduckBootstrapApplication`。**

### 变更内容

| 文件 | 属性 | 原值 | 新值 |
|------|------|------|------|
| koduck-bootstrap/pom.xml | mainClass | com.koduck.KoduckApplication | com.koduck.KoduckBootstrapApplication |

## Consequences

### 正向影响

1. **修复启动问题**: 可执行 jar 能正确找到并启动主类
2. **打包正确**: `mvn package` 生成的 jar 包含正确的主类清单
3. **一致性**: pom.xml 配置与实际代码一致

### 兼容性影响

| 层面 | 影响 | 说明 |
|------|------|------|
| 构建兼容 | ✅ 无变化 | 仅修正配置值，构建流程不变 |
| 功能兼容 | ✅ 修复 | 修复了潜在的启动问题 |
| 部署兼容 | ✅ 修复 | 可执行 jar 现在能正确启动 |

### 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 修正错误 | 极低 | 高 | 验证实际主类名称和包路径 |

## Implementation

### 变更清单

1. **koduck-backend/koduck-bootstrap/pom.xml**
   - [ ] 修改 spring-boot-maven-plugin 的 mainClass 配置

### 验证步骤

- [x] `mvn clean compile` 编译通过
- [x] `mvn checkstyle:check` 无异常
- [x] `mvn package` 能正确打包
- [x] 检查生成的 jar 的 MANIFEST.MF 中 Start-Class 正确指向 com.koduck.KoduckBootstrapApplication

## References

- Issue: #508
- 主类文件: koduck-bootstrap/src/main/java/com/koduck/KoduckBootstrapApplication.java
