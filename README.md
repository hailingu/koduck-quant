# KODUCK-QUANT

![KODUCK-QUANT Logo](.github/logo.png)

KODUCK-QUANT 是一个面向研究、回测与交易执行的一体化量化软件系统。

## 项目状态

- 当前阶段：`Planning / Bootstrap`
- 业务代码：尚未开始规模化开发
- 当前重点：工程规范、协作流程、Agent/Skills 体系、CI 约束

> 说明：本仓库当前以“工程基础设施与协作规范建设”为主，而非完整业务功能交付。

## 目标能力（规划中）

- 因子研究与策略原型验证
- 回测引擎与绩效分析
- 风控模块与交易约束
- 交易执行与数据管道集成
- 可复现的实验与版本化管理

## 仓库现状

当前仓库已具备以下基础内容：

- 流程与贡献规范（`CONTRIBUTING.md`）
- GitHub 协作与自动化流程（`.github/`）
- 记忆与上下文管理目录（`memory/`）
- AI Agent Skills 目录（`.agents/skills/`）
- 多模块目录占位与演进中的工程结构（如 `koduck-backend/`、`koduck-frontend/`、`koduck-data-service/`）

## 技术方向（规划）

### 后端服务

- Java 23+
- Spring Boot 3.x
- Maven / Gradle
- Spring Data JPA / MyBatis
- PostgreSQL、Redis、RabbitMQ / Kafka（规划）

### 数据分析

- Python 3.12+
- NumPy、Pandas、Polars
- scikit-learn（规划）
- matplotlib、plotly

## 分支模型与协作流程

仓库遵循 `main-dev-feature` 三分支模型：

- `main`：生产稳定分支，仅接收 `dev` 合并
- `dev`：日常集成分支
- `feature/*`：从 `dev` 创建并合并回 `dev`
- `bugfix/*`：从 `dev` 创建并合并回 `dev`

强制规则：

- 禁止直接向 `main` 提交
- 禁止将 `feature/*` 或 `bugfix/*` 直接合并到 `main`
- 每个任务使用独立分支
- 合并到 `dev` 的 `feature/*` 与 `bugfix/*` 分支会被自动删除

## GitHub Actions（已启用）

- `Branch Flow Guard`：校验 PR 流向合法性
- `Commit Flow Guard`：校验 PR 标题与 commit message 规范
- `Delete Merged Feature Branch`：自动清理已合并分支
- `Create and Push Tag`：标准化打 tag（仅允许 `main` HEAD）
- `Release on Tag`：推送 `v*` tag 后自动创建 Release

## Commit 规范

使用 Conventional Commits：

```text
<type>(<scope>): <subject>
```

常用类型：

- `feat`：新功能
- `fix`：缺陷修复
- `docs`：文档变更
- `refactor`：重构
- `test`：测试
- `chore` / `ci` / `build`：工程与流程类变更

详细模板参考 [`.gitmessage.txt`](./.gitmessage.txt)。

## 快速开始（Kubernetes）

当前仓库只保留 Kubernetes 部署路径，统一使用 `k8s/` 下的脚本与清单，不再使用 Docker Compose。

```bash
# 1) 准备 K8s 环境变量
cp k8s/.env.template k8s/.env.dev

# 2) 构建需要的本地 dev 镜像（示例：koduck-auth）
docker build -t koduck-auth:dev ./koduck-auth

# 3) 部署 dev 环境
./k8s/deploy.sh dev install

# 4) 查看状态
./k8s/deploy.sh dev status
```

如果只更新单个服务，推荐先构建对应 `*:dev` 镜像，再执行对应 Deployment 的 `rollout restart`。

## 协作开发

```bash
# 1) 切到 dev 并同步
git checkout dev && git pull origin dev

# 2) 创建功能分支（推荐使用 worktree）
git worktree add ../worktree-feature -b feature/<name>

# 3) 开发并提交
cd ../worktree-feature
git add .
git commit -m "feat(scope): your change summary"
git push -u origin feature/<name>

# 4) 发起 PR: feature/<name> -> dev
```

更多流程说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 重要目录索引

- [README.md](./README.md)：项目说明与入口文档
- [CONTRIBUTING.md](./CONTRIBUTING.md)：分支模型与协作流程
- [.gitmessage.txt](./.gitmessage.txt)：Commit message 模板
- [.github/](./.github/)：Actions、模板与规范配置
- [.agents/skills/](./.agents/skills/)：本地技能体系
- [memory/](./memory/)：分层记忆与上下文沉淀

## 说明

如果你准备开始具体模块开发（Java 后端 / Python 分析），建议先在 `dev` 基于对应 `feature/*` 分支建立最小可运行骨架，并同步补齐模块级 README 与测试约定。

## License

本项目采用 [LICENSE](./LICENSE) 中声明的许可协议。
