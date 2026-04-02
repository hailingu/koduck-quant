# ADR-0002: Checkstyle 代码风格告警修复策略

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-02
- **作者**: @hailingu
- **相关**: #348

---

## 背景与问题陈述

koduck-backend 模块执行 `mvn checkstyle:check` 时产生大量代码风格告警，包括：
- Import 顺序不规范（ImportOrder）
- Javadoc 注释缺失（JavadocVariable, JavadocType）
- 代码格式问题（LeftCurly, OneStatementPerLine, LineLength）

这些告警影响代码可读性和维护性，需要在 CI 门禁实施前完成修复。

---

## 决策驱动因素

1. **代码一致性**: 统一代码风格，提升可读性
2. **CI 门禁准备**: 为后续 checkstyle 硬性门禁扫清障碍
3. **维护成本**: 早期修复成本低于后期批量处理
4. **兼容性**: 确保修复不改变业务逻辑

---

## 考虑的选项

### 选项 1: 手动修复（选定）

**描述**: 逐文件分析告警，手动调整 import 顺序、添加 Javadoc、修复格式

**优点**:
- 精确控制每处修改
- 可同步优化注释质量（不仅是占位符）
- 避免自动工具误改

**缺点**:
- 工作量大（涉及 10+ 文件，200+ 处告警）
- 耗时较长

### 选项 2: 自动格式化工具

**描述**: 使用 spotless 或 checkstyle fix 插件自动修复

**优点**:
- 快速批量处理
- 减少人工错误

**缺点**:
- 无法处理 Javadoc 内容生成
- 可能需要额外配置
- 对复杂格式问题处理不佳

---

## 决策结果

**选定的方案**: 选项 1 - 手动修复

**理由**:

1. **精确性**: 告警涉及复杂场景（如嵌套类、Builder 模式），手动修复更可靠
2. **注释质量**: 自动生成 Javadoc 质量差，手动编写可确保文档价值
3. **可控性**: 可边修复边验证，避免引入新问题

**积极后果**:

- 代码风格完全符合规范
- 文档质量提升
- CI checkstyle 检查零告警

**消极后果**:

- 修复耗时（预计 1-2 小时）
- 需要仔细验证不破坏功能

**缓解措施**:

- 修复后执行完整测试套件验证
- 分批次提交便于审查

---

## 修复范围与策略

### 修复文件清单

| 文件路径 | 主要问题 |
|---------|---------|
| `dto/settings/UserSettingsDto.java` | Import 顺序、Javadoc、@date 标签 |
| `dto/settings/UpdateNotificationRequest.java` | @author 标签、字段 Javadoc |
| `dto/settings/UpdateSettingsRequest.java` | Import 顺序、Javadoc、@date 标签 |
| `dto/settings/UpdateThemeRequest.java` | @author 标签 |
| `dto/credential/CredentialDetailResponse.java` | Import 顺序、格式问题、行长度 |
| `dto/credential/VerifyCredentialResponse.java` | Import 顺序、Javadoc |
| `dto/credential/UpdateCredentialRequest.java` | Import 顺序、格式问题 |
| `dto/credential/CredentialResponse.java` | Import 顺序、格式问题 |
| `dto/credential/CreateCredentialRequest.java` | Import 顺序、行长度 |

### 修复规则

1. **Import 顺序**: 遵循 `java.*` → `javax.*` → 第三方库 → 项目内部，组间空行分隔
2. **Javadoc**: 
   - 类注释添加 `@author`
   - 移除无效的 `@date` 标签
   - 字段添加简洁描述注释
3. **格式问题**:
   - 左大括号独占一行
   - 每行一条语句
   - 行长度 ≤ 120 字符

---

## 兼容性影响

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释，不改变代码行为 |
| API 接口 | 无 | DTO 字段和类型保持不变 |
| 序列化 | 无 | 未修改字段名和注解 |
| 测试 | 无 | 测试用例无需修改 |

---

## 实施计划

- [x] 创建修复分支 `feature/fix-checkstyle-warnings`
- [x] 按目录分批修复 DTO 文件
- [x] 本地执行 `mvn checkstyle:check` 验证
- [x] 运行单元测试确保功能正常
- [x] 提交 PR 到 dev 分支
- [x] 合并后删除分支

---

## 相关文档

- [Checkstyle 配置](../../koduck-backend/config/checkstyle/checkstyle.xml)
- [Java 编码规范](../../.github/java-standards/)
- Issue #348

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-02 | 初始版本 | @hailingu |
