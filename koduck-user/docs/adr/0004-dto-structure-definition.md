# ADR-0004: DTO 结构定义设计

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #681, koduck-user/docs/design/koduck-auth-user-service-design.md 4.1.4/4.2 节, koduck-user/docs/design/koduck-user-api.yaml

---

## 背景与问题陈述

koduck-user 服务需要定义完整的 DTO（Data Transfer Object）结构，用于公开 API 和内部 API 的请求/响应数据传输。DTO 是 Controller 层与 Service 层之间的数据契约，需要与 OpenAPI 规范 (`koduck-user-api.yaml`) 保持一致，并支持 Bean Validation 参数校验。

### 上下文

- **业务背景**: koduck-user 对外提供用户管理、角色权限管理 API，对内为 koduck-auth 等服务提供用户数据查询接口
- **技术背景**: 使用 Jakarta Validation (Bean Validation 3.0) 进行参数校验，Lombok 简化 POJO 代码，MapStruct 用于 Entity-DTO 转换
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 4.1.4 节（请求/响应定义）和 4.2 节（内部 API）

---

## 决策驱动因素

1. **API 契约一致性**: DTO 字段命名和结构必须与 `koduck-user-api.yaml` OpenAPI 规范完全对齐
2. **安全性分离**: 内部 API DTO（如 `UserDetailsResponse`）包含敏感字段（passwordHash），不应暴露给公开 API
3. **参数校验**: 请求 DTO 需要完整的 Bean Validation 注解，在 Controller 层完成参数校验
4. **序列化一致性**: 使用 Jackson 的 `@JsonProperty` 确保驼峰命名与 API 规范中的 snake_case / camelCase 对齐
5. **通用响应包装**: 统一 `ApiResponse<T>` 包装，保持响应格式一致性（code, message, data, timestamp）

---

## 考虑的选项

### 选项 1: 单一扁平 DTO 结构

**描述**: 所有 API 共享同一套 DTO，不区分公开/内部

**优点**:
- 结构简单，DTO 数量少
- 减少类文件数量

**缺点**:
- 内部 API 需要暴露 passwordHash 等敏感字段给公开 API
- 不同场景的校验规则难以区分
- 违反最小暴露原则

### 选项 2: 公开/内部 DTO 分离（选定）

**描述**: 公开 API 和内部 API 使用独立的 DTO 结构

**优点**:
- 公开 API 不暴露 passwordHash 等敏感字段
- 内部 API DTO 可包含完整用户信息供 koduck-auth 使用
- 校验注解可按场景定制
- 符合 API 规范中明确区分的公开/内部接口设计

**缺点**:
- DTO 数量较多
- Entity → DTO 转换需要多个映射方法

### 选项 3: 使用继承/组合复用 DTO

**描述**: 基础 DTO 通过继承或组合扩展出公开/内部变体

**优点**:
- 减少重复字段定义

**缺点**:
- 继承层次增加复杂性
- Jackson 序列化可能产生不期望的字段
- MapStruct 对继承结构的支持不如平铺结构直观

---

## 决策结果

**选定的方案**: 选项 2 - 公开/内部 DTO 分离

**理由**:

1. **安全隔离**: `UserDetailsResponse`（内部）包含 passwordHash，`UserProfileResponse`（公开）不包含，避免敏感信息泄露
2. **API 规范对齐**: `koduck-user-api.yaml` 中公开 API 和内部 API 的 schema 定义已经分离
3. **MapStruct 友好**: 平铺结构使 MapStruct 映射代码清晰直观
4. **校验隔离**: 公开 API 请求（如 `UpdateProfileRequest`）和内部 API 请求（如 `CreateUserRequest`）的校验规则不同

**积极后果**:

- 清晰的公开/内部 API 边界
- 敏感字段（passwordHash）仅在内部 DTO 中出现
- 每个DTO职责单一，易于维护

**消极后果**:
- DTO 文件数量较多（约 15 个）
- 部分 DTO 之间存在相似字段（如 UserProfileResponse 与 UserDetailsResponse 共享 id/username/email 等字段）

**缓解措施**:
- 使用 Lombok 减少样板代码
- 后续 Task 3.2 通过 MapStruct 自动生成 Entity ↔ DTO 转换代码
- 将 DTO 按用途分组到不同文件中（user、role、permission、common）

---

## 实施细节

### DTO 分类

| 分类 | DTO | 用途 |
|------|-----|------|
| **通用** | `ApiResponse<T>` | 统一响应包装 |
| **通用** | `PageResponse<T>` | 分页响应包装 |
| **用户 - 公开请求** | `UpdateProfileRequest` | 更新当前用户资料 |
| **用户 - 公开请求** | `ChangePasswordRequest` | 修改密码 |
| **用户 - 公开请求** | `UpdateUserRequest` | 管理员更新用户 |
| **用户 - 公开请求** | `UpdateUserStatusRequest` | 更新用户状态 |
| **用户 - 公开请求** | `AssignRoleRequest` | 分配角色 |
| **用户 - 公开响应** | `UserProfileResponse` | 用户详情（含角色） |
| **用户 - 公开响应** | `UserSummaryResponse` | 用户列表摘要 |
| **用户 - 公开响应** | `AvatarUploadResponse` | 头像上传结果 |
| **用户 - 内部** | `UserDetailsResponse` | 内部用户详情（含密码） |
| **用户 - 内部** | `CreateUserRequest` | 内部创建用户 |
| **用户 - 内部** | `LastLoginUpdateRequest` | 登录时间更新 |
| **角色** | `RoleInfo` | 角色基本信息 |
| **角色** | `RoleResponse` | 角色创建/更新响应 |
| **角色** | `RoleDetailResponse` | 角色详情（含权限） |
| **角色** | `CreateRoleRequest` | 创建角色 |
| **角色** | `UpdateRoleRequest` | 更新角色 |
| **角色** | `SetRolePermissionsRequest` | 设置角色权限 |
| **权限** | `PermissionInfo` | 权限信息 |

### 字段命名策略

- DTO 使用 camelCase（Java 标准）
- Jackson 默认序列化为 camelCase，与 API 规范一致
- 时间字段使用 `LocalDateTime`，Jackson 默认序列化为 ISO-8601 格式

### 校验注解策略

| 注解 | 应用场景 |
|------|----------|
| `@NotBlank` | 必填字符串字段 |
| `@Email` | 邮箱格式校验 |
| `@Size(min, max)` | 字符串长度限制 |
| `@NotNull` | 必填非字符串字段 |
| `@Pattern` | 格式校验（如状态枚举） |

### 文件组织

```
dto/user/
├── common/
│   ├── ApiResponse.java
│   └── PageResponse.java
├── user/
│   ├── UserProfileResponse.java
│   ├── UserSummaryResponse.java
│   ├── UserDetailsResponse.java
│   ├── UpdateProfileRequest.java
│   ├── ChangePasswordRequest.java
│   ├── UpdateUserRequest.java
│   ├── UpdateUserStatusRequest.java
│   ├── CreateUserRequest.java
│   ├── LastLoginUpdateRequest.java
│   ├── AssignRoleRequest.java
│   └── AvatarUploadResponse.java
├── role/
│   ├── RoleInfo.java
│   ├── RoleResponse.java
│   ├── RoleDetailResponse.java
│   ├── CreateRoleRequest.java
│   ├── UpdateRoleRequest.java
│   └── SetRolePermissionsRequest.java
└── permission/
    └── PermissionInfo.java
```

### 兼容性影响

- DTO 为新增文件，不影响现有代码
- `ApiResponse<T>` 和 `PageResponse<T>` 是后续所有 Controller 的基础响应结构
- 内部 API DTO 结构需与 koduck-auth 的调用契约对齐（附录 C 契约冻结表）

---

## 相关文档

- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 4.1.4/4.2 节
- [koduck-user-api.yaml](../design/koduck-user-api.yaml) components/schemas
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md) Task 2.3
- [ADR-0003](./ADR-0003-user-db-schema-migration.md) - Entity 字段参考

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
