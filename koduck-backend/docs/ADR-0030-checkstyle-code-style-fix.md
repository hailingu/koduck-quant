# ADR-0030: DTO 代码风格告警修复

- Status: Accepted
- Date: 2026-04-02
- Issue: #348

## Context

执行 `mvn -f koduck-backend/pom.xml -DskipTests checkstyle:check` 时发现 koduck-backend 模块的 DTO 类存在大量代码风格告警：

- **Import 顺序问题**: JDK 导入顺序错误、lombok 导入未与前面分隔
- **Javadoc 缺失**: 类缺少 `@author` 标签、字段缺少 Javadoc 注释、使用无效 `@date` 标签
- **代码格式问题**: 左大括号位置不规范、一行多语句、行长度超过 120 字符

这些告警影响代码可读性和维护性，需要在实施硬性 CI 门禁前完成修复。

## Decision

### 修复范围

修复以下 9 个 DTO 文件的 Checkstyle 告警：

| 文件路径 | 主要问题 |
|---------|---------|
| `dto/settings/UserSettingsDto.java` | Import 顺序、@date 标签、字段 Javadoc |
| `dto/settings/UpdateSettingsRequest.java` | Import 顺序、@date 标签、字段 Javadoc |
| `dto/settings/UpdateNotificationRequest.java` | @author 标签、字段 Javadoc |
| `dto/settings/UpdateThemeRequest.java` | @author 标签 |
| `dto/credential/CredentialDetailResponse.java` | Import 顺序、格式问题、行长度 |
| `dto/credential/CredentialResponse.java` | Import 顺序、格式问题 |
| `dto/credential/UpdateCredentialRequest.java` | Import 顺序、格式问题 |
| `dto/credential/VerifyCredentialResponse.java` | Import 顺序、Javadoc |
| `dto/credential/CreateCredentialRequest.java` | Import 顺序、行长度 |

### 修复规则

1. **Import 顺序**: 
   - 顺序: `java.*` → `javax.*` → 第三方库 → 项目内部
   - 组间空行分隔

2. **Javadoc**: 
   - 类注释添加 `@author` 标签
   - 移除无效的 `@date` 标签
   - 字段添加简洁描述注释（如 `/** 凭证ID. */`）

3. **代码格式**:
   - 左大括号独占一行
   - 每行一条语句
   - 行长度 ≤ 120 字符

### 修复策略

采用手动修复而非自动化工具：
- 告警涉及复杂场景（Builder 模式、嵌套类），手动修复更可靠
- 自动生成 Javadoc 质量差，手动编写可确保文档价值
- 边修复边验证，避免引入新问题

## Consequences

### 正向影响

- 主代码 Checkstyle 零告警通过
- 代码可读性和维护性提升
- 为实施硬性 CI 门禁扫清障碍

### 消极影响

- 修复耗时约 1-2 小时
- 需要仔细验证不破坏功能

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释 |
| API 接口 | 无 | DTO 字段和类型保持不变 |
| 序列化 | 无 | 未修改字段名和注解 |
| 测试 | 无 | 测试用例无需修改 |

## Related

- Issue #348
- ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范
