# 发布检查清单

本文档定义 koduck-quant 项目的发布流程和检查项，确保每次发布都可控、可验证、可回滚。

---

## 📋 目录

1. [发布流程概览](#发布流程概览)
2. [发布前检查清单](#发布前检查清单)
3. [发布执行步骤](#发布执行步骤)
4. [发布后验证清单](#发布后验证清单)
5. [紧急回滚触发条件](#紧急回滚触发条件)

---

## 发布流程概览

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  发布前检查  │ -> │  执行发布   │ -> │  发布后验证  │ -> │  监控观察   │
│ (Pre-check) │    │  (Deploy)   │    │ (Post-check)│    │ (Monitor)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       v                  v                  v                  v
   [不通过]           [失败]             [失败]            [异常]
       │                  │                  │                  │
       v                  v                  v                  v
   阻塞发布          触发回滚          触发回滚          触发回滚
```

---

## 发布前检查清单

### 1. 代码质量检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 单元测试通过 | `mvn test -q` | 无失败测试 |
| 集成测试通过 | `mvn test -P with-integration-tests -q` | 无失败测试 |
| 代码覆盖率达标 | JaCoCo 报告 | ≥ 60%（当前门禁） |
| 静态代码检查 | `mvn pmd:check` | 无违规 |
| 安全漏洞扫描 | SpotBugs | 无高危漏洞 |

**执行命令**:
```bash
cd koduck-backend
mvn clean test pmd:check spotbugs:check
```

### 2. 版本与标签检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 版本号已更新 | 检查 `pom.xml`, `package.json` | 版本号正确递增 |
| Git 标签已创建 | `git tag | grep v` | 存在新版本标签 |
| 变更日志已更新 | 检查 `.CHANGELOG.md` | 包含本次发布说明 |
| 无未提交更改 | `git status` | 工作区干净 |

### 3. 配置与环境检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 配置文件已更新 | 检查 `application-prod.yml` | 配置正确 |
| 环境变量已配置 | 检查部署环境 | 必需变量已设置 |
| 数据库迁移脚本就绪 | 检查 `src/main/resources/db/migration/` | 脚本已准备 |
| 外部依赖可用 | 手动检查 | 第三方服务正常 |

### 4. 文档与通知检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| API 文档已更新 | 检查 Swagger/OpenAPI | 文档与代码一致 |
| 发布说明已准备 | 检查 Release Note | 包含变更摘要 |
| 相关团队已通知 | 邮件/群消息 | 干系人已知悉 |
| 发布窗口已确认 | 确认无冲突 | 业务低峰期 |

---

## 发布执行步骤

### 步骤 1: 准备发布分支

```bash
# 1.1 切换到 main 分支并更新
git checkout main
git pull origin main

# 1.2 合并 dev 分支（如需要）
git merge dev --no-ff -m "release: prepare for vX.Y.Z"

# 1.3 更新版本号（如需要）
# 更新 pom.xml, package.json 等
```

### 步骤 2: 创建发布标签

```bash
# 2.1 创建标签
git tag -a v1.2.3 -m "Release v1.2.3

主要变更:
- 功能 A
- 功能 B
- 修复 C"

# 2.2 推送标签
git push origin v1.2.3
```

### 步骤 3: 构建与部署

#### Docker 部署（推荐）

```bash
# 3.1 构建镜像
make build

# 3.2 备份当前运行版本
docker tag koduck-backend:latest koduck-backend:backup-$(date +%Y%m%d)

# 3.3 启动新版本
make prod-up
```

#### 手动部署

```bash
# 3.1 构建后端
cd koduck-backend
mvn clean package -DskipTests

# 3.2 备份当前 JAR
cp /app/koduck-backend.jar /app/backup/koduck-backend-$(date +%Y%m%d).jar

# 3.3 部署新 JAR
cp target/koduck-backend-*.jar /app/koduck-backend.jar

# 3.4 重启服务
systemctl restart koduck-backend
```

### 步骤 4: 数据库迁移（如需要）

```bash
# 使用 Flyway 执行迁移
cd koduck-backend
mvn flyway:migrate

# 或手动执行 SQL 脚本
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migration/V1.2.3__description.sql
```

---

## 发布后验证清单

### 1. 服务健康检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 服务启动成功 | `docker ps` / `systemctl status` | 状态为 Up/Active |
| 健康检查通过 | `GET /actuator/health` | 返回 `{"status":"UP"}` |
| 端口监听正常 | `netstat -tlnp` | 端口在监听 |
| 日志无异常 | `tail -f /var/log/koduck/app.log` | 无 ERROR |

**执行命令**:
```bash
# 健康检查
curl -s http://localhost:8080/actuator/health | jq .

# 查看日志
docker logs koduck-backend --tail 100
```

### 2. 功能验证检查 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 核心 API 可用 | `GET /api/v1/market/health` | 返回 200 |
| 数据库连接正常 | 执行查询测试 | 返回结果正常 |
| 缓存服务正常 | Redis 连接测试 | 读写正常 |
| 外部服务连通 | 调用第三方 API | 返回正常 |

**执行命令**:
```bash
# API 测试
curl -s http://localhost:8080/api/v1/market/health | jq .

# 数据库测试
curl -s http://localhost:8080/api/v1/market/realtime/000001.SZ | jq .
```

### 3. 业务功能验证 ✅

| 检查项 | 检查方法 | 通过标准 |
|--------|----------|----------|
| 用户登录 | 登录页面测试 | 登录成功 |
| 核心业务流程 | 端到端测试 | 流程完成 |
| 数据一致性 | 数据核对 | 数据正确 |

### 4. 监控指标检查 ✅

| 指标 | 检查方法 | 正常范围 |
|------|----------|----------|
| CPU 使用率 | 监控面板 | < 70% |
| 内存使用率 | 监控面板 | < 80% |
| 响应时间 P99 | APM 工具 | < 500ms |
| 错误率 | 日志/监控 | < 0.1% |

---

## 紧急回滚触发条件

当以下情况发生时，**立即触发回滚**:

### 🚨 立即回滚条件

| 条件 | 判断方法 | 示例 |
|------|----------|------|
| 服务无法启动 | 健康检查失败 | 连续 3 次健康检查失败 |
| 核心功能不可用 | API 测试失败 | 登录、交易等核心接口 500 |
| 严重性能退化 | 响应时间/错误率 | P99 > 5s 或错误率 > 5% |
| 数据损坏/丢失 | 数据校验失败 | 数据不一致、关键数据缺失 |
| 安全漏洞暴露 | 安全扫描/告警 | 高危漏洞被利用 |

### ⚠️ 考虑回滚条件

| 条件 | 判断方法 | 决策时间 |
|------|----------|----------|
| 非核心功能异常 | 功能测试失败 | 30 分钟内 |
| 性能轻微下降 | 响应时间增加 | 1 小时内 |
| 用户体验问题 | 用户反馈 | 2 小时内 |

---

## 发布记录模板

每次发布完成后，请填写以下记录:

```markdown
## 发布记录: vX.Y.Z

- **发布时间**: YYYY-MM-DD HH:mm
- **发布人员**: @username
- **发布版本**: vX.Y.Z
- **代码分支**: main (commit: abc123)

### 发布内容

- 功能 A
- 功能 B
- 修复 C

### 检查结果

- [x] 发布前检查通过
- [x] 发布执行成功
- [x] 发布后验证通过
- [x] 监控正常

### 遇到的问题

- 问题 1: 描述（已解决/待跟进）

### 回滚准备

- 回滚版本: vX.Y.Z-1
- 回滚命令: `make rollback VERSION=vX.Y.Z-1`
```

---

## 相关文档

- [回滚 Runbook](./rollback-runbook.md)
- [发布历史](./releases/)
- [监控告警配置](./monitoring.md)
