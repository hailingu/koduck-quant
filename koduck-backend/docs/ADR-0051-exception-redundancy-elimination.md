# ADR-0051: Exception 包冗余类消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #392

## Context

根据 `docs/exception-redundancy-analysis.md` 分析报告，koduck-backend 的 exception 包中存在完全冗余的异常类，增加了维护成本，违反了 DRY 原则。

### 发现的冗余问题

| 严重程度 | 冗余对象 | 原因 |
|---------|---------|------|
| 🔴 完全冗余 | `AuthorizationException` | 生产代码中零使用，功能与 `new BusinessException(ErrorCode.FORBIDDEN, message)` 完全等价 |

### 影响分析

- 仅出现在 3 处：自身定义、`GlobalExceptionHandler` 中的 handler 方法、以及测试文件 `GlobalExceptionHandlerTest.java`
- `GlobalExceptionHandler.handleAuthorizationException()` 永远不会被触发，是一段死代码
- Spring Security 的授权场景已有 `AccessDeniedException` 被 `GlobalExceptionHandler.handleAccessDeniedException()` 处理

## Decision

### 决策: 删除 `AuthorizationException` 及相关代码

**理由**:
- 生产代码中没有任何业务代码 `throw` 过该异常
- 其工厂方法 `accessDenied()` 和 `operationNotAllowed()` 也从未被调用
- 功能与 `new BusinessException(ErrorCode.FORBIDDEN, message)` 完全等价，无需单独异常类
- Spring Security 的授权场景已有 `AccessDeniedException` 被正确处理
- 删除后可减少代码维护负担，提高代码清晰度

**实施方案**:
1. 删除 `AuthorizationException.java`
2. 移除 `GlobalExceptionHandler.handleAuthorizationException()` 方法
3. 移除 `GlobalExceptionHandlerTest` 中相关测试用例

## Consequences

### 正向影响

- 消除代码重复，降低维护成本
- 删除死代码，提高代码清晰度
- 简化异常体系结构
- 符合 DRY 原则

### 消极影响

- 需要删除 3 个文件/方法中的相关代码

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 无 | 该异常从未被使用，不影响 API |
| 业务逻辑 | 无 | 该异常从未被抛出，不影响业务 |
| 序列化 | 无 | 不涉及实体变更 |
| 测试 | 有 | 需要删除相关测试用例 |

## Related

- Issue #392
- `docs/exception-redundancy-analysis.md`
