# ADR-0091: 重构 UserInfo 为接口契约 + 泛型支持

- Status: Accepted
- Date: 2026-04-04
- Issue: #476

## Context

当前 koduck 项目的用户模型设计存在可扩展性问题：

1. **UserInfo 是具体类**：新项目需要扩展用户信息时，必须继承 `UserBaseInfo`，导致紧耦合
2. **鉴权逻辑绑定具体类**：`koduck-auth` 的鉴权逻辑依赖 `UserBaseInfo`，无法识别扩展字段（如 `tenantId`）
3. **无法零侵入扩展**：新项目无法在不修改 `koduck-common` 源码的情况下自定义用户模型

### 典型场景

假设新项目需要多租户支持：

```java
// 新项目想添加 tenantId
@Data
public class TenantUser extends UserBaseInfo {  // 必须继承！
    private Long tenantId;  // 扩展字段
}

// 问题：koduck-auth 的鉴权逻辑不认识 tenantId
// 必须修改 koduck-common 源码才能支持
```

## Decision

将用户模型从**具体类**重构为**接口契约 + 泛型**。

### 架构变更

**Before（紧耦合）**:
```
koduck-common: UserBaseInfo (具体类)
       ↑
koduck-auth: 鉴权逻辑依赖 UserBaseInfo
       ↑
新项目: 必须继承 UserBaseInfo
```

**After（松耦合）**:
```
koduck-common: UserPrincipal (接口契约)
       ↑
koduck-auth: AuthService<U extends UserPrincipal> (泛型)
       ↑
新项目: 实现 UserPrincipal 接口即可
```

### 核心变更

| 组件 | Before | After |
|------|--------|-------|
| koduck-common | `UserBaseInfo` 类 | `UserPrincipal` 接口 |
| koduck-auth | `AuthService` | `AuthService<U extends UserPrincipal>` |
| koduck-auth | 无默认实现 | `AuthUserPrincipal` 默认实现 |
| koduck-core | `UserInfo` 类 | 使用 `AuthUserPrincipal` |

### 接口设计

```java
// koduck-common: 最小接口契约
public interface UserPrincipal {
    Long getId();
    String getUsername();
    Collection<? extends GrantedAuthority> getAuthorities();
    
    // 默认实现
    default boolean isEnabled() { return true; }
    default boolean isAccountNonExpired() { return true; }
    default boolean isAccountNonLocked() { return true; }
    default boolean isCredentialsNonExpired() { return true; }
}
```

```java
// koduck-auth: 默认实现
public class AuthUserPrincipal implements UserPrincipal {
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private List<String> roles;
    // ... 完整字段
}
```

```java
// 新项目：完全自定义，零继承
public class TenantUser implements UserPrincipal {
    private Long id;
    private String username;
    private Long tenantId;      // 自定义字段
    private String tenantName;  // 自定义字段
    
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // 自定义权限逻辑
    }
}
```

## Consequences

### 正向影响

1. **真正的可扩展性**：新项目只需实现接口，无需继承 koduck 的任何类
2. **零耦合**：新项目用户模型与 koduck 完全解耦
3. **向后兼容**：提供默认实现 `AuthUserPrincipal`，现有代码无缝迁移
4. **类型安全**：泛型保证编译时类型检查

### 代价与风险

1. **破坏性变更**：`UserInfo` 类将被删除，需要修改引用代码
2. **迁移成本**：需要更新 `TokenResponse`、`AuthService` 等使用泛型
3. **复杂度增加**：引入了泛型参数，代码阅读难度略有增加

### 兼容性影响

| 方面 | 影响 | 缓解措施 |
|------|------|----------|
| API 兼容性 | ❌ 破坏 | 提供迁移指南 |
| 数据库兼容性 | ✅ 无影响 | Entity 不变 |
| 行为兼容性 | ✅ 无影响 | 默认实现保持行为一致 |

## Alternatives Considered

1. **保持现状（继承方案）**
   - 拒绝：无法满足新项目扩展需求

2. **抽象类方案**
   - 拒绝：仍然强制继承，不够灵活

3. **接口 + 泛型（选中）**
   - 优点：完全解耦，类型安全
   - 缺点：迁移成本高，但一次性投入

## Implementation Plan

1. koduck-common: 创建 `UserPrincipal` 接口
2. koduck-auth: 创建 `AuthUserPrincipal` 默认实现
3. koduck-auth: 重构 `AuthService` 为泛型
4. koduck-auth: 重构 `TokenResponse` 为泛型
5. koduck-core: 删除 `UserInfo`，使用 `AuthUserPrincipal`
6. 运行质量门禁验证

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `koduck-backend/scripts/quality-check.sh` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- 所有现有测试通过
