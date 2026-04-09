# ADR-0013: Task 6.1 application.yml 与环境变量配置基线

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #699, koduck-user/docs/implementation/koduck-user-service-tasks.md Task 6.1, ADR-0012

---

## 背景与问题陈述

`koduck-user` 在前序任务中已具备基础配置，但与设计文档 7.1 仍存在差异：

1. 数据库环境变量命名未与 `USER_DB_*` 约定对齐。
2. 头像存储仅存在 `koduck.user.avatar` 结构，缺少设计文档中的 `storage.avatar`（含 local/s3 分层）。
3. 部分敏感配置（如数据库密码）存在本地默认明文，不符合“敏感信息仅由环境变量注入”的基线。

Task 6.1 目标是在不破坏现有行为的前提下，建立可在本地、容器与 K8s 一致运行的配置规范。

---

## 决策驱动因素

1. **设计一致性**: 配置项需覆盖设计文档 7.1 要求（端口、数据源/Flyway、JPA、存储、Actuator）。
2. **安全基线**: 数据库密码、S3 密钥等敏感信息不得以仓库明文默认值存在。
3. **部署连续性**: 现有环境可能仍使用旧环境变量命名（`DB_*`、`AVATAR_*`），需平滑兼容。
4. **可运维性**: 同一份配置应在本地调试与容器部署中行为可预测。

---

## 考虑的选项

### 选项 1: 全量切换到新键并移除旧键兼容

**优点**:
- 配置结构最简洁
- 与设计文档完全同构

**缺点**:
- 现有环境变量若未同步调整会导致启动失败
- 回归成本高，变更窗口风险大

### 选项 2: 新键对齐 + 旧键兼容回退（选定）

**优点**:
- 兼顾设计收敛与平滑迁移
- 降低 dev 环境与历史脚本的中断风险
- 可逐步推动环境变量标准化

**缺点**:
- 配置表达式略复杂
- 需要在文档中明确优先级与迁移计划

### 选项 3: 保持现状，仅补文档说明

**优点**:
- 代码改动最小

**缺点**:
- 无法满足 Task 6.1 验收目标
- 安全与规范债务继续累积

---

## 决策结果

采用 **选项 2**：在 `application.yml` 中完成设计文档 7.1 对齐，并保留旧键兼容。

核心决策如下：

1. 数据库配置改为优先读取 `USER_DB_*`，并兼容回退 `DB_*`。
2. 数据库密码改为环境变量注入，不再提供明文默认值。
3. 新增 `storage.avatar` 配置树（provider/local/s3），同时兼容既有 `AVATAR_*` 环境变量。
4. 保留并沿用现有 Actuator 健康与指标暴露配置。

---

## 实施细节

### 变更文件

| 文件 | 变更说明 |
|------|------|
| `koduck-user/src/main/resources/application.yml` | 对齐 7.1 的数据源与存储配置，敏感项环境变量化 |

### 关键配置策略

- `spring.datasource.url`:
  - `USER_DB_HOST/PORT/NAME` 为首选
  - `DB_HOST/PORT/NAME` 为回退
- `spring.datasource.password`:
  - `USER_DB_PASSWORD` 为首选
  - `DB_PASSWORD` 为回退
  - 默认值为空（避免仓库明文密码）
- `storage.avatar`:
  - `provider` 支持 `local/s3`
  - `local.path/base-url` 支持本地与容器运行
  - `s3` 的 `bucket/region/access-key/secret-key` 全部来自环境变量

---

## 权衡与影响

### 正向影响

- 与设计文档 7.1 的配置模型对齐，降低认知偏差。
- 将敏感配置显式收敛到环境变量注入路径。
- 兼容旧键，减少部署切换风险。

### 负向影响

- 配置层出现新旧键共存，短期复杂度上升。
- 运维侧需明确“新键优先”的治理策略。

### 缓解措施

- 在 ADR 中明确键优先级。
- 后续在稳定窗口推动旧键下线并补充检查脚本。

---

## 兼容性影响

1. **接口兼容性**: 无 API 路由与响应变更。
2. **运行时兼容性**: 支持旧环境变量，避免现有环境直接中断。
3. **安全兼容性**: 敏感项默认不再明文，若环境未注入则按启动时校验失败暴露问题。
4. **部署兼容性**: 本地、Docker、K8s 均可通过环境变量注入策略统一配置。

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 7.1 节
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md)
- [koduck-user-jwt-design.md](../design/koduck-user-jwt-design.md)
- [ADR-0012](./0012-auth-client-introspection-via-apisix.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
