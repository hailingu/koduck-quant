# 回滚 Runbook

本文档定义 koduck-quant 项目的回滚流程，确保在发布失败时能够快速、安全地恢复到上一个稳定版本。

---

## 📋 目录

1. [回滚触发条件](#回滚触发条件)
2. [回滚前评估](#回滚前评估)
3. [回滚步骤](#回滚步骤)
4. [回滚验证](#回滚验证)
5. [回滚后事项](#回滚后事项)

---

## 回滚触发条件

### 🚨 立即回滚（P0 - 灾难级）

出现以下情况时，**立即执行回滚**，无需等待审批：

| 条件 | 判断标准 | 典型症状 |
|------|----------|----------|
| 服务完全不可用 | 健康检查连续失败 | 503/502 错误、连接超时 |
| 数据损坏或丢失 | 数据校验失败 | 关键数据缺失、数据不一致 |
| 严重安全漏洞 | 安全告警 | 未授权访问、数据泄露 |
| 核心业务流程中断 | 关键 API 100% 失败 | 无法登录、无法交易 |
| 级联故障 | 依赖服务大面积故障 | 雪崩效应 |

**决策时间**: < 5 分钟

### ⚠️ 快速回滚（P1 - 严重级）

出现以下情况时，**15 分钟内决策**是否回滚：

| 条件 | 判断标准 | 典型症状 |
|------|----------|----------|
| 性能严重退化 | P99 延迟 > 5s 或错误率 > 5% | 用户明显感知卡顿 |
| 非核心功能大面积失败 | > 30% 的非核心 API 失败 | 次要功能不可用 |
| 数据不一致 | 业务数据逻辑错误 | 显示数据与预期不符 |
| 资源耗尽 | CPU/内存 > 90% | 系统负载过高 |

**决策时间**: < 15 分钟

### 💡 评估后回滚（P2 - 一般级）

出现以下情况时，**评估后决定是否回滚**：

| 条件 | 判断标准 | 决策因素 |
|------|----------|----------|
| 轻微性能下降 | P99 延迟 1-5s | 是否有快速修复方案 |
| 用户体验问题 | 界面显示异常 | 影响范围、修复时间 |
| 配置错误 | 非关键配置项错误 | 是否可以热修复 |

**决策时间**: < 1 小时

---

## 回滚前评估

### 评估清单

在执行回滚前，快速评估以下事项：

| 评估项 | 问题 | 影响 |
|--------|------|------|
| 数据变更 | 新版本是否有数据库迁移？ | 可能需要回滚数据 |
| 数据兼容性 | 旧版本是否能读取新数据格式？ | 可能影响数据一致性 |
| 外部依赖 | 是否有外部系统已适配新版本？ | 可能影响集成 |
| 用户会话 | 回滚是否会导致用户登出？ | 用户体验影响 |

### 数据变更评估

```
检查数据库迁移:
1. 查看迁移脚本: ls koduck-backend/src/main/resources/db/migration/
2. 确认是否有 DML/DDL 变更
3. 如果有数据变更，需要准备数据回滚脚本
```

**数据回滚策略**:

| 变更类型 | 回滚策略 | 复杂度 |
|----------|----------|--------|
| 新增表/字段 | 保留，旧版本忽略 | 低 |
| 修改字段类型 | 需要双写兼容或数据转换 | 高 |
| 删除表/字段 | 备份恢复 | 高 |
| 数据迁移 | 反向迁移脚本 | 高 |

---

## 回滚步骤

### 快速回滚命令

```bash
# Docker 部署回滚（推荐）
make rollback VERSION=v1.2.2

# 或手动指定镜像
docker-compose pull koduck-backend:v1.2.2
docker-compose up -d koduck-backend
```

### 详细回滚流程

#### 步骤 1: 确认回滚版本

```bash
# 1.1 查看可用版本
git tag -l "v*" | sort -V | tail -10

# 1.2 确认回滚目标版本（上一个稳定版本）
ROLLBACK_VERSION="v1.2.2"

# 1.3 记录当前版本
CURRENT_VERSION="v1.2.3"

echo "准备从 $CURRENT_VERSION 回滚到 $ROLLBACK_VERSION"
```

#### 步骤 2: 通知相关人员

```bash
# 2.1 发送回滚通知（根据实际情况修改）
echo "🚨 启动回滚流程
- 服务: koduck-quant
- 从版本: $CURRENT_VERSION
- 回滚到: $ROLLBACK_VERSION
- 原因: [填写回滚原因]
- 操作人: $(whoami)
- 时间: $(date)
" | tee /tmp/rollback-notification.txt

# 2.2 发送通知（示例：发送到 Slack/企业微信）
# curl -X POST $WEBHOOK_URL -d @/tmp/rollback-notification.txt
```

#### 步骤 3: 执行回滚

**Docker 部署**:

```bash
# 3.1 停止当前服务
docker-compose down koduck-backend

# 3.2 切换到回滚版本
git checkout $ROLLBACK_VERSION

# 3.3 构建回滚版本镜像
docker-compose build koduck-backend

# 3.4 启动回滚版本
docker-compose up -d koduck-backend

# 3.5 检查服务状态
docker-compose ps koduck-backend
docker logs koduck-backend --tail 50
```

**JAR 部署**:

```bash
# 3.1 停止当前服务
systemctl stop koduck-backend

# 3.2 备份当前版本（如需要调查问题）
cp /app/koduck-backend.jar /app/failed-versions/koduck-backend-$CURRENT_VERSION-$(date +%Y%m%d-%H%M).jar

# 3.3 恢复回滚版本
# 方法 A: 从备份恢复
cp /app/backup/koduck-backend-$ROLLBACK_VERSION.jar /app/koduck-backend.jar

# 方法 B: 从 Git 构建
git checkout $ROLLBACK_VERSION
cd koduck-backend
mvn clean package -DskipTests
cp target/koduck-backend-*.jar /app/koduck-backend.jar

# 3.4 启动服务
systemctl start koduck-backend

# 3.5 检查状态
systemctl status koduck-backend
tail -f /var/log/koduck/app.log
```

#### 步骤 4: 数据库回滚（如需要）

```bash
# 4.1 检查数据库版本
# 查看当前 Flyway 版本
cd koduck-backend
mvn flyway:info

# 4.2 如果有不兼容的数据变更，执行回滚脚本
# 注意：数据回滚需要谨慎，建议先备份

# 4.3 执行数据回滚脚本（如有）
mysql -u$user -p$pass $database < rollback-scripts/rollback-v1.2.3.sql
```

**数据回滚原则**:
- 新增的数据保留，旧版本忽略即可
- 修改的数据需要反向操作恢复
- 删除的数据从备份恢复

#### 步骤 5: 配置回滚（如需要）

```bash
# 5.1 恢复配置文件（如有变更）
cp /app/config/application-prod.yml.backup /app/config/application-prod.yml

# 5.2 重启服务以加载配置
systemctl restart koduck-backend
```

---

## 回滚验证

### 验证清单

#### 1. 服务状态验证 ✅

```bash
# 1.1 健康检查
curl -s http://localhost:8080/actuator/health | jq .

# 期望输出:
# {
#   "status": "UP",
#   "components": {
#     "db": { "status": "UP" },
#     "redis": { "status": "UP" }
#   }
# }

# 1.2 服务版本确认
curl -s http://localhost:8080/actuator/info | jq '.build.version'

# 期望输出回滚版本号
```

#### 2. 核心功能验证 ✅

```bash
# 2.1 API 可用性测试
curl -s http://localhost:8080/api/v1/market/health

# 2.2 数据库连接测试
curl -s http://localhost:8080/api/v1/market/realtime/000001.SZ | jq '.symbol'

# 2.3 登录功能测试（如有认证）
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

#### 3. 数据一致性验证 ✅

```bash
# 3.1 关键数据校验
# 根据业务场景编写校验 SQL/脚本

# 3.2 数据量检查
# 确保回滚后数据量正常
```

#### 4. 性能验证 ✅

```bash
# 4.1 响应时间测试
time curl -s http://localhost:8080/api/v1/market/health

# 4.2 负载测试（如需要）
# ab -n 1000 -c 10 http://localhost:8080/api/v1/market/health
```

### 验证通过标准

| 检查项 | 通过标准 | 检查方式 |
|--------|----------|----------|
| 服务健康 | 健康检查返回 UP | 自动/手动 |
| 版本正确 | 显示回滚版本号 | 手动 |
| 核心 API | 返回 200，数据正确 | 手动 |
| 数据库 | 连接正常，查询正常 | 自动 |
| 日志 | 无 ERROR 级别日志 | 自动 |

---

## 回滚后事项

### 立即行动（0-30 分钟）

1. **通知干系人**
   - 回滚完成通知
   - 服务已恢复正常
   - 问题影响范围说明

2. **监控观察**
   - 持续观察 30 分钟
   - 关注错误率、响应时间
   - 确认无异常后解除告警

3. **问题记录**
   - 记录回滚原因
   - 记录现象和日志
   - 保存问题现场

### 短期跟进（1-24 小时）

1. **问题分析**
   - 召集相关人员分析根因
   - 复现问题（测试环境）
   - 确定修复方案

2. **创建跟进任务**
   - 修复问题 → 创建 Issue
   - 改进流程 → 创建改进任务
   - 更新文档 → 创建文档任务

### 长期改进（1 周内）

1. **发布流程改进**
   - 为什么测试没发现问题？
   - 发布检查清单是否需要更新？
   - 监控告警是否及时？

2. **技术债务清理**
   - 代码层面修复
   - 测试补充
   - 文档更新

---

## 回滚记录模板

每次回滚完成后，必须填写以下记录：

```markdown
## 回滚记录

### 基本信息

- **回滚时间**: YYYY-MM-DD HH:mm
- **操作人**: @username
- **当前版本**: vX.Y.Z（问题版本）
- **回滚版本**: vX.Y.Z-1（稳定版本）

### 回滚原因

[详细描述触发回滚的原因]

### 影响范围

- 影响用户: 约 X 人
- 影响时长: X 分钟
- 影响功能: [列出受影响的功能]

### 回滚过程

| 时间 | 操作 | 结果 |
|------|------|------|
| HH:mm | 发现问题 | 服务 503 |
| HH:mm | 决策回滚 | 确认回滚 |
| HH:mm | 执行回滚 | 成功 |
| HH:mm | 验证完成 | 服务正常 |

### 后续行动

- [ ] 问题修复（Issue #xxx）
- [ ] 测试补充（Issue #xxx）
- [ ] 流程改进（Issue #xxx）
- [ ] 复盘会议（日期：xxx）
```

---

## 常见问题

### Q1: 回滚后新版本的数据怎么办？

**A**: 通常情况下，新增的数据保留，旧版本代码忽略新字段即可。如果涉及数据格式变更，需要：
1. 评估数据兼容性
2. 准备数据转换脚本
3. 在测试环境验证

### Q2: 有数据库迁移时如何回滚？

**A**: 
1. 优先尝试不回滚数据库，旧版本代码兼容新数据结构
2. 如果必须回滚数据，需要：
   - 备份当前数据
   - 执行反向迁移脚本
   - 验证数据完整性

### Q3: 回滚失败怎么办？

**A**: 
1. 保持冷静，记录当前状态
2. 尝试修复当前版本的问题（hotfix）
3. 如果无法修复，联系更高级别的支持
4. 必要时启动灾难恢复流程

### Q4: 什么情况下不应该回滚？

**A**: 
- 问题可以快速热修复（< 30 分钟）
- 回滚风险高于修复风险
- 数据已经发生不可逆变更且无法回滚

---

## 联系人和升级路径

| 级别 | 联系人 | 职责 | 升级条件 |
|------|--------|------|----------|
| L1 | 值班工程师 | 执行回滚操作 | - |
| L2 | 技术负责人 | 技术决策 | 回滚失败/复杂问题 |
| L3 | 架构师/CTO | 重大决策 | 级联故障/重大事故 |

---

## 相关文档

- [发布检查清单](./release-checklist.md)
- [监控告警配置](./monitoring.md)
- [灾难恢复计划](./disaster-recovery.md)
