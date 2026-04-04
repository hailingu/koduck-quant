# ADR-0084: 清理 koduck-backend/src 残留空目录

- Status: Accepted
- Date: 2026-04-04
- Issue: #462

## Context

在 ADR-0082（Maven 多模块重构）完成后，检查发现 koduck-backend/src 目录下存在残留的空目录结构：

- `src/main/java/com/koduck/identity/` - 空目录
- `src/main/java/com/koduck/community/` - 空目录
- `src/main/java/com/koduck/trading/` - 空目录
- `src/test/java/com/koduck/mocks/` - 空目录

这些空目录是代码迁移到 koduck-core 模块后遗留的，不包含任何源文件。

## Decision

### 1. 清理范围

删除 koduck-backend/src 目录及其所有残留子目录。

### 2. 清理结果

经检查，在多模块重构过程中，koduck-backend/src 目录已被清理，当前目录结构为：

```
koduck-backend/
├── koduck-bom/           # BOM 模块
├── koduck-core/          # 核心模块（含 src）
├── koduck-bootstrap/     # 启动模块（含 src）
├── docs/                 # 文档
├── scripts/              # 脚本
└── pom.xml               # 父 POM
```

## Consequences

### 正向影响

- **代码库整洁**：彻底清理重构残留的空目录
- **结构清晰**：多模块结构更加清晰，无冗余目录

### 兼容性影响

- **无代码变更**：仅删除空目录
- **无功能影响**：不影响任何业务逻辑

## Verification

- [x] koduck-backend/src 目录已不存在
- [x] 所有代码已正确迁移到 koduck-core/src
- [x] `mvn clean compile` 编译通过
