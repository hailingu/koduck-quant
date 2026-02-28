# Contributing

## 开发分支模型（main-dev-feature）

本仓库严格遵循 `main-dev-feature` 三分支结构。

### 分支职责

- `main`：生产稳定分支，只接收来自 `dev` 的合并，不直接开发。
- `dev`：日常集成分支，所有功能分支合并到 `dev`，验证通过后再合并到 `main`。
- `feature/*`：功能分支，只能从 `dev` 创建，并且只能合并回 `dev`。
- `bugfix/*`：缺陷修复分支，只能从 `dev` 创建，并且只能合并回 `dev`。

### 分支流转规则

- 创建功能分支：`git checkout dev && git pull origin dev && git checkout -b feature/<name>`
- 创建修复分支：`git checkout dev && git pull origin dev && git checkout -b bugfix/<name>`
- 完成功能或修复后：提交到 `feature/*` 或 `bugfix/*`，发起合并到 `dev`
- 发布时：由 `dev` 合并到 `main`

### 强制要求

- 禁止直接向 `main` 提交
- 禁止将 `feature/*` 或 `bugfix/*` 直接合并到 `main`
- 每次开发任务对应一个 `feature/*` 或 `bugfix/*` 分支
- `feature/*` 与 `bugfix/*` 合并进 `dev` 后自动删除分支（由 GitHub Actions 执行）
