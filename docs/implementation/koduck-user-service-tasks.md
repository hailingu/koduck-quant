# Koduck-User 独立服务实施任务清单

> 本文档基于 `docs/design/koduck-auth-user-service-design.md` 拆分，提供 step-by-step 可执行任务。
>
> **状态**: 执行中
> **创建日期**: 2026-04-08  
> **对应设计文档**: [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md)

---

## 执行阶段概览

| 阶段 | 名称 | 预计工作量 | 依赖 | 优先级 |
|------|------|------------|------|--------|
| Phase 1 | 项目初始化与模块骨架 | 1-2 天 | - | P0 |
| Phase 2 | 数据库与数据模型 | 2 天 | Phase 1 | P0 |
| Phase 3 | Repository 与核心服务 | 2-3 天 | Phase 2 | P0 |
| Phase 4 | 对外 HTTP API 实现 | 2 天 | Phase 3 | P1 |
| Phase 5 | 内部 API 与服务间通信 | 1-2 天 | Phase 3 | P1 |
| Phase 6 | 配置、可观测性与安全基线 | 1 天 | Phase 4, 5 | P1 |
| Phase 7 | 部署、测试与迁移上线 | 2-3 天 | Phase 4, 5, 6 | P1 |

---

## Phase 1: 项目初始化与模块骨架

### Task 1.1: 创建 koduck-user 模块与目录结构
**详细要求:**
1. 在仓库顶级创建独立服务目录 `koduck-user`（不作为 `koduck-backend` 聚合子模块）
2. 建立标准目录：
   - `src/main/java/com/koduck/...`
   - `src/main/resources/application.yml`
   - `src/main/resources/db/migration/`
   - `src/test/java/com/koduck/...`
3. 按设计文档 2.2 节创建包结构：
   - `controller/user`
   - `service`、`service/impl`
   - `entity/user`
   - `repository/user`
   - `dto/user`

**验收标准:**
- [x] `koduck-user` 可独立构建，不依赖 `koduck-backend` 聚合构建
- [x] 目录结构与设计文档 2.2 节一致
- [x] 模块启动类与基础配置可正常加载

**参考文档:** 设计文档 2.2 节

---

### Task 1.2: 依赖与基础工程配置
**文件:** `koduck-user/pom.xml`

**详细要求:**
1. 引入 Spring Boot Web、Validation、Data JPA、Flyway、Actuator、PostgreSQL 驱动
2. 配置基础测试依赖（JUnit5、Mockito、Spring Boot Test）
3. 保持依赖最小化：当前阶段不强依赖 `koduck-common` 与 `koduck-bom`，按需再引入

**验收标准:**

- [x] `mvn -f koduck-user/pom.xml -DskipTests compile` 成功
- [x] Flyway、JPA、Actuator 依赖完整
- [x] 依赖声明不包含 `koduck-common` 与 `koduck-bom`（当前阶段）

**参考文档:** 设计文档 7.1 节、仓库 `CONTRIBUTING.md`

---

## Phase 2: 数据库与数据模型

### Task 2.1: user_db 迁移脚本实现
**文件:** `koduck-user/src/main/resources/db/migration/V1__init_user_schema.sql`

**详细要求:**
1. 创建表：`users`、`roles`、`permissions`、`user_roles`、`role_permissions`、`user_credentials`
2. 添加约束：主键、外键、唯一约束（含 `(user_id, role_id)`、`(role_id, permission_id)`）
3. 添加索引：
   - `idx_users_username`
   - `idx_users_email`
   - `idx_users_status`
   - `idx_user_roles_user_id`
   - `idx_user_roles_role_id`
   - `idx_role_permissions_role_id`
   - `idx_role_permissions_permission_id`
   - `idx_user_credentials_user_id`
4. 初始化基础角色、权限、超级管理员角色权限映射

**验收标准:**
- [x] SQL 可在 PostgreSQL 14+ 成功执行
- [x] 表结构、索引、约束与设计文档 3.1 节一致
- [x] 初始化数据写入成功且可复现

**参考文档:** 设计文档 3.1 节

---

### Task 2.2: Entity 映射实现
**文件:**
- `entity/user/User.java`
- `entity/user/Role.java`
- `entity/user/Permission.java`
- `entity/user/UserRole.java`
- `entity/user/RolePermission.java`
- `entity/user/UserCredential.java`

**详细要求:**
1. 按数据库字段定义 JPA Entity 与关联
2. 定义用户状态枚举（DISABLED/ACTIVE/PENDING）
3. 统一时间字段与审计字段映射策略

**验收标准:**
- [x] Entity 字段与数据库 schema 对齐
- [x] 关联关系与删除策略正确（尤其级联约束）
- [x] 枚举映射与默认值行为符合预期

**参考文档:** 设计文档 2.2 节、3.1 节

---

### Task 2.3: DTO 结构定义
**文件:** `dto/user/*`

**详细要求:**
1. 定义公开 API DTO：
   - `UserProfileResponse`
   - `UpdateProfileRequest`
   - `UserSummaryResponse`
   - 角色/权限相关 DTO
2. 定义内部 API DTO：
   - `UserDetailsResponse`
   - `CreateUserRequest`
   - `LastLoginUpdateRequest`
3. 为请求 DTO 添加 Bean Validation 注解（`@Email`、`@Size`、`@NotBlank` 等）

**验收标准:**
- [ ] DTO 覆盖设计文档 4.1.4、4.2 所需结构
- [ ] 参数校验注解完整
- [ ] 序列化字段命名与 API 规范一致

**参考文档:** 设计文档 4.1.4 节、4.2 节

---

## Phase 3: Repository 与核心服务

### Task 3.1: Repository 层实现
**文件:** `repository/user/*.java`

**详细要求:**
1. 实现 `UserRepository` 查询能力：按 id/username/email、分页查询、状态过滤
2. 实现 `RoleRepository`、`PermissionRepository` 基础查询
3. 实现 `UserRoleRepository`、`RolePermissionRepository` 关联查询与幂等检查
4. 支持 `updateLastLogin` 场景

**验收标准:**
- [ ] Repository 方法覆盖设计文档核心用例
- [ ] 用户搜索支持 keyword/status/page/size/sort
- [ ] 关键查询具备必要索引命中（通过 explain 或性能测试验证）

**参考文档:** 设计文档 2.2 节、6.1 节

---

### Task 3.2: UserService 与业务规则实现
**文件:**
- `service/UserService.java`
- `service/impl/UserServiceImpl.java`

**详细要求:**
1. 实现公开 API 业务逻辑：
   - 获取当前用户信息
   - 更新当前用户资料
   - 用户搜索
   - 角色分配与移除
2. 实现内部 API 业务逻辑：
   - `findByUsername`
   - `findByEmail`
   - `createUser`
   - `updateLastLogin`
   - `getUserRoles`
   - `getUserPermissions`
3. 规则要求：
   - 邮箱变更后 `emailVerifiedAt` 置空
   - 角色分配幂等
   - 异常语义清晰（用户不存在、角色不存在、冲突等）

**验收标准:**
- [ ] Service 方法覆盖设计文档 6.1 节主要流程
- [ ] 业务规则（幂等、邮箱重验证）正确实现
- [ ] 事务边界合理（读写分离、写事务完整）

**参考文档:** 设计文档 6.1 节

---

### Task 3.3: RoleService / PermissionService 实现
**文件:**
- `service/RoleService.java`
- `service/PermissionService.java`
- `service/impl/*`

**详细要求:**
1. 实现角色管理 API 业务能力（列表、详情、创建、更新、删除）
2. 实现权限读取能力（权限列表、用户权限查询）
3. 对删除角色等高风险操作增加保护策略（如系统保留角色）

**验收标准:**
- [ ] 角色与权限服务覆盖设计文档 4.1.2/4.1.3
- [ ] 删除与变更行为有明确约束
- [ ] 权限聚合结果可用于网关透传与服务鉴权

**参考文档:** 设计文档 4.1.2 节、4.1.3 节

---

## Phase 4: 对外 HTTP API 实现

### Task 4.1: 用户管理 Controller
**文件:** `controller/user/UserController.java`

**详细要求:**
1. 实现用户接口：
   - `GET /api/v1/users/me`
   - `PUT /api/v1/users/me`
   - `PUT /api/v1/users/me/password`
   - `PUT /api/v1/users/me/avatar`
   - `DELETE /api/v1/users/me`
   - `GET /api/v1/users/{userId}`
   - `GET /api/v1/users`
   - `PUT /api/v1/users/{userId}`
   - `DELETE /api/v1/users/{userId}`
2. 从网关透传头读取用户上下文（`X-User-Id`、`X-Username`、`X-Roles`）
3. 统一响应结构与错误码

**验收标准:**
- [ ] 路由与设计文档 4.1.1 完全一致
- [ ] 参数校验和错误处理正确
- [ ] 当前用户接口不依赖前端传入 userId

**参考文档:** 设计文档 4.1.1 节

---

### Task 4.2: 角色与权限 Controller
**文件:**
- `controller/user/RoleController.java`
- `controller/user/PermissionController.java`

**详细要求:**
1. 实现角色管理接口（列表、详情、创建、更新、删除、用户角色分配/移除）
2. 实现权限接口（权限列表、用户权限查询）
3. 与权限模型对齐（`role:read`、`role:write`、`role:delete`、`user:*`）

**验收标准:**
- [ ] 路由覆盖设计文档 4.1.2、4.1.3
- [ ] 接口权限要求在控制层与业务层均有体现
- [ ] 返回值结构与 DTO 定义一致

**参考文档:** 设计文档 4.1.2 节、4.1.3 节

---

## Phase 5: 内部 API 与服务间通信

### Task 5.1: InternalUserController 实现
**文件:** `controller/user/InternalUserController.java`

**详细要求:**
1. 实现内部接口：
   - `GET /internal/users/by-username/{username}`
   - `GET /internal/users/by-email/{email}`
   - `POST /internal/users`
   - `PUT /internal/users/{userId}/last-login`
   - `GET /internal/users/{userId}/roles`
   - `GET /internal/users/{userId}/permissions`
2. 对调用方 Consumer 透传头（`X-Consumer-Username`）做审计记录
3. 返回语义与 koduck-auth 预期对齐（404/200/校验失败）

**验收标准:**
- [ ] 路由与设计文档 4.2 完全一致
- [ ] 可满足 koduck-auth 注册/登录回调场景
- [ ] 内部接口具备最小可审计信息

**参考文档:** 设计文档 4.2 节、5.1 节

---

### Task 5.2: 服务间调用契约联调
**详细要求:**
1. 以 API Contract 测试验证 koduck-auth ↔ koduck-user 的关键调用
2. 覆盖场景：
   - 用户不存在
   - 用户创建冲突（username/email）
   - 登录后更新时间/IP
   - 角色和权限查询
3. 明确超时、重试、熔断策略（如由调用方承担）

**验收标准:**
- [ ] 与 koduck-auth 的内部 API 契约测试通过
- [ ] 错误码与响应结构无歧义
- [ ] 关键调用路径具备回归测试

**参考文档:** 设计文档 5.1 节

---

### Task 5.3: 可选链路 - koduck-user 通过 APISIX 调用 koduck-auth（Token 自省/吊销）
**目标说明:**
- 默认主链路为 `koduck-auth -> koduck-user`，本任务仅在明确需要 Token 自省或跨服务主动吊销时启用。

**详细要求:**
1. 新增 `AuthClient`（或等价客户端）调用封装，默认通过 APISIX 地址访问 auth 内部接口：
   - `AUTH_BASE_URL` 默认指向 APISIX（如 `http://apisix:9080`）
   - 禁止默认直连 `koduck-auth:8081`
2. 调用时携带 `apikey` 供 APISIX `key-auth` 认证，并依赖网关转发到 auth。
3. 提供显式开关（如 `AUTH_INTROSPECTION_ENABLED=false`）：
   - 关闭时：koduck-user 不发起任何到 auth 的 token 自省调用
   - 开启时：仅允许白名单场景调用（如账号高风险操作或会话强制失效）
4. 明确失败策略：
   - APISIX 返回 401/403 时不重试并记录安全日志
   - 5xx/网络错误按有限重试策略处理（例如最多 2 次）

**验收标准:**
- [ ] 未开启开关时，koduck-user 不存在到 auth 的主动调用链路
- [ ] 开启后所有调用均通过 APISIX 地址而非 auth 直连地址
- [ ] `apikey` 缺失或错误时，链路按预期失败并记录审计日志
- [ ] 自省/吊销调用具备集成测试覆盖（成功、401、5xx 三类）

**参考文档:** JWT 设计文档 5.2~5.5 节

---

## Phase 6: 配置、可观测性与安全基线

### Task 6.1: application.yml 与环境变量配置
**文件:** `koduck-user/src/main/resources/application.yml`

**详细要求:**
1. 按设计文档配置：
   - 服务端口 `8082`
   - 数据源与 Flyway
   - JPA 配置
   - 存储配置（头像 local/s3）
   - Actuator 健康与指标暴露
2. 敏感配置由环境变量注入（数据库密码、S3 密钥）

**验收标准:**
- [ ] 配置项覆盖设计文档 7.1 节
- [ ] 本地与容器环境均可加载配置
- [ ] 敏感信息不出现在代码仓库明文文件

**参考文档:** 设计文档 7.1 节

---

### Task 6.2: 认证与权限边界落地
**详细要求:**
1. 公开 API 依赖 APISIX JWT 认证结果（用户上下文头）
2. 内部 API 由 APISIX `key-auth` 保护
3. 对关键管理接口增加权限校验（role/user 相关）

**验收标准:**
- [ ] 未认证请求无法访问公开 API
- [ ] 未携带合法内部 key 的请求无法访问 `/internal/*`
- [ ] 权限不足请求返回预期状态码（403）

**参考文档:** 设计文档 4.1 节、8.3 节

---

## Phase 7: 部署、测试与迁移上线

### Task 7.1: K8s 部署清单
**文件:**
- `k8s/base/koduck-user.yaml`（或拆分 deployment/service/secrets）

**详细要求:**
1. Deployment：2 副本、资源限制、健康探针、Secret 注入
2. Service：ClusterIP 暴露 `8082`
3. 与现有命名空间/overlay 结构兼容

**验收标准:**
- [ ] K8s 清单覆盖设计文档 8.1、8.2
- [ ] liveness/readiness 探针可用
- [ ] Secret 引用正确且可在 dev 环境启动

**参考文档:** 设计文档 8.1 节、8.2 节

---

### Task 7.2: APISIX 路由初始化脚本
**文件:** `scripts/apisix-route-init-user.sh`

**详细要求:**
1. 配置对外用户 API 路由（JWT）
2. 配置内部 API 路由（key-auth）
3. 注册 Consumer 与 key
4. 支持幂等更新、错误提示、回滚能力（必须）
5. 固化关键协议配置：
   - 用户公开路由 `uri: /api/v1/users/*`，`priority: 90`
   - 内部路由 `uri: /internal/users/*`，`priority: 100`
   - 公开路由启用 `jwt-auth` 并通过 `proxy-rewrite` 透传 `X-User-Id`、`X-Username`、`X-Roles`
   - 内部路由启用 `key-auth` 并通过 `proxy-rewrite` 透传 `X-Consumer-Username`，同时清理 `apikey`

**验收标准:**
- [ ] 路由规则与设计文档 8.3 一致
- [ ] 可重复执行且结果一致
- [ ] 失败时可快速回滚或重放
- [ ] 缺失/错误 apikey 的内部请求由 APISIX 返回 401
- [ ] 权限不足的业务请求返回 403（由后端权限模型决定）
- [ ] 路由脚本执行后，Admin API 可读到上述 `uri/priority/plugins/proxy-rewrite` 配置

**参考文档:** 设计文档 8.3 节

---

### Task 7.3: 测试与质量门禁
**详细要求:**
1. 单元测试：Service 层核心规则（邮箱重验证、角色幂等、权限聚合）
2. 集成测试：Controller + Repository + DB（Testcontainers）
3. 端到端测试：通过 APISIX 验证公开/内部 API
4. 最小质量校验：
   - `mvn -f koduck-user/pom.xml -DskipTests compile`
   - `mvn -f koduck-user/pom.xml test`

**验收标准:**
- [ ] 核心业务路径测试覆盖完整
- [ ] 集成测试可稳定执行
- [ ] 质量门禁命令在 CI 可复现

**参考文档:** 设计文档 9.3 节

---

### Task 7.4: 数据迁移与灰度上线
**详细要求:**
1. 准备数据迁移脚本与校验脚本（旧库 → `user_db`）
2. 制定灰度策略：并行运行、流量分批切换、回滚预案
3. 完成全量切换后清理临时资源

**验收标准:**
- [ ] 迁移后关键用户数据一致性通过校验
- [ ] 灰度与回滚演练至少完成 1 次
- [ ] 上线后核心指标稳定（错误率、延迟、可用性）

**参考文档:** 设计文档 9.1~9.4 节

---

## 附录

### A. 建议 Issue 拆分（可直接建卡）

1. `feat(user): init koduck-user module skeleton and pom`
2. `feat(user): add user_db flyway migrations and seed data`
3. `feat(user): implement user/role/permission entities and repositories`
4. `feat(user): implement user service and internal api contract`
5. `feat(user): implement user/role/permission controllers`
6. `feat(user): add apisix routes and k8s manifests for koduck-user`
7. `test(user): add unit/integration/e2e test suites`
8. `ops(user): execute migration rehearsal and canary rollout`

### B. 相关文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 设计文档 | [../design/koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) | koduck-user 独立服务方案 |
| JWT 架构 | [../design/koduck-user-jwt-design.md](../design/koduck-user-jwt-design.md) | 网关认证与服务间调用 |
| API 规范 | [../design/koduck-user-api.yaml](../design/koduck-user-api.yaml) | 详细 REST API 契约 |

---

## 附录 D: 构建说明（当前阶段）

- Docker 构建命令：`docker build -t koduck-user:dev ./koduck-user`
- 当前阶段不要求预先 `mvn install koduck-common` 或安装 `koduck-bom`

## 附录 C: 契约冻结表（联调前必须确认）

| 调用方 | 接口 | 方法 | 必填请求头 | 成功响应 | 失败响应（最小集） | 备注 |
|------|------|------|------------|----------|--------------------|------|
| APISIX -> koduck-user | `/api/v1/users/*` | 多方法 | `X-User-Id`, `X-Username`, `X-Roles` | 200/201/204 | 400, 401, 403, 404, 409, 500 | JWT 在网关验签 |
| koduck-auth -> koduck-user | `/internal/users/by-username/{username}` | GET | `X-Consumer-Username` | 200 | 400, 401, 404, 500 | key-auth 保护 |
| koduck-auth -> koduck-user | `/internal/users/by-email/{email}` | GET | `X-Consumer-Username` | 200 | 400, 401, 404, 500 | key-auth 保护 |
| koduck-auth -> koduck-user | `/internal/users` | POST | `X-Consumer-Username` | 200 | 400, 401, 409, 500 | 注册回调 |
| koduck-auth -> koduck-user | `/internal/users/{userId}/last-login` | PUT | `X-Consumer-Username` | 200 | 400, 401, 404, 500 | 登录成功回写 |
| koduck-auth -> koduck-user | `/internal/users/{userId}/roles` | GET | `X-Consumer-Username` | 200 | 400, 401, 404, 500 | 角色查询 |
| koduck-auth -> koduck-user | `/internal/users/{userId}/permissions` | GET | `X-Consumer-Username` | 200 | 400, 401, 404, 500 | 权限查询 |
| koduck-user -> APISIX -> koduck-auth（可选） | token introspection/revoke | 按 auth 契约 | `apikey` | 200 | 401, 403, 5xx | 仅在启用开关时 |

> 使用方式：
> 1. 联调前逐行确认“路径/方法/请求头/状态码”。
> 2. 任一项变更都必须同步更新本表和 `docs/design/koduck-user-api.yaml`。
> 3. PR 验收时需附上契约测试结果（建议以自动化测试报告为准）。

---

*文档版本: 1.0*  
*创建日期: 2026-04-08*  
*作者: Koduck Team*
