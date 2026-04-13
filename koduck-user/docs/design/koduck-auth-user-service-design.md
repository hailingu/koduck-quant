# Koduck-User 独立服务设计方案

## 1. 概述

本文档基于 `koduck-user-jwt-design.md` 的架构设计，详细定义 koduck-user（用户管理）独立服务的设计方案、API 接口规范以及实现细节。

koduck-user 服务负责用户信息管理、角色权限管理，通过内部 API 向 koduck-auth 和其他服务提供用户数据支持。

> 说明：本文档中的用户与角色模型已按本项目文档中的 V1 多租户冻结语义更新。
> `tenant_id` 为最长 128 字符的字符串标识，跨服务身份语义统一为 `(tenant_id, user_id)`。

## 1.1 User 侧租户真值与隔离基线

从 `koduck-user` 视角，V1 多租户语义固定为以下约束：

1. `tenant_id` 的存储类型统一为 `VARCHAR(128)`，其真值由 `tenants.id` 与 `users.tenant_id` 承担。
2. 用户与角色唯一性按租户作用域收敛为 `unique (tenant_id, username)`、`unique (tenant_id, email)` 与 `unique (tenant_id, name)`。
3. `user_roles`、`role_permissions`、`user_credentials` 等关系表显式持有 `tenant_id`，避免安全与权限链路依赖运行时回表推断。
4. internal API 的统一租户上下文来源是 `X-Tenant-Id`；`CreateUserRequest`、`LastLoginUpdateRequest` 不在 body 中重复携带租户字段。
5. `UserDetailsResponse` 必须显式回传 `tenantId`，用于让调用方校验 header 上下文与用户真值一致。

User 侧多租户设计与实施入口统一收敛到以下文档：

- 语义冻结：`ADR-0017 freeze-tenant-id-semantics`
- 数据库与最小租户真值：`ADR-0018 add-tenant-columns-and-minimal-tenant-truth`
- 租户内唯一约束：`ADR-0019 switch-uniqueness-constraints-to-tenant-scope`
- Repository / internal API / UserContext：`ADR-0020`、`ADR-0021`、`ADR-0022`
- 网关透传与联调闭环：`ADR-0023`、`ADR-0024`、`ADR-0025`
- internal API 契约：`../contracts/koduck-auth-user-internal-api-contract.md`

---

## 2. 服务边界划分

### 2.1 职责定义

| 服务 | 核心职责 | 数据存储 | 端口 |
|------|----------|----------|------|
| **koduck-user** | 用户信息管理、角色权限管理、用户查询、资料更新 | user_db | 8082 |

### 2.2 代码结构

| 类型 | 路径 | 说明 |
|------|------|------|
| Controller | `controller/user/UserController.java` | 用户管理接口 |
| Controller | `controller/user/RoleController.java` | 角色管理接口 |
| Controller | `controller/user/PermissionController.java` | 权限管理接口 |
| Controller | `controller/user/InternalUserController.java` | 内部服务调用接口 |
| Service | `service/UserService.java` | 用户服务接口 |
| Service | `service/impl/UserServiceImpl.java` | 用户服务实现 |
| Service | `service/RoleService.java` | 角色服务接口 |
| Service | `service/PermissionService.java` | 权限服务接口 |
| Entity | `entity/user/User.java` | 用户实体 |
| Entity | `entity/user/Role.java` | 角色实体 |
| Entity | `entity/user/Permission.java` | 权限实体 |
| Entity | `entity/user/UserRole.java` | 用户角色关联 |
| Entity | `entity/user/RolePermission.java` | 角色权限关联 |
| Entity | `entity/user/UserCredential.java` | 用户凭证 |
| Repository | `repository/user/UserRepository.java` | 用户数据访问 |
| Repository | `repository/user/RoleRepository.java` | 角色数据访问 |
| Repository | `repository/user/PermissionRepository.java` | 权限数据访问 |
| Repository | `repository/user/UserRoleRepository.java` | 用户角色关联访问 |
| DTO | `dto/user/*` | 用户相关 DTO |

---

## 3. 数据库设计

### 3.1 user_db（koduck-user 专用）

```sql
-- 用户表
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    avatar_url VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1, -- 0: DISABLED, 1: ACTIVE, 2: PENDING
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, username),
    UNIQUE (tenant_id, email)
);

-- 角色表
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, name)
);

-- 权限表
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    resource VARCHAR(50),
    action VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 用户角色关联表
CREATE TABLE user_roles (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id, role_id)
);

-- 角色权限关联表
CREATE TABLE role_permissions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, role_id, permission_id)
);

-- 用户凭证表（支持多因素认证）
CREATE TABLE user_credentials (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_type VARCHAR(20) NOT NULL, -- PASSWORD, TOTP, FIDO2, etc.
    credential_value VARCHAR(255) NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_users_tenant_username ON users(tenant_id, username);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_roles_tenant_user_id ON user_roles(tenant_id, user_id);
CREATE INDEX idx_user_roles_tenant_role_id ON user_roles(tenant_id, role_id);
CREATE INDEX idx_role_permissions_tenant_role_id ON role_permissions(tenant_id, role_id);
CREATE INDEX idx_role_permissions_tenant_permission_id ON role_permissions(tenant_id, permission_id);
CREATE INDEX idx_user_credentials_tenant_user_id ON user_credentials(tenant_id, user_id);

-- 初始化数据
INSERT INTO roles (tenant_id, name, description) VALUES
    ('default', 'ROLE_USER', '普通用户'),
    ('default', 'ROLE_ADMIN', '管理员'),
    ('default', 'ROLE_SUPER_ADMIN', '超级管理员');

INSERT INTO permissions (code, name, resource, action) VALUES
    ('user:read', '查看用户', 'user', 'read'),
    ('user:write', '编辑用户', 'user', 'write'),
    ('user:delete', '删除用户', 'user', 'delete'),
    ('role:read', '查看角色', 'role', 'read'),
    ('role:write', '编辑角色', 'role', 'write'),
    ('role:delete', '删除角色', 'role', 'delete');

-- 为超级管理员分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions;
```

---

## 4. API 接口设计

### 4.1 公开 API

所有接口需要 JWT 认证（由 APISIX 统一处理）。

#### 4.1.1 用户管理接口

| 方法 | 路径 | 描述 | 权限要求 |
|------|------|------|----------|
| GET | `/api/v1/users/me` | 获取当前用户信息 | 已认证 |
| PUT | `/api/v1/users/me` | 更新当前用户信息 | 已认证 |
| PUT | `/api/v1/users/me/password` | 修改密码 | 已认证 |
| PUT | `/api/v1/users/me/avatar` | 上传头像 | 已认证 |
| DELETE | `/api/v1/users/me` | 注销账户 | 已认证 |
| GET | `/api/v1/users/{userId}` | 获取指定用户信息 | user:read |
| GET | `/api/v1/users` | 查询用户列表 | user:read |
| PUT | `/api/v1/users/{userId}` | 更新用户信息 | user:write |
| DELETE | `/api/v1/users/{userId}` | 删除用户 | user:delete |

#### 4.1.2 角色管理接口

| 方法 | 路径 | 描述 | 权限要求 |
|------|------|------|----------|
| GET | `/api/v1/roles` | 获取角色列表 | role:read |
| GET | `/api/v1/roles/{roleId}` | 获取角色详情 | role:read |
| POST | `/api/v1/roles` | 创建角色 | role:write |
| PUT | `/api/v1/roles/{roleId}` | 更新角色 | role:write |
| DELETE | `/api/v1/roles/{roleId}` | 删除角色 | role:delete |
| POST | `/api/v1/users/{userId}/roles` | 分配角色 | role:write |
| DELETE | `/api/v1/users/{userId}/roles/{roleId}` | 移除角色 | role:write |

#### 4.1.3 权限管理接口

| 方法 | 路径 | 描述 | 权限要求 |
|------|------|------|----------|
| GET | `/api/v1/permissions` | 获取权限列表 | 已认证 |
| GET | `/api/v1/users/{userId}/permissions` | 获取用户权限 | 已认证 |

#### 4.1.4 请求/响应定义

**GET /api/v1/users/me**

```java
// Response
public class UserProfileResponse {
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private String status;
    private LocalDateTime emailVerifiedAt;
    private LocalDateTime lastLoginAt;
    private List<RoleInfo> roles;
    private LocalDateTime createdAt;
}

public class RoleInfo {
    private Integer id;
    private String name;
    private String description;
}
```

**PUT /api/v1/users/me**

```java
// Request
public class UpdateProfileRequest {
    @Size(max = 50)
    private String nickname;
    
    @Email
    @Size(max = 100)
    private String email;  // 需要重新验证
}

// Response: UserProfileResponse
```

**GET /api/v1/users**

```java
// Query Parameters
// - keyword: 搜索关键词（用户名/邮箱）
// - status: 用户状态过滤
// - page: 页码（默认0）
// - size: 每页大小（默认20）
// - sort: 排序字段（createdAt, username等）

// Response: PageResponse<UserSummaryResponse>
public class UserSummaryResponse {
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String status;
    private LocalDateTime createdAt;
}
```

### 4.2 内部 API（服务间调用）

| 方法 | 路径 | 描述 | 调用方 |
|------|------|------|--------|
| GET | `/internal/users/by-username/{username}` | 根据用户名查询（需 `X-Tenant-Id`） | koduck-auth |
| GET | `/internal/users/by-email/{email}` | 根据邮箱查询（需 `X-Tenant-Id`） | koduck-auth |
| POST | `/internal/users` | 创建用户（注册回调，需 `X-Tenant-Id`） | koduck-auth |
| PUT | `/internal/users/{userId}/last-login` | 更新最后登录时间（需 `X-Tenant-Id`） | koduck-auth |
| GET | `/internal/users/{userId}/roles` | 获取用户角色（需 `X-Tenant-Id`） | koduck-auth |
| GET | `/internal/users/{userId}/permissions` | 获取用户权限（需 `X-Tenant-Id`） | koduck-auth, 其他服务 |

---

## 5. 服务间通信设计

### 5.1 koduck-auth 调用 koduck-user（被调用方）

koduck-user 提供内部 API 供 koduck-auth 调用：

```java
/**
 * koduck-user 内部 API 实现（供 koduck-auth 调用）
 */
@RestController
@RequestMapping("/internal")
public class InternalUserController {
    
    private final UserService userService;
    
    public InternalUserController(UserService userService) {
        this.userService = userService;
    }
    
    /**
     * 根据用户名查询用户
     */
    @GetMapping("/users/by-username/{username}")
    public ResponseEntity<UserDetailsResponse> findByUsername(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String username,
            @RequestHeader(value = "X-Consumer-Username", required = false) String consumer) {
        return userService.findByUsername(tenantId, username)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 根据邮箱查询用户
     */
    @GetMapping("/users/by-email/{email}")
    public ResponseEntity<UserDetailsResponse> findByEmail(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable String email) {
        return userService.findByEmail(tenantId, email)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 创建用户（注册回调）
     */
    @PostMapping("/users")
    public ResponseEntity<UserDetailsResponse> createUser(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @RequestBody @Valid CreateUserRequest request) {
        UserDetailsResponse user = userService.createUser(tenantId, request);
        return ResponseEntity.ok(user);
    }
    
    /**
     * 更新最后登录时间
     */
    @PutMapping("/users/{userId}/last-login")
    public ResponseEntity<Void> updateLastLogin(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable Long userId,
            @RequestBody LastLoginUpdateRequest request) {
        userService.updateLastLogin(tenantId, userId, request);
        return ResponseEntity.ok().build();
    }
    
    /**
     * 获取用户角色
     */
    @GetMapping("/users/{userId}/roles")
    public ResponseEntity<List<String>> getUserRoles(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable Long userId) {
        List<String> roles = userService.getUserRoles(tenantId, userId);
        return ResponseEntity.ok(roles);
    }
    
    /**
     * 获取用户权限
     */
    @GetMapping("/users/{userId}/permissions")
    public ResponseEntity<List<String>> getUserPermissions(
            @RequestHeader("X-Tenant-Id") String tenantId,
            @PathVariable Long userId) {
        List<String> permissions = userService.getUserPermissions(tenantId, userId);
        return ResponseEntity.ok(permissions);
    }
}
```

---

## 6. 核心代码实现

### 6.1 UserServiceImpl

```java
@Service
public class UserServiceImpl implements UserService {
    
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PermissionRepository permissionRepository;
    
    // 构造函数注入...
    
    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUser(Long currentUserId) {
        User user = userRepository.findById(currentUserId)
            .orElseThrow(() -> new UserNotFoundException(currentUserId));
        
        List<RoleInfo> roles = getUserRoles(user.getId());
        return buildUserProfileResponse(user, roles);
    }
    
    @Override
    @Transactional
    public UserProfileResponse updateProfile(Long currentUserId, UpdateProfileRequest request) {
        User user = userRepository.findById(currentUserId)
            .orElseThrow(() -> new UserNotFoundException(currentUserId));
        
        // 更新邮箱需要重新验证
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ValidationException("邮箱已被使用");
            }
            user.setEmail(request.getEmail());
            user.setEmailVerifiedAt(null);  // 需要重新验证
        }
        
        if (request.getNickname() != null) {
            user.setNickname(request.getNickname());
        }
        
        User saved = userRepository.save(user);
        List<RoleInfo> roles = getUserRoles(saved.getId());
        return buildUserProfileResponse(saved, roles);
    }
    
    @Override
    @Transactional(readOnly = true)
    public Page<UserSummaryResponse> searchUsers(UserSearchRequest request, Pageable pageable) {
        Page<User> users;
        
        if (StringUtils.hasText(request.getKeyword())) {
            users = userRepository.findByUsernameContainingOrEmailContaining(
                request.getKeyword(), request.getKeyword(), pageable);
        } else if (request.getStatus() != null) {
            users = userRepository.findByStatus(request.getStatus(), pageable);
        } else {
            users = userRepository.findAll(pageable);
        }
        
        return users.map(this::buildUserSummaryResponse);
    }
    
    @Override
    @Transactional
    public void assignRole(Long userId, String roleName) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
        
        Role role = roleRepository.findByName(roleName)
            .orElseThrow(() -> new RoleNotFoundException(roleName));
        
        // 检查是否已分配
        if (userRoleRepository.existsByUserIdAndRoleId(userId, role.getId())) {
            return;  // 已分配，幂等处理
        }
        
        UserRole userRole = UserRole.builder()
            .userId(userId)
            .roleId(role.getId())
            .build();
        
        userRoleRepository.save(userRole);
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<String> getUserPermissions(Long userId) {
        // 获取用户所有角色的权限
        return userRoleRepository.findPermissionsByUserId(userId);
    }
    
    // 内部 API 方法
    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByUsername(String tenantId, String username) {
        return userRepository.findByTenantIdAndUsername(tenantId, username)
            .map(this::buildUserDetailsResponse);
    }
    
    @Override
    @Transactional(readOnly = true)
    public Optional<UserDetailsResponse> findByEmail(String tenantId, String email) {
        return userRepository.findByTenantIdAndEmail(tenantId, email)
            .map(this::buildUserDetailsResponse);
    }
    
    @Override
    @Transactional
    public UserDetailsResponse createUser(String tenantId, CreateUserRequest request) {
        User user = User.builder()
            .tenantId(tenantId)
            .username(request.getUsername())
            .email(request.getEmail())
            .passwordHash(request.getPasswordHash())
            .nickname(request.getNickname())
            .status(User.UserStatus.valueOf(request.getStatus()))
            .build();
        
        User saved = userRepository.save(user);
        return buildUserDetailsResponse(saved);
    }
    
    @Override
    @Transactional
    public void updateLastLogin(String tenantId, Long userId, LastLoginUpdateRequest request) {
        userRepository.updateLastLogin(tenantId, userId, request.getLoginTime(), request.getIpAddress());
    }
    
    // ... 其他方法实现
}
```

---

## 7. 配置清单

### 7.1 application.yml

```yaml
server:
  port: 8082

spring:
  application:
    name: koduck-user
  datasource:
    url: jdbc:postgresql://${USER_DB_HOST:user-db}:${USER_DB_PORT:5432}/koduck_user
    username: ${USER_DB_USER:koduck}
    password: ${USER_DB_PASSWORD}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

tenant:
  default-id: ${KODUCK_DEFAULT_TENANT_ID:default}

# 文件存储（头像上传）
storage:
  avatar:
    provider: ${STORAGE_PROVIDER:local}  # local, s3, oss
    local:
      path: ${AVATAR_STORAGE_PATH:/data/avatars}
      base-url: ${AVATAR_BASE_URL:http://localhost:8082/avatars}
    s3:
      bucket: ${S3_BUCKET}
      region: ${S3_REGION}
      access-key: ${S3_ACCESS_KEY}
      secret-key: ${S3_SECRET_KEY}

# Actuator
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      probes:
        enabled: true
```

---

## 8. 部署配置

### 8.1 K8s Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: koduck-user
  namespace: koduck
  labels:
    app: koduck-user
spec:
  replicas: 2
  selector:
    matchLabels:
      app: koduck-user
  template:
    metadata:
      labels:
        app: koduck-user
    spec:
      containers:
        - name: koduck-user
          image: koduck/koduck-user:latest
          ports:
            - containerPort: 8082
              name: http
          env:
            - name: USER_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: user-db-secret
                  key: password
            - name: INTERNAL_API_KEY
              valueFrom:
                secretKeyRef:
                  name: koduck-user-internal
                  key: api-key
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8082
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8082
            initialDelaySeconds: 10
            periodSeconds: 5
```

### 8.2 K8s Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: koduck-user
  namespace: koduck
spec:
  type: ClusterIP
  selector:
    app: koduck-user
  ports:
    - port: 8082
      targetPort: 8082
      name: http
```

### 8.3 APISIX 路由配置

```bash
#!/bin/bash
# apisix-route-init-user.sh

ADMIN="http://apisix-admin:9180/apisix/admin"
KEY="X-API-KEY: ${ADMIN_KEY}"

# 1. 注册 koduck-user 为 Consumer（用于服务间调用）
echo "Registering koduck-user as Consumer"
curl -fsS -X PUT "${ADMIN}/consumers/koduck-user-consumer" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d "{
    \"username\": \"koduck-user-consumer\",
    \"plugins\": {
      \"key-auth\": {
        \"key\": \"${INTERNAL_API_KEY_USER}\"
      }
    }
  }"

# 2. koduck-user API（JWT 认证）
echo "Registering koduck-user API"
curl -fsS -X PUT "${ADMIN}/routes/user-service" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/api/v1/users/*",
    "priority": 90,
    "plugins": {
      "jwt-auth": {},
      "proxy-rewrite": {
        "headers": {
          "X-User-Id": "$jwt_claim_sub",
          "X-Username": "$jwt_claim_username",
          "X-Roles": "$jwt_claim_roles",
          "X-Tenant-Id": "$jwt_claim_tenant_id"
        }
      }
    },
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-user:8082": 1
      }
    }
  }'

# 3. koduck-user 内部 API（key-auth 保护）
echo "Registering koduck-user internal API"
curl -fsS -X PUT "${ADMIN}/routes/user-internal" \
  -H "$KEY" -H 'Content-Type: application/json' \
  -d '{
    "uri": "/internal/users/*",
    "priority": 100,
    "plugins": {
      "key-auth": {},
      "proxy-rewrite": {
        "headers": {
          "X-Consumer-Username": "$consumer_name",
          "apikey": ""
        }
      }
    },
    "upstream": {
      "type": "roundrobin",
      "nodes": {
        "koduck-user:8082": 1
      }
    }
  }'

echo "Routes registered successfully!"
```

---

## 9. 迁移计划

### 9.1 Phase 1: 准备阶段

1. **创建 koduck-user 模块**
   - 创建目录结构
   - 配置 pom.xml
   - 设置数据库迁移脚本

2. **数据迁移**
   - 导出现有用户数据
   - 导入到 user_db
   - 验证数据一致性

### 9.2 Phase 2: 服务实现

1. **实现 koduck-user 服务**
   - Entity、Repository 迁移
   - Service 实现
   - Controller 实现
   - 内部 API 实现

### 9.3 Phase 3: 集成测试

1. **本地测试**
   - Docker Compose 环境
   - 接口功能测试
   - 服务间调用测试

2. **K8s 测试**
   - 部署到测试环境
   - APISIX 路由配置
   - 端到端测试

### 9.4 Phase 4: 上线

1. **灰度发布**
   - 并行运行新旧服务
   - 流量逐步切换
   - 监控和回滚准备

2. **全量切换**
   - 切换所有流量
   - 下线旧服务
   - 清理临时资源

---

## 10. 相关文档

- `koduck-user-jwt-design.md` - JWT 架构设计
- `koduck-user-api.yaml` - HTTP REST API 规范
- `k8s/overlays/dev/apisix-route-init.yaml` - APISIX 路由配置

---

*文档版本: 1.0*  
*更新日期: 2026-04-07*  
*作者: Koduck Team*
