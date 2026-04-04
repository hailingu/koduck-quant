# ADR-0085: 本地 koduck-backend/src 残留空目录清理

- Status: Accepted
- Date: 2026-04-04
- Issue: #464

## Context

在 ADR-0082（Maven 多模块重构）完成后，发现本地 koduck-backend/src 目录仍残留空目录结构：

```
koduck-backend/src/
├── main/java/com/koduck/
│   ├── community/     # 空目录
│   ├── identity/      # 空目录
│   └── trading/       # 空目录
└── test/              # 空目录结构
```

这些目录不在 git 版本控制中（空目录不会被 git 跟踪），因此 `git pull` 不会自动删除它们。

## Decision

### 1. 本地清理

直接删除 koduck-backend/src 目录：

```bash
rm -rf koduck-backend/src
```

### 2. 原因

- 这些目录是多模块重构前的残留
- 它们不被 git 跟踪，因此 pull 不会清理
- 需要手动删除本地文件系统上的空目录

## Consequences

### 正向影响

- **本地环境整洁**：删除残留的空目录
- **避免 IDE 混淆**：IDE 不会显示无用的目录结构

## Verification

- [x] koduck-backend/src 目录已删除
- [x] `mvn clean compile` 编译通过
- [x] 远程仓库无此目录
