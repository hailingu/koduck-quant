# ADR-0007: RoleService / PermissionService 实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #687, docs/design/koduck-auth-user-service-design.md 4.1.2/4.1.3 节, ADR-0006

---

## 背景与问题陈述

koduck-user 服务需要实现 RoleService 和 PermissionService 层，为角色管理（CRUD + 权限分配）和权限读取提供业务逻辑。该层是 Phase 4 角色与权限 Controller 的直接依赖。

### 上下文

- **前置**: Task 3.2（UserService）✅, Task 3.1（Repository）✅, Task 2.3（DTO）✅
- **设计参考**: `koduck-auth-user-service-design.md` 4.1.2/4.1.3 节定义了角色与权限 API
- **API 规范**: `koduck-user-api.yaml` 定义了完整的请求/响应契约
- **Repository 层**: `RoleRepository`、`PermissionRepository`、`RolePermissionRepository`、`UserRoleRepository` 已实现

---

## 决策驱动因素

1. **服务分离**: Role 和 Permission 是否使用独立 Service 接口
2. **高风险操作保护**: 删除系统保留角色（ROLE_USER/ROLE_ADMIN/ROLE_SUPER_ADMIN）的策略
3. **用户关联检查**: 删除角色前需检查是否仍有用户关联
4. **权限全量替换**: 设置角色权限采用全量替换而非增量更新，避免状态不一致
5. **事务一致性**: 角色权限替换需要在同一事务中完成删除和新增

---

## 考虑的选项

### 选项 1: RoleService + PermissionService 独立接口（选定）

**描述**: 创建 `RoleService` 接口负责角色 CRUD 和权限分配，创建 `PermissionService` 接口负责权限查询

**优点**:
- 职责清晰，角色管理与权限查询分离
- 与设计文档 2.2 节代码结构一致（`service/RoleService.java`、`service/PermissionService.java`）
- Controller 层各自注入对应 Service

**缺点**:
- PermissionService 方法较少（仅 2 个），显得较薄

### 选项 2: 合并为 RbacService

**描述**: 将角色和权限管理合并到一个 `RbacService` 中

**优点**:
- 减少类数量

**缺点**:
- 违背设计文档的代码结构定义
- 职责不够清晰

---

## 决策结果

**选定的方案**: 选项 1 - RoleService + PermissionService 独立接口

**理由**:

1. **与设计文档一致**: 设计文档 2.2 节明确列出 `service/RoleService.java` 和 `service/PermissionService.java`
2. **职责分离**: 角色管理涉及 CRUD + 权限分配，逻辑较重；权限查询以只读为主
3. **Controller 对齐**: Phase 4 将有 `RoleController` 和 `PermissionController`，Service 分离便于对应

**积极后果**:
- 职责清晰，便于维护
- 与设计文档完全对齐

**消极后果**:
- PermissionService 较薄

**缓解措施**:
- PermissionService 预留扩展空间（如未来权限分组、权限搜索等）

---

## 实施细节

### RoleService 接口设计

```java
public interface RoleService {
    List<RoleInfo> listRoles();
    RoleDetailResponse getRoleById(Integer roleId);
    RoleResponse createRole(CreateRoleRequest request);
    RoleResponse updateRole(Integer roleId, UpdateRoleRequest request);
    void deleteRole(Integer roleId);
    void setRolePermissions(Integer roleId, SetRolePermissionsRequest request);
    List<PermissionInfo> getRolePermissions(Integer roleId);
}
```

### PermissionService 接口设计

```java
public interface PermissionService {
    List<PermissionInfo> listPermissions();
    List<String> getUserPermissions(Long userId);
}
```

### 保护策略

| 策略 | 实现方式 | 说明 |
|------|----------|------|
| 系统保留角色 | `Set<String> PROTECTED_ROLES` 常量 | ROLE_USER, ROLE_ADMIN, ROLE_SUPER_ADMIN 不可删除 |
| 用户关联检查 | `UserRoleRepository.findByUserId` | 删除前查询是否存在关联用户 |
| 角色名唯一性 | `RoleRepository.existsByName` | 创建/更新时检查 |
| 权限全量替换 | 先 `deleteByRoleId`，再批量插入 | 同一事务内完成 |

### 新增异常类

| 异常类 | HTTP 状态码 | 场景 |
|--------|-------------|------|
| `RoleAlreadyExistsException` | 409 | 角色名已存在 |
| `ProtectedRoleException` | 400 | 尝试删除系统保留角色 |
| `RoleHasUsersException` | 400 | 角色仍有用户关联 |

### 事务边界

| 方法 | 事务类型 | 说明 |
|------|----------|------|
| `listRoles` | `readOnly = true` | 仅查询 |
| `getRoleById` | `readOnly = true` | 查询 + 权限关联 |
| `createRole` | 读写 | 新增角色 |
| `updateRole` | 读写 | 更新角色 |
| `deleteRole` | 读写 | 删除角色 + 关联清理 |
| `setRolePermissions` | 读写 | 全量替换权限 |
| `getRolePermissions` | `readOnly = true` | 仅查询 |
| `listPermissions` | `readOnly = true` | 仅查询 |
| `getUserPermissions` | `readOnly = true` | 仅查询 |

### 兼容性影响

- 新增文件，不影响现有 UserService/Repository 代码
- 异常类需与后续 Controller 层的 `@ControllerAdvice` 配合
- `setRolePermissions` 的全量替换语义需在 API 文档中明确

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 4.1.2/4.1.3 节
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md) Task 3.3
- [ADR-0006](./ADR-0006-user-service-implementation.md) - UserService 实现参考

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
