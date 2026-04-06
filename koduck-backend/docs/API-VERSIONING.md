# API Versioning Strategy

本文档定义 Koduck Backend 的 API 版本管理策略，统一 URL 路径格式并规范版本升级流程。

## 1. URL 版本格式

所有对外 HTTP API 必须采用统一路径格式：

- /api/v{major}/...

示例：

- /api/v1/auth/login
- /api/v1/market/search
- /api/v2/market/search（未来 major 版本）

约束：

- 仅在 URL 中使用 major 版本号，不在路径中使用 minor/patch。
- 禁止混用无版本路径（如 /api/auth/login）和版本路径。
- 新增 Controller 必须在类级 @RequestMapping 中显式声明版本前缀。

## 2. 版本语义

- v1：当前稳定版本。
- v2（及以上）：仅在存在不兼容变更时创建。
- minor/patch 通过兼容扩展实现，不新增 URL 路径版本。

不兼容变更包括但不限于：

- 删除或重命名已有字段；
- 修改字段语义导致旧客户端误解；
- 修改接口行为导致旧客户端无法按原逻辑工作；
- 调整认证/鉴权契约且无法向后兼容。

## 3. 版本升级流程

### Step 1: 兼容性分级

在需求评审阶段先判断变更是否兼容：

- 兼容变更：继续在当前 major（如 v1）演进；
- 不兼容变更：进入新 major 方案评审（如 v2）。

### Step 2: ADR 记录

涉及 major 升级或版本策略调整时，必须新增 ADR，说明：

- 触发升级原因；
- 兼容性影响评估；
- 迁移窗口与下线计划。

### Step 3: 并行发布

新旧 major 并行提供服务一段时间（如 v1 + v2），并明确：

- v1 的冻结范围（仅修复，不加新特性）；
- v2 的目标能力。

### Step 4: 弃用与下线

对旧 major 执行可观测弃用流程：

- 文档标记 Deprecated；
- 在 Release Note 公布迁移指南与截止日期；
- 监控调用量，确认迁移完成后下线。

## 4. 文档与发布要求

每次 API 变更需同步更新：

- OpenAPI 文档（接口定义）
- 版本变更说明（Release Note）
- 迁移说明（字段映射、行为差异、示例请求）

## 5. PR 检查项

- [ ] 路径遵循 /api/v{major}/...
- [ ] 未引入无版本路径
- [ ] 兼容性评估已完成
- [ ] 涉及不兼容变更时已补 ADR
- [ ] 文档已同步（OpenAPI/迁移说明）

---

Owner: Backend Team  
Status: Active
