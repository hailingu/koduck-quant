# ADR-0004: JPA Entity 映射策略

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #679, docs/design/koduck-auth-user-service-design.md 2.2 节、3.1 节

---

## 背景与问题陈述

koduck-user 服务的数据库 schema 已通过 `V1__init_user_schema.sql` 建立（ADR-0003），现在需要将 6 张数据库表映射为 JPA Entity 类。需要在多个映射策略间做出决策，确保 Entity 与数据库 schema 精确对齐，同时兼顾类型安全、审计字段管理和关联关系处理。

### 上下文

- **业务背景**: 用户管理服务需要精确映射 RBAC 数据模型（6 张表）
- **技术背景**: Spring Boot 3.4.2 + Spring Data JPA + Hibernate 6.x + Lombok + Java 23
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 2.2 节定义的代码结构和 3.1 节的数据库设计

---

## 决策驱动因素

1. **Schema 对齐**: Entity 字段必须与 `V1__init_user_schema.sql` 精确匹配，`ddl-auto: validate` 不可失败
2. **类型安全**: 状态枚举映射需要类型安全且与数据库 SMALLINT 兼容
3. **审计字段一致性**: `created_at`/`updated_at` 由数据库触发器自动管理，Entity 需正确处理只读/读写语义
4. **级联删除对齐**: JPA 级联策略必须与数据库 `ON DELETE CASCADE` 保持一致，避免 Hibernate 与数据库行为冲突
5. **代码简洁性**: 利用 Lombok 减少样板代码，利用 JPA Auditing 管理审计字段

---

## 考虑的选项

### 选项 1: ORDINAL 枚举映射

**描述**: 使用 `@Enumerated(EnumType.ORDINAL)` 将枚举映射为数据库整数

**优点**:
- 与数据库 `status SMALLINT` 直接对应，无需额外转换
- 存储紧凑（单字节/双字节）
- 与种子数据和现有查询一致

**缺点**:
- 枚举值顺序不可变，新增中间值会导致数据错乱
- 数据库中直接查看数字不直观

### 选项 2: STRING 枚举映射

**描述**: 使用 `@Enumerated(EnumType.STRING)` 将枚举映射为数据库字符串

**优点**:
- 数据库中直接可读
- 枚举顺序变更不影响已有数据

**缺点**:
- 与现有 `status SMALLINT` 数据库定义不匹配
- 需要修改迁移脚本，引入向后兼容风险
- 存储空间略大

### 选项 3: 自定义 Converter（`AttributeConverter`）

**描述**: 实现自定义 `AttributeConverter<UserStatus, Short>` 做双向转换

**优点**:
- 完全控制映射逻辑，不依赖枚举声明顺序
- 可以处理边界值和 null

**缺点**:
- 增加代码复杂度
- 每个枚举类型都需要一个 Converter 类
- 对当前简单枚举（3 个值）来说过度设计

---

## 决策结果

**选定的方案**: 选项 1 - ORDINAL 枚举映射 + JPA Auditing 审计字段

**理由**:

1. **Schema 对齐优先**: 数据库已使用 SMALLINT（0/1/2），ORDINAL 映射零成本对齐
2. **枚举稳定**: UserStatus 仅 3 个值（DISABLED/ACTIVE/PENDING），短期内不会变更顺序
3. **JPA Auditing**: 利用 `@CreatedDate` + `@LastModifiedDate` + `@EnableJpaAuditing` 管理审计字段，与数据库 `DEFAULT CURRENT_TIMESTAMP` 触发器形成双保险
4. **Lombok Builder**: 使用 `@Builder` + `@NoArgsConstructor` + `@AllArgsConstructor` 简化 Entity 创建
5. **级联策略**: 关联表（UserRole、RolePermission、UserCredential）使用 `CascadeType.ALL` + `FetchType.LAZY`，与数据库 `ON DELETE CASCADE` 对齐

**积极后果**:

- Entity 与数据库 schema 完全对齐，`ddl-auto: validate` 可通过
- 枚举类型安全，避免硬编码数字
- 审计字段由 JPA Auditing 自动管理，减少手动设置遗漏
- Lombok Builder 模式简化 Entity 构造

**消极后果**:

- ORDINAL 映射在枚举值中间插入新值时需要创建新迁移脚本
- JPA Auditing 与数据库触发器双写，`updated_at` 以触发器为准（数据库层最后执行）

**缓解措施**:

- 枚举值定义时保留文档注释，明确 ordinal 对应关系
- 新增状态值时追加到末尾或使用数据库迁移脚本统一更新
- JPA Auditing 仅作为应用层兜底，数据库触发器作为最终保障

---

## 实施细节

### Entity 设计总览

| Entity | 表名 | 主键策略 | 关键关联 |
|--------|------|----------|----------|
| `User` | `users` | `GenerationType.IDENTITY` | 无直接 JPA 关联（通过 Repository 查询） |
| `Role` | `roles` | `GenerationType.IDENTITY` | 无直接 JPA 关联 |
| `Permission` | `permissions` | `GenerationType.IDENTITY` | 无直接 JPA 关联 |
| `UserRole` | `user_roles` | `GenerationType.IDENTITY` | `@ManyToOne` -> User, Role |
| `RolePermission` | `role_permissions` | `GenerationType.IDENTITY` | `@ManyToOne` -> Role, Permission |
| `UserCredential` | `user_credentials` | `GenerationType.IDENTITY` | `@ManyToOne` -> User |

### 关联策略说明

- **User/Role/Permission**: 不定义 `@OneToMany` 到关联表，避免双向关联带来的 N+1 查询和级联操作复杂性
- **UserRole/RolePermission/UserCredential**: 使用 `@ManyToOne` + `@JoinColumn` + `@OnDelete(action = CASCADE)` 对齐数据库级联删除
- **查询聚合**: 通过 Repository 层的 JPQL/SQL 查询实现权限聚合，不依赖 JPA 实体导航

### 审计字段策略

- `created_at`: 使用 `@CreatedDate`，数据库层有 `DEFAULT CURRENT_TIMESTAMP` 兜底
- `updated_at`: 使用 `@LastModifiedDate`，数据库层有触发器兜底
- Entity 使用 `@EntityListeners(AuditingEntityListener.class)` 启用审计

### 影响范围

- 新增文件:
  - `entity/user/UserStatus.java` (枚举)
  - `entity/user/User.java`
  - `entity/user/Role.java`
  - `entity/user/Permission.java`
  - `entity/user/UserRole.java`
  - `entity/user/RolePermission.java`
  - `entity/user/UserCredential.java`
- 修改文件: 无（Entity 目录已存在，只有 .gitkeep）

### 兼容性影响

- 无向后兼容问题，这是首次创建 Entity
- JPA `ddl-auto: validate` 将验证 Entity 与 schema 一致性
- 不影响其他模块（koduck-user 是独立服务）

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 2.2 节、3.1 节
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md) Task 2.2
- [ADR-0003: user_db Schema 迁移设计](ADR-0003-user-db-schema-migration.md)

---

## 备注

- Lombok `@Builder` 与 JPA 无参构造器需要同时存在，使用 `@NoArgsConstructor` + `@AllArgsConstructor` 解决
- `@OnDelete(action = CASCADE)` 是 Hibernate 特有注解，用于 DDL 生成和 schema 验证，运行时级联由数据库约束保证
- `id` 字段使用 `GenerationType.IDENTITY` 对齐数据库 `BIGSERIAL`/`SERIAL`

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
