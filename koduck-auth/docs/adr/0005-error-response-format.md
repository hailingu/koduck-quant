# ADR-0005: 错误响应格式改进

- Status: Accepted
- Date: 2026-04-08
- Issue: #638

## Context

koduck-auth 服务已实现基本的错误处理框架，但存在以下问题需要改进：

1. **错误 code 字段类型不一致**: 当前响应中的 `code` 是数字（HTTP 状态码），而设计文档和 API 规范期望字符串形式的错误代码（如 `"UNAUTHORIZED"`、`"VALIDATION_ERROR"` 等），便于客户端识别和处理特定错误类型。

2. **内部错误日志记录不完整**: 虽然 `client_message()` 方法正确隐藏了内部错误细节，但 `into_response()` 实现中没有显式记录完整错误信息，依赖上层中间件或调用方来记录。这可能导致内部错误信息丢失，不利于故障排查。

## Decision

### 错误响应格式改进

将错误响应结构从：
```json
{
  "success": false,
  "code": 401,
  "message": "Authentication failed",
  "timestamp": "2026-04-08T12:00:00Z"
}
```

改为：
```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication failed",
  "timestamp": "2026-04-08T12:00:00Z"
}
```

使用 `error_code()` 方法提供的字符串错误代码，而非 HTTP 状态码数字。

### 内部错误日志记录

在 `into_response()` 中增加内部错误日志记录：

```rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        // 记录内部错误详情（仅内部错误类型）
        match &self {
            AppError::Internal(_) | 
            AppError::Database(_) | 
            AppError::Config(_) | 
            AppError::PasswordHash(_) | 
            AppError::Io(_) => {
                tracing::error!(error = %self, error_code = %self.error_code(), "Internal error occurred");
            }
            _ => {}
        }
        
        // ... 构建响应
    }
}
```

### 错误类型映射

| 错误类型 | HTTP 状态码 | 错误代码 (code) |
|---------|------------|----------------|
| Unauthorized | 401 | UNAUTHORIZED |
| Forbidden | 403 | FORBIDDEN |
| NotFound | 404 | NOT_FOUND |
| Validation | 400 | VALIDATION_ERROR |
| Conflict | 409 | CONFLICT |
| Locked | 423 | RESOURCE_LOCKED |
| TooManyRequests | 429 | RATE_LIMIT_EXCEEDED |
| Internal | 500 | INTERNAL_ERROR |
| ServiceUnavailable | 503 | SERVICE_UNAVAILABLE |
| Database | 500 | DATABASE_ERROR |
| Config | 500 | CONFIG_ERROR |
| Jwt | 401 | JWT_ERROR |
| PasswordHash | 500 | PASSWORD_HASH_ERROR |
| Io | 500 | IO_ERROR |

## Consequences

### 正向影响

1. **API 一致性**: 错误响应格式与设计文档和 API 规范保持一致
2. **客户端友好**: 字符串错误代码更易于客户端识别和处理
3. **可观测性**: 内部错误自动记录，便于故障排查和监控
4. **安全性**: 内部错误详情不会暴露给客户端，但会记录到日志

### 代价与风险

1. **破坏性变更**: 如果已有客户端依赖数字 code 字段，需要更新
2. **日志量增加**: 内部错误会额外产生 error 级别日志

### 兼容性影响

- **API 响应变更**: `code` 字段从数字变为字符串，需要通知客户端开发者
- **向后不兼容**: 已有客户端如果依赖 `code` 的数字类型，需要更新

## Alternatives Considered

### 1. 同时返回数字和字符串 code

- **方案**: 保留 `code`（数字），新增 `error_code`（字符串）
- **拒绝理由**: 增加响应体积，不够简洁；已有 `error_code()` 方法，直接替换更合理

### 2. 使用中间件统一记录错误

- **方案**: 不在 `into_response()` 中记录，而是通过 Tower 中间件统一处理
- **拒绝理由**: 增加了架构复杂度；当前方案更直接，且不会丢失上下文信息

## Implementation Plan

1. 修改 `ErrorResponse` 结构体，`code` 字段从 `u16` 改为 `String`
2. 更新 `into_response()` 实现：
   - 使用 `error_code()` 获取字符串 code
   - 添加内部错误日志记录
3. 更新相关测试用例
4. 更新 API 文档

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 1.3
- 设计文档: `docs/design/koduck-auth-rust-grpc-design.md`
- tracing crate: https://docs.rs/tracing/
