# ADR-0137: ArchUnit 架构守护

## 状态

- **状态**: 草案
- **日期**: 2026-04-06
- **作者**: Koduck Team

## 背景

Phase 1.3 已经引入了 ArchUnit 基础架构测试，但随着 Phase 2 和 Phase 3 的模块拆分完成，需要更全面的架构规则来守护改进后的架构，防止架构退化。

## 目标

1. 建立全面的 ArchUnit 架构守护测试
2. 确保模块依赖方向正确
3. 防止循环依赖
4. 统一命名规范
5. 在 CI 中阻断违规构建

## 架构规则

### 1. 分层架构规则

```
bootstrap
    ↑
controller (optional)
    ↑
domain modules (api/impl)
    ↑
infrastructure
    ↑
common
```

**规则:**
- Common 模块不应依赖任何其他模块
- API 模块不应依赖 Infrastructure 模块
- API 模块不应依赖 Impl 模块

### 2. 模块依赖规则

**允许的方向:**
- `*-impl` → `*-api` (实现依赖接口)
- `*-impl` → `common` (实现依赖公共工具)
- `*-impl` → `infrastructure` (实现依赖基础设施)
- `bootstrap` → `*-impl` (启动模块依赖实现)
- `bootstrap` → `*-api` (启动模块依赖接口)

**禁止的方向:**
- `*-api` → `*-impl` (接口不应依赖实现)
- `*-api` → `infrastructure` (接口不应依赖基础设施)
- `common` → 任何其他模块 (公共模块不应依赖其他模块)

### 3. 循环依赖规则

- 模块间不应有循环依赖
- 包间不应有循环依赖

### 4. 命名规范规则

**接口命名:**
- API 接口应以 `Service` 结尾
- Repository 接口应以 `Repository` 结尾

**类命名:**
- 实现类应以 `Impl` 结尾
- Controller 类应以 `Controller` 结尾
- DTO 类应以 `Dto` 结尾
- Entity 类无特殊后缀要求

## 实现策略

### 测试类结构

```
koduck-bootstrap/src/test/java/com/koduck/architecture/
├── ArchitectureConstants.java    # 常量定义
├── LayeredArchitectureTest.java  # 分层架构规则
├── PackageDependencyRulesTest.java   # 包依赖规则
├── CircularDependencyRulesTest.java  # 循环依赖规则
└── NamingConventionRulesTest.java    # 命名规范规则
```

### CI 集成

ArchUnit 测试应在 CI 中运行，测试失败会阻断构建：

```yaml
- name: Run ArchUnit Tests
  run: mvn test -pl koduck-bootstrap -Dtest="*ArchitectureTest,*RulesTest"
```

## 权衡

### 优点

1. **防止架构退化**: 自动化测试确保架构规则不被破坏
2. **快速反馈**: 开发阶段就能发现架构违规
3. **文档化**: 测试代码本身就是架构规则的文档
4. **可维护性**: 新开发者可以通过测试了解架构约束

### 缺点

1. **学习成本**: 需要学习 ArchUnit 的 API
2. **维护成本**: 架构变更时需要更新测试
3. **假阳性**: 某些特殊情况可能需要例外处理

## 兼容性影响

### 对现有代码的影响

- 现有代码需要通过所有 ArchUnit 测试
- 如果现有代码违反规则，需要修复或添加例外

### 迁移步骤

1. 编写 ArchUnit 测试
2. 运行测试，识别违规代码
3. 修复违规代码或添加例外
4. 在 CI 中启用 ArchUnit 测试

## 相关文档

- [ADR-0120-introduce-archunit-testing.md](./ADR-0120-introduce-archunit-testing.md)
- Issue #598

## 决策记录

| 日期 | 决策 | 说明 |
|------|------|------|
| 2026-04-06 | 创建 ADR | 初始版本 |
