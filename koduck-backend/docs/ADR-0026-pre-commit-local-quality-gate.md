# ADR-0026: 引入 pre-commit 本地质量门禁

- Status: Accepted
- Date: 2026-04-02
- Issue: #340

## Context

虽然仓库已有 CI 质量门禁，但本地提交前缺少强制检查，导致问题在 PR 阶段才暴露，反馈周期较长。

## Decision

引入仓库级 Git pre-commit 机制：

1. 使用 `.githooks/pre-commit` 作为统一 hook 入口；
2. 通过 `scripts/install-git-hooks.sh` 设置 `core.hooksPath=.githooks`；
3. 提交前对 staged backend 改动执行 `koduck-backend/scripts/quality-check.sh`；
4. 提供 `make hooks-install` / `make hooks-uninstall` 便捷命令。

## Consequences

正向影响：

- 质量问题前置到本地提交阶段；
- 缩短“开发 -> 发现问题 -> 修复”循环；
- 团队可以共享同一套 hook 行为，降低环境差异。

代价：

- 本地提交耗时上升；
- 对仅修改非 backend 内容的提交需要做跳过策略（本次已按 staged 路径优化）。

## Alternatives Considered

1. 仅依赖 CI，不做本地 hook
   - 拒绝：反馈滞后，开发效率较低。

2. 强制开发者安装第三方 pre-commit 框架
   - 未采用：维护和学习成本更高，本仓库现阶段更适合轻量脚本方案。

## Verification

- `make hooks-install` 可正确设置 `core.hooksPath`；
- `.githooks/pre-commit` 可执行并触发本地质量检查；
- `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
