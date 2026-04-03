# Exception 包冗余分析报告

> 分析日期：2026-04-03
> 分析范围：`koduck-backend/src/main/java/com/koduck/exception` 包下所有文件

## 分析范围（11 个文件）

| 文件 | 角色 |
|------|------|
| `BusinessException.java` | 基类 |
| `ErrorCode.java` | 错误码枚举 |
| `GlobalExceptionHandler.java` | 全局异常处理器 |
| `AuthenticationException.java` | 认证异常 |
| `AuthorizationException.java` | 授权异常 |
| `CredentialEncryptionException.java` | 凭证加密异常 |
| `DuplicateException.java` | 重复数据异常 |
| `ExternalServiceException.java` | 外部服务异常 |
| `ResourceNotFoundException.java` | 资源不存在异常 |
| `StateException.java` | 状态异常 |
| `ValidationException.java` | 校验异常 |

---

## 冗余分析结论

### ❌ `AuthorizationException` — 完全冗余（建议删除）

**生产代码中零使用**：没有任何业务代码 `throw` 过该异常，其工厂方法 `accessDenied()` 和 `operationNotAllowed()` 也从未被调用。

- 仅出现在 3 处：自身定义、`GlobalExceptionHandler` 中的 handler 方法、以及测试文件 `GlobalExceptionHandlerTest.java`
- `GlobalExceptionHandler.handleAuthorizationException()` 永远不会被触发，是一段死代码
- 功能与 `new BusinessException(ErrorCode.FORBIDDEN, message)` 完全等价
- Spring Security 的授权场景已有 `AccessDeniedException` 被 `GlobalExceptionHandler.handleAccessDeniedException()` 处理

**建议操作**：

1. 删除 `AuthorizationException.java`
2. 移除 `GlobalExceptionHandler.handleAuthorizationException()` 方法
3. 移除 `GlobalExceptionHandlerTest` 中相关测试用例

---

### ✅ 其余 7 个异常类均有真实业务使用，不冗余

| 异常类 | 生产使用次数 | 使用位置 | 附加状态 |
|--------|------------|----------|---------|
| `AuthenticationException` | 5 | `AuthServiceImpl` — `invalidCredentials()`×2, `accountDisabled()`, `accountLocked()`, `tokenInvalid()`, `tokenExpired()` | 有工厂方法价值，语义清晰 |
| `DuplicateException` | 8 | `AuthServiceImpl`, `UserServiceImpl`, `CredentialServiceImpl`, `WatchlistServiceImpl` | 携带 `field` + `value`，结构化冲突信息 |
| `ResourceNotFoundException` | 9 | `StrategyServiceImpl`, `BacktestServiceImpl`, `CommunitySignalServiceImpl`, `UserServiceImpl`, `CredentialServiceImpl`, `WatchlistServiceImpl` | 携带 `resourceType` + `resourceId`，便于定位 |
| `ExternalServiceException` | 6 | `AKShareDataProvider` — 3 次不可用, 3 次调用失败 | 携带 `serviceName`，标识外部依赖 |
| `StateException` | 2 | `MemoryServiceImpl`, `WatchlistServiceImpl` | 携带 `currentState` + `expectedState`，便于调试 |
| `ValidationException` | 1 | `TechnicalIndicatorServiceImpl` | 携带 `fieldErrors` Map，支持多字段校验 |
| `CredentialEncryptionException` | 2 | `CredentialEncryptionUtil` — 加密失败 + 解密失败 | 包装底层加密异常，保护敏感信息 |

---

## 详细使用清单

### AuthenticationException（5 处）

```java
// AuthServiceImpl.java
throw AuthenticationException.invalidCredentials();    // 登录失败（用户名/密码错误）×2
throw AuthenticationException.accountDisabled();        // 账号已禁用
throw AuthenticationException.accountLocked();          // 账号已锁定
throw AuthenticationException.tokenInvalid();           // 无效的刷新令牌
throw AuthenticationException.tokenExpired();           // 刷新令牌过期
```

### DuplicateException（8 处）

```java
// AuthServiceImpl.java
throw new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);   // 注册时用户名重复
throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);      // 注册时邮箱重复

// UserServiceImpl.java
throw new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);   // 更新时用户名重复
throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);      // 更新时邮箱重复
throw new DuplicateException(ErrorCode.USER_EMAIL_EXISTS);      // 更新时邮箱重复（另一处）

// CredentialServiceImpl.java
throw new DuplicateException("name", request.getName(), "凭证名称已存在: " + request.getName());  // 凭证名重复 ×2

// WatchlistServiceImpl.java
throw new DuplicateException("symbol", normalizedSymbol, "Stock already in watchlist");  // 自选股重复
```

### ResourceNotFoundException（9 处）

```java
// StrategyServiceImpl.java
new ResourceNotFoundException("strategy version", versionId)
new ResourceNotFoundException("Strategy version not found: strategyId=" + strategyId + ...)

// BacktestServiceImpl.java
new ResourceNotFoundException("backtest result", backtestId)
new ResourceNotFoundException("strategy version for strategy", strategyId)

// CommunitySignalServiceImpl.java
new ResourceNotFoundException("Signal not found: " + signalId)
new ResourceNotFoundException("Comment not found: " + commentId)

// UserServiceImpl.java
new ResourceNotFoundException("用户", userId)

// CredentialServiceImpl.java
new ResourceNotFoundException("凭证不存在: " + credentialId)

// WatchlistServiceImpl.java
new ResourceNotFoundException("watchlist item", itemId)
```

### ExternalServiceException（6 处）

```java
// AKShareDataProvider.java
throw new ExternalServiceException("DataService", "Data service is not available");  // ×3
throw new ExternalServiceException("DataService", "Failed to get price for " + symbol, e);
throw new ExternalServiceException("DataService", "Failed to get valuation for " + symbol, e);
throw new ExternalServiceException("DataService", "Failed to get industry for " + symbol, e);
```

### StateException（2 处）

```java
// MemoryServiceImpl.java
throw new StateException("Memory is disabled");

// WatchlistServiceImpl.java
throw new StateException("Watchlist limit reached (" + MAX_WATCHLIST_SIZE + ")");
```

### ValidationException（1 处）

```java
// TechnicalIndicatorServiceImpl.java
throw new ValidationException("Unsupported indicator: " + indicator);
```

### CredentialEncryptionException（2 处）

```java
// CredentialEncryptionUtil.java
throw new CredentialEncryptionException("加密失败", ex);
throw new CredentialEncryptionException("解密失败，可能是密钥不正确或数据已损坏", ex);
```

---

## 总结

| 分类 | 数量 | 明细 |
|------|------|------|
| 完全冗余（可安全删除） | 1 | `AuthorizationException` |
| 有实际使用（保留） | 7 | `AuthenticationException`, `DuplicateException`, `ResourceNotFoundException`, `ExternalServiceException`, `StateException`, `ValidationException`, `CredentialEncryptionException` |
| 基础设施（保留） | 3 | `BusinessException`, `ErrorCode`, `GlobalExceptionHandler` |