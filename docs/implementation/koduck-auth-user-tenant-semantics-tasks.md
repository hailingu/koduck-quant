# Koduck Auth / User Tenant 语义实施任务清单

> 对应设计文档：
> [`/Users/guhailin/Git/koduck-quant/docs/design/koduck-auth-user-tenant-semantics.md`](/Users/guhailin/Git/koduck-quant/docs/design/koduck-auth-user-tenant-semantics.md)
>
> 状态：待执行  
> 创建日期：2026-04-11

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
|------|------|------|--------|
| Phase 1 | 设计冻结与契约梳理 | - | P0 |
| Phase 2 | 数据库与数据迁移 | Phase 1 | P0 |
| Phase 3 | `koduck-user` 租户化改造 | Phase 2 | P0 |
| Phase 4 | `koduck-auth` 租户化改造 | Phase 2 | P0 |
| Phase 5 | APISIX 与上下文透传 | Phase 3, 4 | P0 |
| Phase 6 | 联调、回归与灰度 | Phase 3, 4, 5 | P1 |

---

## Phase 1: 设计冻结与契约梳理

### Task 1.1: 冻结 `tenant_id` 语义
**详细要求:**
1. 确认 `tenant_id` 的类型、长度与来源
2. 明确 V1 不支持 tenant hierarchy
3. 明确 `(tenant_id, user_id)` 为身份主键语义

**冻结结果（2026-04-11）:**
- `tenant_id` 统一定义为字符串类型，对应数据库 `VARCHAR(128)`
- 真值来源为 `koduck-user` 的租户真值（`tenants.id`）及用户记录上的 `users.tenant_id`
- `koduck-auth` 仅负责读取并传播 `tenant_id`，不做推断或再生成
- V1 不支持 tenant hierarchy、父子租户继承或跨租户共享身份语义
- 对外与对内身份语义统一采用 `(tenant_id, user_id)`

**验收标准:**
- [x] `tenant_id` 语义在文档中固定
- [x] 各服务对 tenant 的解释一致

### Task 1.2: 梳理 JWT / internal API / gRPC 契约
**详细要求:**
1. 盘点需要增加 `tenant_id` 的 JWT claims
2. 盘点需要增加 `tenant_id` 的 internal API DTO
3. 盘点需要增加 `tenant_id` 的 gRPC 消息

**盘点结果（2026-04-11）:**
- JWT / OIDC / introspection 侧，`Claims`、`TokenIntrospectionResult`、OIDC discovery `claims_supported` 与对内 token validate 响应都需要纳入 `tenant_id`
- internal HTTP 侧，`koduck-auth -> koduck-user` 统一通过 `X-Tenant-Id` 传请求上下文；`UserDetailsResponse` / auth 侧 `InternalUserDetails` 需要回传 `tenant_id`，`CreateUserRequest` / `LastLoginUpdateRequest` 不在 body 中重复新增
- gRPC 侧，`ValidateCredentialsRequest`、`ValidateTokenResponse`、`GetUserRequest`、`GetUserRolesRequest/Response`、`RevokeTokenRequest`、`LogoutRequest`、`IntrospectTokenResponse`、`GenerateTokenPairRequest`、`UserInfo` 需要显式纳入 `tenant_id` 或通过嵌套 `UserInfo` 回传
- `RefreshTokenRequest/Response` 与 `GenerateTokenPairResponse` 不额外增加顶层 `tenant_id`，以 JWT claims 作为单一真值
- 完整清单见 `docs/design/koduck-auth-user-tenant-contract-inventory.md`

**验收标准:**
- [x] 影响接口清单完整
- [x] 契约改动边界清晰

---

## Phase 2: 数据库与数据迁移

### Task 2.1: `koduck-user` 数据库增加 `tenant_id`
**详细要求:**
1. 为 `users`、`roles` 增加 `tenant_id`
2. 评估并为 `user_roles`、`role_permissions`、`user_credentials` 增加租户语义
3. 新增 `tenants` 表或最小租户真值

**执行结果（2026-04-11）:**
- `koduck-user` 新增 Flyway `V2__add_tenant_columns.sql`，为 `users`、`roles`、`user_roles`、`role_permissions`、`user_credentials` 增加 `tenant_id`
- 新增 `tenants` 表并写入最小租户真值 `default`
- 对现有数据执行 `default` tenant 回填，并为新增列设置 `NOT NULL DEFAULT 'default'`
- 增加基础 tenant 索引，唯一约束切换保留到 Task 2.3
- 新增 Testcontainers 迁移验证测试，确认 schema 迁移可执行

**验收标准:**
- [x] 主表具备 `tenant_id`
- [x] 迁移脚本可执行

### Task 2.2: `koduck-auth` 安全域表增加 `tenant_id`
**详细要求:**
1. 为 `refresh_tokens`、`password_reset_tokens`、`audit_logs` 增加 `tenant_id`
2. 为查询建立租户维度索引

**执行结果（2026-04-11）:**
- `koduck-auth` 新增迁移 `202604110001_add_tenant_to_security_tables.sql`，为 `refresh_tokens`、`password_reset_tokens`、`audit_logs` 增加 `tenant_id`
- 对存量数据统一回填 `default`，并将三张表的 `tenant_id` 设为 `NOT NULL DEFAULT 'default'`
- 为 token / audit 检索补充租户维度索引
- `RefreshTokenRepository` 与 `PasswordResetRepository` 新增 tenant-aware 保存、查询、吊销/标记方法，无 tenant 参数的方法默认落到 `default`

**验收标准:**
- [x] 安全域表具备 `tenant_id`
- [x] 按租户查询可用

### Task 2.3: 唯一约束切换为租户内唯一
**详细要求:**
1. 将用户唯一性调整为：
   - `unique (tenant_id, username)`
   - `unique (tenant_id, email)`
2. 将角色唯一性调整为：
   - `unique (tenant_id, name)`
3. 为存量数据回填默认 tenant

**执行结果（2026-04-11）:**
- `koduck-user` 新增迁移 `V3__switch_uniqueness_constraints_to_tenant_scope.sql`，将 `users` 和 `roles` 的全局唯一约束切换为租户内唯一
- 迁移在切约束前再次将 `users.tenant_id` 与 `roles.tenant_id` 的空值收口到 `default`
- 新增 ADR `0019-switch-uniqueness-constraints-to-tenant-scope.md` 固化该阶段的决策与兼容性影响
- 扩展 `UserTenantSchemaMigrationIntegrationTest`，验证旧约束已移除，且“跨租户可重复、租户内不可重复”的行为成立

**验收标准:**
- [x] 不再使用全局唯一
- [x] 存量数据可迁移

---

## Phase 3: `koduck-user` 租户化改造

### Task 3.1: 实体与 Repository 增加 `tenant_id`
**详细要求:**
1. 更新 `User`、`Role` 等实体
2. Repository 查询显式带 `tenant_id`

**执行结果（2026-04-11）:**
- `koduck-user` 的 `User`、`Role`、`UserRole`、`RolePermission`、`UserCredential` 实体均补充了 `tenantId` 字段，并与当前表结构保持一致
- `UserRepository`、`RoleRepository`、`UserRoleRepository`、`RolePermissionRepository` 已切换为 tenant-aware 查询方法
- `UserServiceImpl`、`RoleServiceImpl`、`PermissionServiceImpl` 在 Task 3.2 引入 header 之前，统一通过 `default` tenant 调用 repository，避免继续走全局范围查询
- 新增 ADR `0020-align-entities-and-repositories-with-tenant-scope.md` 记录本阶段的边界、权衡与兼容策略

**验收标准:**
- [x] 查询不再是全局范围
- [x] 实体与表结构一致

### Task 3.2: Internal API 增加租户上下文
**详细要求:**
1. internal API 支持 `X-Tenant-Id`
2. `findByUsername / findByEmail / getUserRoles / getUserPermissions` 默认按租户作用域执行

**执行结果（2026-04-11）:**
- `InternalUserController` 现已支持读取 `X-Tenant-Id`，并在缺失时兼容回退到 `default` tenant
- `UserService` / `UserServiceImpl` 的 internal API 相关方法均增加 `tenantId` 参数，用户读取、角色读取、权限读取与创建用户路径按租户作用域执行
- controller 审计日志增加 tenantId 记录，便于后续链路排查
- 新增 ADR `0021-add-tenant-context-to-internal-user-api.md`，明确“显式支持 header，旧路径回退 default”的兼容策略

**验收标准:**
- [x] internal API 不会跨租户串读
- [x] 旧路径兼容策略明确

### Task 3.3: `UserContext` 扩展 `tenant_id`
**详细要求:**
1. 新增 `X-Tenant-Id`
2. 增加 `getTenantId()`

**验收标准:**
- [ ] 控制器和服务层可读取租户上下文

---

## Phase 4: `koduck-auth` 租户化改造

### Task 4.1: JWT claims 增加 `tenant_id`
**详细要求:**
1. 更新 claims 模型
2. token 生成时写入 `tenant_id`
3. token 校验时解析 `tenant_id`

**验收标准:**
- [ ] access token 带 `tenant_id`
- [ ] refresh / validate 链路不丢失 tenant

### Task 4.2: gRPC / introspection 增加 `tenant_id`
**详细要求:**
1. 更新 `ValidateTokenResponse`
2. 更新 `GetUserResponse`
3. 更新 introspection 结果

**验收标准:**
- [ ] 对内契约可返回 `tenant_id`
- [ ] 下游服务可消费 `tenant_id`

### Task 4.3: 登录与 refresh 流程租户化
**详细要求:**
1. 登录时确定用户归属 tenant
2. refresh token 流程保持 tenant 一致

**验收标准:**
- [ ] 登录和 refresh 不会错租户
- [ ] 审计日志带 `tenant_id`

---

## Phase 5: APISIX 与上下文透传

### Task 5.1: JWT 验签后注入 `X-Tenant-Id`
**详细要求:**
1. 更新 APISIX 插件或 route 配置
2. 将 `tenant_id` 透传为 `X-Tenant-Id`

**验收标准:**
- [ ] 下游收到 `X-Tenant-Id`
- [ ] 与 `X-User-Id / X-Username / X-Roles` 一致透传

### Task 5.2: 网关与服务联调
**详细要求:**
1. 验证 `koduck-auth -> APISIX -> koduck-user`
2. 验证 tenant header 与 JWT claims 一致

**验收标准:**
- [ ] header 与 claims 不冲突
- [ ] 服务端能按租户隔离执行

---

## Phase 6: 联调、回归与灰度

### Task 6.1: 单元与集成测试
**详细要求:**
1. 增加多租户测试数据
2. 验证用户名/邮箱租户内唯一
3. 验证跨租户不可见

**验收标准:**
- [ ] 多租户场景测试通过
- [ ] 不存在串租户查询

### Task 6.2: 迁移与灰度方案
**详细要求:**
1. 设计 `default tenant` 过渡方案
2. 明确灰度窗口与回滚路径

**验收标准:**
- [ ] 存量用户可平滑迁移
- [ ] 回滚路径可操作

### Task 6.3: 下游服务适配清单
**详细要求:**
1. 梳理 `koduck-ai`、`memory` 等下游所需调整
2. 明确统一读取 `X-Tenant-Id`

**验收标准:**
- [ ] 下游适配清单完整
- [ ] 后续服务可直接复用 tenant 语义
