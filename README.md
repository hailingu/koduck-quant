# KODUCK-QUANT

![KODUCK-QUANT Logo](.github/logo.png)

KODUCK-QUANT 是一个面向研究、回测与交易执行的一体化量化软件系统（当前处于项目初始化阶段）。

## 项目状态

- 当前状态：`Planning / Bootstrap`
- 代码状态：尚未开始业务代码开发
- 当前重点：规范开发流程、协作机制与工程基础设施

## 目标能力（规划中）

- 因子研究与策略原型验证
- 回测引擎与绩效分析
- 风控模块与交易约束
- 交易执行与数据管道集成
- 可复现的实验与版本化管理

## 当前仓库内容

- 流程与贡献规范：`CONTRIBUTING.md`
- GitHub 协作配置：`.github/`
- 记忆与上下文管理目录：`memory/`

## 快速开始（当前阶段）

由于项目尚无业务代码，当前建议按以下方式参与：

1. 阅读贡献规范：[CONTRIBUTING.md](./CONTRIBUTING.md)
2. 按分支模型从 `dev` 创建 `feature/*` 或 `bugfix/*`
3. 通过 Pull Request 合并到 `dev`

## 分支模型与自动化

本仓库遵循 `main -> dev -> feature/bugfix`：

- `main`：稳定发布分支，仅接收 `dev` 合并
- `dev`：日常集成分支
- `feature/*`：功能开发分支（从 `dev` 拉出，合回 `dev`）
- `bugfix/*`：缺陷修复分支（从 `dev` 拉出，合回 `dev`）

已启用 GitHub Actions：

- `Branch Flow Guard`：限制 PR 流向为 `feature/*|bugfix/* -> dev` 与 `dev -> main`
- `Delete Merged Feature Branch`：`feature/*|bugfix/*` 合并进 `dev` 后自动删除源分支
- `Commit Flow Guard`：校验 PR 标题与 commit message 是否符合 Conventional Commits
- `Create and Push Tag`：手动触发标准化打 tag 流程
- `Release on Tag`：推送 `v*` tag 后自动创建 GitHub Release

## 标准提交流程（add -> commit -> push）

```bash
git add .
git commit -m "feat(scope): your change summary"
git push -u origin feature/<name>
```

提交信息建议遵循 Conventional Commits：

- `feat(scope): ...`
- `fix(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

## 标准打标签流程（tag）

在 GitHub 页面触发 Actions：

1. 打开 `Actions -> Create and Push Tag`
2. 点击 `Run workflow`
3. 输入参数：
   - `tag`：例如 `v0.1.0`
   - `target`：默认 `main`
   - `message`：可选，留空会自动使用 `Release <tag>`

注意：Tag 名称需符合 `vX.Y.Z`（支持预发布后缀，如 `v1.2.3-rc.1`）。

额外校验：仅允许在 `main` 的最新提交（HEAD）上打 tag；不满足时，`Create and Push Tag` 与 `Release on Tag` 都会失败。

## 贡献

欢迎通过 Issue 与 PR 参与建设。请在提交前确保：

- 变更目标明确且范围聚焦
- 文档同步更新（如流程、约定、设计）
- 遵循仓库分支与 PR 规则

## Roadmap（初版）

- [ ] 明确系统架构与模块边界
- [ ] 建立基础工程骨架（数据/回测/执行）
- [ ] 引入测试与质量基线
- [ ] 提供最小可运行示例策略

## License

本项目采用 [LICENSE](./LICENSE) 中声明的许可协议。
