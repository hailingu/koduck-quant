# ADR-0003: user_db 数据库 Schema 迁移设计

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #677, koduck-user/docs/design/koduck-auth-user-service-design.md 3.1 节

---

## 背景与问题陈述

koduck-user 作为独立服务，需要拥有独立的数据库 `user_db` 来管理用户信息、角色和权限数据。需要设计并实现第一版 Flyway 迁移脚本，建立完整的表结构、约束、索引和种子数据。

### 上下文

- **业务背景**: 用户管理服务需要支持用户 CRUD、RBAC 角色权限模型、多因素认证凭证
- **技术背景**: 使用 PostgreSQL 14+、Flyway 进行数据库版本管理，JPA/Hibernate 做 ORM 映射
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 3.1 节定义的数据库设计

---

## 决策驱动因素

1. **数据完整性**: 外键约束和唯一约束确保引用完整性和业务规则
2. **查询性能**: 索引覆盖核心查询路径（按 username/email 查找用户、按 userId/roleId 关联查询）
3. **可迁移性**: 种子数据必须幂等且可复现，支持环境初始化
4. **级联策略**: 用户删除时级联清理关联数据（角色、凭证），避免孤儿记录
5. **扩展性**: `user_credentials` 表设计支持多因素认证（PASSWORD/TOTP/FIDO2）

---

## 考虑的选项

### 选项 1: 单表用户设计（角色/权限为 JSON 字段）

**描述**: 将角色和权限直接存储为 `users` 表的 JSONB 字段

**优点**:
- 查询简单，无需 JOIN
- 适合角色权限不频繁变更的场景

**缺点**:
- 无法保证角色/权限的引用完整性
- 多用户共享同一角色时产生数据冗余
- 权限校验需要解析 JSON，性能较差
- 不符合 RBAC 标准模型

### 选项 2: 完整 RBAC 六表设计（选定）

**描述**: 采用 users/roles/permissions/user_roles/role_permissions/user_credentials 六表设计

**优点**:
- 标准 RBAC 模型，角色和权限独立管理
- 用户-角色多对多、角色-权限多对多，灵活分配
- 外键约束保证数据完整性
- 支持细粒度权限控制（resource + action）
- `user_credentials` 支持多种认证因子

**缺点**:
- 查询需要多表 JOIN
- 表结构较复杂

### 选项 3: users + roles 两表简化设计

**描述**: 只建 users 和 roles 两张表，权限硬编码在应用层

**优点**:
- 结构简单
- 适合早期快速开发

**缺点**:
- 权限无法动态配置
- 角色变更需要发版
- 不支持细粒度权限控制

---

## 决策结果

**选定的方案**: 选项 2 - 完整 RBAC 六表设计

**理由**:

1. **设计文档对齐**: 与 `koduck-auth-user-service-design.md` 3.1 节完全一致
2. **API 契约匹配**: 支持 API 规范中定义的所有角色/权限管理接口（4.1.2、4.1.3 节）
3. **内部 API 支持**: koduck-auth 需要查询用户角色和权限（`/internal/users/{userId}/roles`、`/internal/users/{userId}/permissions`）
4. **长期可维护性**: RBAC 标准模型便于后续扩展（如新增权限、调整角色策略）

**积极后果**:

- 完整的 RBAC 数据模型，支持灵活的权限管理
- 外键级联删除保证数据一致性
- 索引覆盖核心查询路径，保证查询性能
- 种子数据提供开箱即用的基础角色和权限

**消极后果**:

- 用户权限查询需要多表 JOIN（user_roles -> role_permissions -> permissions）
- 6 张表增加了 schema 复杂度

**缓解措施**:

- 在 Repository 层封装聚合查询，对 Service 层屏蔽 JOIN 复杂度
- 为关联表建立索引（user_id、role_id、permission_id）保证 JOIN 性能
- `userRoleRepository.findPermissionsByUserId()` 直接通过 SQL 聚合查询权限

---

## 实施细节

### 表结构概览

| 表名 | 说明 | 关键约束 |
|------|------|----------|
| `users` | 用户主表 | username UNIQUE, email UNIQUE |
| `roles` | 角色表 | name UNIQUE |
| `permissions` | 权限表 | code UNIQUE |
| `user_roles` | 用户-角色关联 | UNIQUE(user_id, role_id), FK CASCADE |
| `role_permissions` | 角色-权限关联 | UNIQUE(role_id, permission_id), FK CASCADE |
| `user_credentials` | 用户凭证表 | FK(user_id) CASCADE |

### 种子数据

- **3 个角色**: ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN
- **6 个权限**: user:read, user:write, user:delete, role:read, role:write, role:delete
- **权限映射**: ROLE_SUPER_ADMIN 拥有所有 6 个权限

### 索引策略

- `idx_users_username` / `idx_users_email`: 支持登录查询和唯一性校验
- `idx_users_status`: 支持按状态过滤用户列表
- `idx_user_roles_user_id` / `idx_user_roles_role_id`: 支持关联查询
- `idx_role_permissions_role_id` / `idx_role_permissions_permission_id`: 支持权限聚合
- `idx_user_credentials_user_id`: 支持凭证查询

### 影响范围

- 新增文件: `koduck-user/src/main/resources/db/migration/V1__init_user_schema.sql`
- 依赖: PostgreSQL 14+, Flyway 已在 Task 1.2 配置

### 兼容性影响

- 这是 V1 初始迁移，无向后兼容问题
- `status` 字段使用 SMALLINT（0/1/2）而非 ENUM，避免 PostgreSQL ENUM 类型修改的复杂性
- 所有时间字段使用 TIMESTAMP，JPA 映射为 LocalDateTime

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 3.1 节
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md) Task 2.1
- [koduck-user-api.yaml](../design/koduck-user-api.yaml)

---

## 备注

- Flyway 命名规范: `V{version}__{description}.sql`，版本号从 1 开始
- `ON DELETE CASCADE` 策略: 删除用户时自动清理关联的角色、权限映射和凭证
- `user_credentials.environment` 支持 PRODUCTION/STAGING 等环境隔离

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
