# ADR-0006: UserService 与业务规则实现

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #685, koduck-user/docs/design/koduck-auth-user-service-design.md 6.1 节, ADR-0005

---

## 背景与问题陈述

koduck-user 服务需要实现 UserService 层，作为 Entity/Repository（数据层）与 Controller（接口层）之间的业务逻辑桥梁。该层需要覆盖公开 API（用户自身操作、管理员操作）和内部 API（供 koduck-auth 调用）的全部业务流程。

### 上下文

- **前置**: Task 2.1（DB migration）✅, Task 2.2（Entity）✅, Task 2.3（DTO）✅, Task 3.1（Repository）✅
- **架构决策**: ADR-0005 确定使用"仅 ID 关联，手动查询"方案，Service 层需通过多个 Repository 组合数据
- **设计参考**: `koduck-auth-user-service-design.md` 6.1 节提供了 `UserServiceImpl` 的参考实现

---

## 决策驱动因素

1. **接口分离**: 公开 API 与内部 API 方法在同一个 Service 中，需要清晰区分职责边界
2. **事务管理**: 读操作使用 `readOnly = true`，写操作需要完整事务保证
3. **业务规则**: 邮箱变更重验证、角色分配幂等、用户名/邮箱唯一性校验
4. **异常语义**: 需要定义清晰的业务异常层次（用户不存在、角色不存在、资源冲突等）
5. **DTO 转换**: Entity → DTO 的映射逻辑集中在 Service 层（当前阶段手动转换，后续可引入 MapStruct）

---

## 考虑的选项

### 选项 1: 单一 UserService 覆盖全部方法

**描述**: 将公开 API 和内部 API 的所有方法放在一个 `UserService` 接口中

**优点**:
- 简单直接，与设计文档 6.1 节一致
- Controller 层只需注入一个 Service
- 减少类数量

**缺点**:
- 接口较大（约 12 个方法）
- 公开方法和内部方法耦合在同一接口

### 选项 2: 拆分为 PublicUserService + InternalUserService（选定）

**描述**: 将公开 API 和内部 API 方法拆分到两个 Service 接口中

**优点**:
- 职责更清晰，符合单一职责原则
- 内部 API 可以独立演进
- Controller 层各自注入对应 Service

**缺点**:
- 共享逻辑（如 getUserRoles、findUserById）需要抽取到公共位置
- 增加了类的数量

### 选项 3: 按领域拆分（UserQueryService + UserCommandService）

**描述**: 按读写操作拆分

**优点**:
- CQRS 风格，读写天然分离

**缺点**:
- 过度设计，当前场景不需要
- 与设计文档差异较大

---

## 决策结果

**选定的方案**: 选项 1 - 单一 UserService 覆盖全部方法

**理由**:

1. **与设计文档一致**: 设计文档 6.1 节明确使用单一 `UserService` + `UserServiceImpl`
2. **方法数量可控**: 约 12 个方法，尚未达到需要拆分的复杂度
3. **共享逻辑简单**: 公开和内部 API 共享用户查找、角色查询等基础能力，拆分反而增加重复
4. **演进成本低**: 后续如需拆分，可基于现有实现直接提取接口

**积极后果**:
- 实现简单，与设计文档对齐
- Controller 层依赖简单

**消极后果**:
- 接口略大，但随着服务稳定后不会继续膨胀

**缓解措施**:
- 方法按功能分组，接口文档清晰标注公开/内部
- 后续如需拆分，接口已有良好分组基础

---

## 实施细节

### Service 接口设计

```java
public interface UserService {

    // === 公开 API: 当前用户 ===
    UserProfileResponse getCurrentUser(Long currentUserId);
    UserProfileResponse updateProfile(Long currentUserId, UpdateProfileRequest request);
    List<String> getCurrentUserPermissions(Long currentUserId);

    // === 公开 API: 管理员 ===
    PageResponse<UserSummaryResponse> searchUsers(String keyword, String status, Pageable pageable);
    UserProfileResponse getUserById(Long userId);
    UserProfileResponse updateUser(Long userId, UpdateUserRequest request);
    void deleteUser(Long userId);
    void assignRole(Long userId, Integer roleId);
    void removeRole(Long userId, Integer roleId);

    // === 内部 API ===
    Optional<UserDetailsResponse> findByUsername(String username);
    Optional<UserDetailsResponse> findByEmail(String email);
    UserDetailsResponse createUser(CreateUserRequest request);
    void updateLastLogin(Long userId, LastLoginUpdateRequest request);
    List<String> getUserRoles(Long userId);
    List<String> getUserPermissions(Long userId);
}
```

### 自定义异常设计

| 异常类 | HTTP 状态码 | 场景 |
|--------|-------------|------|
| `UserNotFoundException` | 404 | 用户 ID/username/email 查询无结果 |
| `RoleNotFoundException` | 404 | 角色名称/ID 查询无结果 |
| `EmailAlreadyExistsException` | 409 | 邮箱已被其他用户使用 |
| `UsernameAlreadyExistsException` | 409 | 用户名已存在（创建用户时） |

所有自定义异常继承 `RuntimeException`，通过 `@ControllerAdvice` 全局处理。

### 事务边界

| 方法 | 事务类型 | 说明 |
|------|----------|------|
| `getCurrentUser` | `readOnly = true` | 仅查询 |
| `updateProfile` | 读写 | 可能修改 email、nickname |
| `searchUsers` | `readOnly = true` | 分页查询 |
| `getUserById` | `readOnly = true` | 仅查询 |
| `assignRole` | 读写 | 插入 user_roles |
| `removeRole` | 读写 | 删除 user_roles |
| `deleteUser` | 读写 | 删除用户（级联） |
| `createUser` | 读写 | 新增用户 |
| `updateLastLogin` | 读写 | 更新登录信息 |
| `getUserRoles` | `readOnly = true` | 仅查询 |
| `getUserPermissions` | `readOnly = true` | 仅查询 |
| `findByUsername/Email` | `readOnly = true` | 仅查询 |

### 关键业务规则

1. **邮箱变更重验证**: `updateProfile` 中检测 email 变更后，置空 `emailVerifiedAt`
2. **角色分配幂等**: `assignRole` 先检查 `existsByUserIdAndRoleId`，已存在则直接返回
3. **用户名/邮箱唯一性**: `createUser` 时检查 `existsByUsername` 和 `existsByEmail`
4. **DTO 转换**: Entity → DTO 在 Service 层完成，手动映射（后续可引入 MapStruct）

### 兼容性影响

- 新增文件，不影响现有代码
- 异常类需与后续 Controller 层的 `@ControllerAdvice` 配合
- `UserStatus` 枚举使用 `name()` 而非 `ordinal()` 进行字符串转换，确保可读性

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 6.1 节
- [koduck-user-api.yaml](../design/koduck-user-api.yaml)
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md) Task 3.2
- [ADR-0005](./ADR-0005-entity-repository-implementation.md) - Entity/Repository 层参考

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
