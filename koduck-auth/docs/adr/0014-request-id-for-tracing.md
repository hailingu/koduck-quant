# ADR-0014: HTTP Request ID for Distributed Tracing

- Status: Accepted
- Date: 2026-04-08
- Issue: #656

## Context

koduck-auth 需要为每个 HTTP 请求生成唯一的 request_id，用于：

1. **分布式追踪**: 在微服务架构中追踪请求链路
2. **日志关联**: 将同一请求的所有日志条目关联起来
3. **调试支持**: 通过 request_id 快速定位问题请求
4. **客户端支持**: 客户端可以记录 request_id 用于问题排查

当前实现缺失：
- 没有 request_id 生成机制
- 响应中没有 X-Request-Id header

## Decision

### 1. 使用 tower_http::request_id

选择 `tower-http` 提供的 request_id 中间件，原因：

1. **标准化**: 使用成熟的库实现，符合行业标准
2. **集成性**: 与 tower 生态无缝集成
3. **功能完整**: 提供生成、设置、传播完整功能
4. **已依赖**: 项目已有 tower-http 依赖，只需启用 feature

### 2. 实现方案

```rust
use tower_http::request_id::{
    MakeRequestUuid, PropagateRequestIdLayer, RequestId, SetRequestIdLayer,
};
use tower_http::ServiceBuilderExt;

let service = ServiceBuilder::new()
    .set_x_request_id(MakeRequestUuid)  // 生成 UUID
    .layer(PropagateRequestIdLayer::x_request_id())  // 传播到响应
    .service(router);
```

响应头配置：
- Header Name: `X-Request-Id`
- Value Format: UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### 3. 中间件顺序

```rust
Router::new()
    // ... routes ...
    .layer(PropagateRequestIdLayer::x_request_id())  // 最外层：传播到响应
    .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))  // 生成 request_id
    .layer(TraceLayer::new_for_http())  // TraceLayer 可以看到 request_id
    .layer(CompressionLayer::new())
    .layer(CorsLayer::permissive())
```

中间件顺序说明：
1. **CorsLayer**: 最先处理，处理跨域预检请求
2. **CompressionLayer**: 压缩响应体
3. **TraceLayer**: 记录日志，可以看到 request_id
4. **SetRequestIdLayer**: 生成 request_id
5. **PropagateRequestIdLayer**: 将 request_id 传播到响应头

## Consequences

### 正向影响

1. **可观测性**: 每个请求都有唯一标识，便于追踪
2. **调试效率**: 通过 request_id 快速定位问题
3. **标准化**: 使用标准 HTTP header，客户端易于集成
4. **零侵入**: 通过中间件实现，不修改 handler 代码

### 代价与风险

1. **轻微开销**: 每个请求生成 UUID 有微小性能开销
2. **Header 增加**: 响应增加一个 header，增加少量带宽

### 兼容性影响

- **API 变更**: 无破坏性变更，新增响应头
- **客户端**: 可选择性使用 X-Request-Id，不影响现有客户端

## Implementation Plan

1. **修改 routes.rs**:
   - 导入 tower_http request_id 相关类型
   - 添加 SetRequestIdLayer 和 PropagateRequestIdLayer
   - 配置正确的中间件顺序

2. **验证**:
   - 发送 HTTP 请求，验证 X-Request-Id 响应头存在
   - 验证不同请求的 request_id 唯一

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 5.3
- tower_http request_id: https://docs.rs/tower-http/latest/tower_http/request_id/index.html
- UUID v4: https://www.rfc-editor.org/rfc/rfc4122
