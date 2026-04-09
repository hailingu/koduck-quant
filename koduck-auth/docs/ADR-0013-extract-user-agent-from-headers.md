# ADR-0013: 从 HTTP Header 提取 User-Agent

- Status: Accepted
- Date: 2026-04-08
- Issue: #654

## Context

koduck-auth 的 HTTP login handler 中，User-Agent 目前被硬编码为空字符串：

```rust
// src/http/handler/auth.rs
let user_agent = ""; // TODO: Extract from headers
```

User-Agent 对于安全审计和登录日志非常重要：
1. **安全审计**: 识别异常登录设备
2. **登录日志**: 记录用户使用的浏览器/设备信息
3. **风控**: 检测异常的 User-Agent 模式

## Decision

### 1. 使用 axum::http::HeaderMap 提取 User-Agent

选择使用 `axum::http::HeaderMap` 作为 extractor，而非 `TypedHeader<UserAgent>`，原因：

1. **简单性**: HeaderMap 更直观，不需要额外导入
2. **灵活性**: 可以轻松处理缺失的 header（返回默认值）
3. **一致性**: 项目其他部分可能也需要访问其他 headers

### 2. 实现方案

```rust
use axum::http::HeaderMap;
use axum::http::header::USER_AGENT;

pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,  // 新增 extractor
    Json(req): Json<LoginRequest>,
) -> Result<Json<ApiResponse<TokenResponse>>> {
    let ip = addr.ip().to_string();
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .to_string();
    
    // ...
}
```

### 3. 错误处理

- 如果 User-Agent header 缺失：使用空字符串 `""`
- 如果 User-Agent 包含非法字符（非 UTF-8）：使用空字符串 `""`

## Consequences

### 正向影响

1. **安全增强**: 登录日志包含真实的设备信息
2. **审计合规**: 满足安全审计对 User-Agent 的要求
3. **简单实现**: 改动小，风险低

### 代价与风险

1. **无重大风险**: 这是纯增强功能，不影响现有逻辑
2. **向后兼容**: 缺失 User-Agent 时行为与之前一致（空字符串）

### 兼容性影响

- **API 变更**: 无，handler 签名增加 extractor 不影响路由
- **行为变更**: login handler 现在能正确记录 User-Agent

## Implementation Plan

1. **修改 auth.rs**: 添加 HeaderMap extractor 并提取 User-Agent
2. **更新测试**: 如有相关测试，更新测试用例
3. **验证**: 手动测试登录请求是否记录 User-Agent

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 5.1
- axum HeaderMap: https://docs.rs/axum/latest/axum/extract/struct.HeaderMap.html
