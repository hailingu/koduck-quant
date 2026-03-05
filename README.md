# KODUCK-QUANT

![KODUCK-QUANT Logo](.github/logo.png)

KODUCK-QUANT 是一个面向研究、回测与交易执行的一体化量化软件系统。

## 项目状态

- 当前状态：`Alpha Development`
- 代码状态：核心功能开发中
- 当前重点：后端 API 开发、前端界面、Docker 部署支持

## 技术栈

| 领域 | 技术 |
|------|------|
| **后端** | Java 23 + Spring Boot 3.4.2 + PostgreSQL + Redis |
| **数据服务** | Python 3.11 + FastAPI + AKShare |
| **前端** | React 19 + TypeScript + Vite 5 + Tailwind CSS |
| **部署** | Docker + Docker Compose |

## 快速开始（Docker 部署）

### 环境要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 4GB 可用内存

### 一键启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd koduck-quant

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，修改 JWT_SECRET 等敏感配置

# 3. 启动完整系统
docker-compose up -d
# 或使用脚本
./scripts/docker-start.sh
```


- **前端界面**: http://localhost:3000

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 使用 Makefile
make up      # 启动
make down    # 停止
make logs    # 查看日志
make ps      # 查看状态
```

更多 Docker 使用说明请参考 [DOCKER.md](./DOCKER.md)。

## 本地开发

如果不使用 Docker，可以本地启动各个服务：

```bash
# 1. 启动数据库和缓存
docker-compose up -d postgresql redis

# 2. 启动数据服务
cd koduck-data-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. 启动后端（另一个终端）
cd koduck-backend
./mvnw spring-boot:run

# 4. 启动前端（另一个终端）
cd koduck-frontend
npm install
npm run dev
```

## 测试命令约定

为避免在未启动 Docker 环境时误跑依赖 Testcontainers 的集成测试，后端采用以下约定：

```bash
# 默认：仅运行单元测试与轻量测试（已排除 *IntegrationTest）
mvn -f koduck-backend/pom.xml test

# 显式开启：包含 Docker 依赖的集成测试
mvn -f koduck-backend/pom.xml -Pwith-integration-tests test
```

建议：

- 本地日常开发使用默认命令；
- 只有在 Docker 可用（Docker Desktop/Engine 已启动）时再使用 `with-integration-tests` profile。

## 已实现功能

- [x] 用户认证（JWT）
- [x] K 线数据管理
- [x] 自选股管理
- [x] 投资组合管理
- [x] 技术指标计算（MA/EMA/MACD/RSI/BOLL）
- [x] 回测引擎
- [x] 策略管理
- [x] Docker 部署支持

## 目标能力（规划中）

- [ ] 因子研究与策略原型验证
- [ ] 回测引擎与绩效分析
- [ ] 风控模块与交易约束
- [ ] 交易执行与数据管道集成
- [ ] 可复现的实验与版本化管理

## 分支模型与自动化

本仓库遵循 `main -> dev -> feature/bugfix`：

- `main`：稳定发布分支，仅接收 `dev` 合并
- `dev`：日常集成分支
- `feature/*`：功能开发分支（从 `dev` 拉出，合回 `dev`）
- `bugfix/*`：缺陷修复分支（从 `dev` 拉出，合回 `dev`）

已启用 GitHub Actions：

- `Branch Flow Guard`：限制 PR 流向
- `Delete Merged Feature Branch`：自动删除已合并分支
- `Commit Flow Guard`：校验 Commit message 格式
- `Create and Push Tag`：标准化打 tag
- `Release on Tag`：自动创建 GitHub Release

详细贡献规范请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 标准提交流程

```bash
git add .
git commit -m "feat(scope): your change summary"
git push -u origin feature/<name>
```

提交信息遵循 Conventional Commits：

- `feat(scope): ...`
- `fix(scope): ...`
- `docs(scope): ...`
- `chore(scope): ...`

## License

本项目采用 [LICENSE](./LICENSE) 中声明的许可协议。
