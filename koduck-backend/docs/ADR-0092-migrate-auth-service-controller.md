# ADR-0092: 迁移 Auth 相关组件到 koduck-auth 模块

- Status: Accepted
- Date: 2026-04-04
- Issue: #478

## Context

在之前的 ADR 中，我们已经迁移了 auth 的 entity、repository、dto 和 UserPrincipal 接口到 koduck-auth 模块。本次继续迁移其他 auth 相关组件。

## Decision

迁移以下组件到 koduck-auth 模块：

| 组件 | 原位置 | 新位置 | 说明 |
|------|--------|--------|------|
| AuthService 接口 | koduck-core | koduck-auth | 泛型化改造 |
| JwtConfig | koduck-core | koduck-auth | JWT 配置 |
| JwtUtil | koduck-core | koduck-auth | JWT 工具 |

### 未迁移组件（保留在 koduck-core）

| 组件 | 保留原因 |
|------|----------|
| AuthServiceImpl | 依赖 EmailService、RateLimiterService 等 koduck-core 服务 |
| AuthController | 依赖 koduck-core 的多个服务 |
| 异常类 | 依赖 Spring HttpStatus，koduck-common 无 Spring 依赖 |

### AuthService 泛型化

```java
// Before
public interface AuthService {
    TokenResponse login(LoginRequest request, String ipAddress, String userAgent);
}

// After
public interface AuthService<U extends UserPrincipal> {
    TokenResponse<U> login(LoginRequest request, String ipAddress, String userAgent);
}
```

## Consequences

### 正向影响

1. **JWT 组件归位**：JwtConfig、JwtUtil 属于认证领域，归到 koduck-auth
2. **接口泛型化**：AuthService 支持泛型，为后续完整迁移做准备
3. **逐步迁移**：避免一次性大规模变更，降低风险

### 代价与风险

1. **部分代码分散**：AuthServiceImpl 和 Controller 仍在 koduck-core
2. **需要后续工作**：待基础设施（EmailService、RateLimiterService）下沉后，再迁移 ServiceImpl

## Implementation Plan

1. ✅ 迁移 AuthService 接口（泛型化）
2. ✅ 迁移 JwtConfig
3. ✅ 迁移 JwtUtil
4. ⏳ 待后续：迁移 AuthServiceImpl（需先下沉 EmailService、RateLimiterService）
5. ⏳ 待后续：迁移 AuthController

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
