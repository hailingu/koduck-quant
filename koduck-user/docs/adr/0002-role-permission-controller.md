# ADR-0002: RoleController 与 PermissionController 实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #691, koduck-auth-user-service-design.md 4.1.2/4.1.3

---

## 背景与问题陈述

Task 4.2 需要实现角色管理 Controller（RoleController）和权限管理 Controller（PermissionController），将 RoleService/PermissionService 的能力暴露为 REST 端点。需要解决以下问题：

1. **权限校验方式**：设计文档要求 `role:read`、`role:write`、`role:delete` 等权限码控制端点访问，但当前 APISIX 仅透传角色名称（`X-Roles`），未透传权限码。
2. **职责划分**：角色管理端点（CRUD + 权限分配）和权限查询端点应分别放在独立的 Controller 中。

### 上下文

- **依赖**：Task 4.1（UserController）已完成，提供了 `UserContext`、`ApiResponse`、`GlobalExceptionHandler` 等基础设施
- **Service 层**：`RoleService`、`PermissionService` 及其实现类已完成
- **DTO 层**：角色和权限相关的请求/响应 DTO 已定义

---

## 决策驱动因素

1. **一致性**：复用 Task 4.1 的 `UserContext`、`ApiResponse`、异常处理模式
2. **可演进性**：权限校验逻辑应易于后续替换为更精细的方案
3. **简单性**：当前阶段不引入 Spring Security，权限校验保持轻量
4. **安全性**：权限校验必须在 Controller 层体现，不能完全依赖网关

---

## 考虑的选项

### 选项 1: 基于角色名称的静态权限映射

**描述**: 在 Controller 层通过 `UserContext.hasAnyRole()` 检查角色名称，将权限码映射到角色。

**优点**:
- 零额外依赖，无 DB 调用开销
- 实现简单，与现有 UserContext 一致
- SUPER_ADMIN/ADMIN 的角色判断逻辑清晰

**缺点**:
- 权限与角色的映射硬编码，新增角色需改代码
- 不支持动态权限配置

### 选项 2: 通过 PermissionService 查询权限

**描述**: 注入 PermissionService，每次请求调用 `getUserPermissions(userId)` 检查权限。

**优点**:
- 权限完全由数据库驱动，动态可配
- 与 RBAC 模型一致

**缺点**:
- 每个请求增加 DB 查询开销
- 需要缓存机制才能保证性能
- Controller 直接依赖 Service 的权限查询能力

### 选项 3: 引入 Spring Security `@PreAuthorize`

**描述**: 完整引入 Spring Security，使用 SpEL 表达式做方法级权限控制。

**优点**:
- 企业级方案，功能完善
- 声明式权限控制，代码简洁

**缺点**:
- 与当前阶段最小依赖原则冲突（ADR-0001）
- APISIX 已处理认证，Spring Security 价值有限

---

## 决策结果

**选定的方案**: 选项 1 - 基于角色名称的静态权限映射

**理由**:

1. **阶段匹配**：当前仅有 3 个系统角色（ROLE_USER、ROLE_ADMIN、ROLE_SUPER_ADMIN），静态映射完全够用
2. **零开销**：不引入 DB 查询，响应速度最优
3. **可演进**：后续 Task 6.2 可平滑迁移到选项 2 或 3
4. **一致性**：与 ADR-0001 的轻量级方案一脉相承

**映射规则**:
- `ROLE_SUPER_ADMIN` → 拥有所有权限
- `ROLE_ADMIN` → 拥有 role:read、role:write、role:delete、user:read、user:write、user:delete
- `ROLE_USER` → 无管理类权限

**积极后果**:
- 代码简洁，无额外依赖
- 性能最优，无 DB 开销
- 易于理解和维护

**消极后果**:
- 新增角色需要修改代码
- 权限粒度受限于角色级别

**缓解措施**:
- Task 6.2 中评估引入 `HandlerMethodArgumentResolver` 或 Spring Security
- 长期方案是将权限码加入 JWT claims，由 APISIX 透传

---

## 实施细节

### 端点规划

#### RoleController (`/api/v1/roles`)

| 方法 | 路径 | 权限 | Service 方法 |
|------|------|------|-------------|
| GET | /api/v1/roles | role:read | roleService.listRoles() |
| GET | /api/v1/roles/{roleId} | role:read | roleService.getRoleById() |
| POST | /api/v1/roles | role:write | roleService.createRole() |
| PUT | /api/v1/roles/{roleId} | role:write | roleService.updateRole() |
| DELETE | /api/v1/roles/{roleId} | role:delete | roleService.deleteRole() |
| GET | /api/v1/roles/{roleId}/permissions | role:read | roleService.getRolePermissions() |
| PUT | /api/v1/roles/{roleId}/permissions | role:write | roleService.setRolePermissions() |

#### PermissionController (`/api/v1/permissions`)

| 方法 | 路径 | 权限 | Service 方法 |
|------|------|------|-------------|
| GET | /api/v1/permissions | 已认证 | permissionService.listPermissions() |
| GET | /api/v1/users/{userId}/permissions | 已认证 | permissionService.getUserPermissions() |

### 影响范围

- 新增: `com.koduck.context.AccessControl` — 权限校验工具类
- 新增: `com.koduck.exception.AccessDeniedException` — 权限不足异常
- 新增: `com.koduck.controller.user.RoleController`
- 新增: `com.koduck.controller.user.PermissionController`
- 修改: `com.koduck.exception.GlobalExceptionHandler` — 新增 AccessDeniedException 处理

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md) 4.1.2/4.1.3
- [koduck-user-api.yaml](../../../docs/design/koduck-user-api.yaml)
- [ADR-0001](./0001-user-controller-header-context-and-error-handling.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
