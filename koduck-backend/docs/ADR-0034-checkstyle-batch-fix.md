# ADR-0034: Batch Fix Checkstyle Warnings

- Status: Accepted
- Date: 2026-04-02
- Issue: #358

## Context

执行 `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 时发现 koduck-backend 模块存在大量代码风格告警（5301 个）：

- **ImportOrder**: JDK import 顺序错误、lombok 导入未与前面分隔
- **LeftCurly**: 左大括号位置不规范（当前独占一行，应位于行尾）
- **JavadocVariable/JavadocType**: 字段和类型缺少 Javadoc 注释
- **MagicNumber**: 魔法数字未提取为常量
- **Indentation**: 测试文件缩进不规范

## Decision

### 修复范围

批量修复剩余所有 Checkstyle 告警，主要包括：

| 文件类别 | 主要问题 |
|---------|---------|
| `dto/**/*.java` | Import 顺序、LeftCurly、Javadoc |
| `entity/**/*.java` | Javadoc、LeftCurly |
| `service/**/*.java` | Import 顺序、MagicNumber |
| `test/**/*.java` | Indentation、Import 顺序、MagicNumber |

### 修复策略

采用自动化脚本 + 人工复核的方式：

1. **LeftCurly 修复**: 使用正则表达式将 `\n{` 改为 ` {`
2. **Import 排序**: 按 checkstyle 规则重新排序（java→javax→org→com.fasterxml→com）
3. **Javadoc 生成**: 为缺失的字段添加简洁的 Javadoc 注释
4. **MagicNumber**: 提取常用魔法数字为常量

### 规则详情

**Import 顺序规则**:
```
java.*
javax.*
org.*
com.fasterxml.*
com.*
```
组间必须有空行分隔。

**LeftCurly 规则**:
- 类/方法/控制语句的 `{` 应位于行尾（EOL 风格）
- 而非独占一行

## Consequences

### 正向影响

- Checkstyle 告警清零
- 代码风格统一，符合 Alibaba 规范
- 为实施硬性 CI 门禁扫清障碍

### 消极影响

- 文件改动量大，可能影响代码审查
- 需要确保修复不破坏功能

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| 业务逻辑 | 无 | 仅修改格式和注释 |
| API 接口 | 无 | 字段和类型保持不变 |
| 序列化 | 无 | 未修改字段名和注解 |
| 测试 | 无 | 仅修复格式，不修改逻辑 |

## Related

- Issue #358
- ADR-0030: DTO 代码风格告警修复
- ADR-0031: 测试代码 Checkstyle 修复
