# ADR-0005: Entity 映射与 Repository 层实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #683, docs/design/koduck-auth-user-service-design.md 2.2/3.1/6.1 节, ADR-0003

---

## 背景与问题陈述

koduck-user 服务需要将数据库表映射为 JPA Entity，并通过 Spring Data Repository 提供类型安全的数据访问能力。这是 Service 层（Task 3.2）和 Controller 层（Task 4.x）的前置依赖。

### 上下文

- **数据库**: PostgreSQL 14+，Flyway 管理 schema（V1__init_user_schema.sql 已就绪）
- **ORM**: Spring Data JPA（Hibernate）
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 2.2 节（代码结构）、3.1 节（数据库设计）、6.1 节（核心代码）
- **前置**: Task 2.1（DB migration）✅, Task 2.3（DTO）✅

---

## 决策驱动因素

1. **Schema 对齐**: Entity 字段必须与 Flyway migration 定义的表结构完全一致
2. **关联映射**: 用户-角色-权限的多对多关系需要通过中间表正确映射
3. **枚举策略**: 用户状态 SMALLINT 需要映射为 Java 枚举，使用 `@Enumerated(ORDINAL)` 对齐数据库存储
4. **级联策略**: 数据库已定义 `ON DELETE CASCADE`，JPA 需要配合配置
5. **查询能力**: Repository 需覆盖设计文档 6.1 节的核心查询场景（搜索、分页、权限聚合）
6. **审计字段**: `updated_at` 由数据库触发器管理，Entity 层不应覆盖

---

## 考虑的选项

### 选项 1: 使用 JPA 关联注解（@OneToMany/@ManyToOne）

**描述**: 在 Entity 中使用 JPA 关联注解定义表间关系

**优点**:
- 面向对象，导航式访问（`user.getRoles()`）
- Hibernate 自动管理关联状态
- 适合复杂业务场景

**缺点**:
- N+1 查询风险，需要 `@EntityGraph` 或 `JOIN FETCH` 优化
- 双向关联维护复杂
- JSON 序列化容易产生循环引用

### 选项 2: 仅 ID 关联，手动查询（选定）

**描述**: Entity 仅持有外键 ID，不使用 JPA 关联注解，通过 Repository 手动查询关联数据

**优点**:
- 查询行为完全可控，无 N+1 风险
- Entity 结构简单，序列化安全
- 与设计文档 6.1 节的 UserServiceImpl 实现方式一致（通过 Repository 分别查询）
- 更适合微服务场景（单一职责）

**缺点**:
- 无法通过 Entity 直接导航关联
- 关联操作需要在 Service 层组合

### 选项 3: 混合方案（关联注解 + LAZY 加载）

**描述**: 定义关联注解但全部使用 LAZY 加载，按需获取

**优点**:
- 保留导航能力
- 避免不必要的加载

**缺点**:
- LAZY 加载在 `@Transactional` 外会抛 `LazyInitializationException`
- 仍然需要处理序列化问题
- 增加了隐式复杂度

---

## 决策结果

**选定的方案**: 选项 2 - 仅 ID 关联，手动查询

**理由**:

1. **与设计文档一致**: `UserServiceImpl` 中通过 `userRoleRepository.findPermissionsByUserId()` 等方法分别查询，不依赖关联导航
2. **微服务适用性**: koduck-user 作为独立服务，Repository 查询应简单明确，避免隐式加载
3. **性能可控**: 所有查询通过显式方法定义，便于分析和优化
4. **序列化安全**: Entity 不会因关联导致循环引用

**积极后果**:
- Entity 结构简单，与数据库表一一对应
- 查询行为可预测，无隐式 SQL 发送
- 易于编写和测试

**消极后果**:
- Service 层需要手动组合关联数据
- 无法通过 `user.getRoles()` 直接获取角色

**缓解措施**:
- Repository 提供便捷的聚合查询方法（如 `findPermissionsByUserId`）
- 后续通过 MapStruct 在 Service 层完成 Entity → DTO 的组合转换

---

## 实施细节

### Entity 设计

| Entity | 表名 | 主键类型 | 说明 |
|--------|------|----------|------|
| `User` | `users` | `Long` (BIGSERIAL) | 使用 `@GeneratedValue(strategy = IDENTITY)` |
| `Role` | `roles` | `Integer` (SERIAL) | 使用 `@GeneratedValue(strategy = IDENTITY)` |
| `Permission` | `permissions` | `Integer` (SERIAL) | 使用 `@GeneratedValue(strategy = IDENTITY)` |
| `UserRole` | `user_roles` | `Long` (BIGSERIAL) | 关联表，持有 userId/roleId |
| `RolePermission` | `role_permissions` | `Long` (BIGSERIAL) | 关联表，持有 roleId/permissionId |
| `UserCredential` | `user_credentials` | `Long` (BIGSERIAL) | 多因素认证凭证 |

### 枚举设计

```java
public enum UserStatus {
    DISABLED(0), ACTIVE(1), PENDING(2);
    // ORDINAL 映射对应数据库 SMALLINT
}
```

### Repository 设计

| Repository | 关键方法 | 说明 |
|------------|----------|------|
| `UserRepository` | `findByUsername`, `findByEmail`, `existsByEmail`, `existsByUsername`, `findByUsernameContainingOrEmailContaining`, `findByStatus`, `updateLastLogin` | 覆盖设计文档 6.1 节所有查询场景 |
| `RoleRepository` | `findById`, `findByName` | 基础查询 |
| `PermissionRepository` | `findAll`, `findById` | 基础查询 |
| `UserRoleRepository` | `existsByUserIdAndRoleId`, `findByUserId`, `deleteByUserIdAndRoleId`, `findRoleIdsByUserId`, `findPermissionsByUserId` | 关联查询与幂等检查 |
| `RolePermissionRepository` | `findByRoleId`, `deleteByRoleId`, `saveAll` | 角色权限管理 |

### 关键设计决策

1. **主键策略**: 使用 `IDENTITY` 策略，让数据库自动生成序列值
2. **审计字段**: `created_at` 和 `updated_at` 使用 `@CreationTimestamp` 和 `@UpdateTimestamp`，但 `updated_at` 同时由数据库触发器管理（双重保障）
3. **不可变 ID**: 关联表（user_roles, role_permissions）的 userId/roleId 不提供 setter
4. **查询方法命名**: 遵循 Spring Data JPA 方法命名约定，无需额外 `@Query` 注解（除 `updateLastLogin` 和 `findPermissionsByUserId`）

### 兼容性影响

- Entity 和 Repository 为新增文件，不影响现有代码
- `UserStatus` 枚举的 ORDINAL 值必须与数据库 SMALLINT 值一致（0/1/2）
- `updateLastLogin` 使用 `@Modifying @Query`，需要 `@Transactional` 配合

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 2.2/3.1/6.1 节
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md) Task 2.2/3.1
- [ADR-0003](./ADR-0003-user-db-schema-migration.md) - 数据库 Schema 参考
- [ADR-0004](./ADR-0004-dto-structure-definition.md) - DTO 结构参考

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
