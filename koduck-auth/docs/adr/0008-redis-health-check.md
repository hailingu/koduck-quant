# ADR-0008: Redis 连接池健康检查

- Status: Accepted
- Date: 2026-04-08
- Issue: #644

## Context

koduck-auth 服务依赖 Redis 作为缓存层，用于：
- Token 黑名单存储
- 登录尝试计数（防暴力破解）
- IP 锁定状态

当前实现中，readiness 探针没有检查 Redis 连通性，可能导致：
1. 服务启动后 Redis 不可用，但 readiness 仍返回成功
2. 流量被路由到无法正常工作缓存的服务实例
3. 降级到数据库查询，增加数据库负载

需要在 readiness 探针中添加 Redis 健康检查。

## Decision

### 健康检查策略

在 `RedisCache` 中实现 `ping()` 方法：

```rust
pub async fn ping(&self) -> Result<()>
```

实现逻辑：
1. 从连接池获取连接
2. 执行 Redis PING 命令
3. 预期返回 "PONG"
4. 任何错误都表示不健康

### 探针集成

在 `readiness` handler 中集成 Redis 健康检查：

```rust
pub async fn readiness(State(state): State<Arc<AppState>>) -> StatusCode {
    // Check Redis connectivity
    if let Err(e) = state.redis_cache().ping().await {
        tracing::warn!("Redis health check failed: {}", e);
        return StatusCode::SERVICE_UNAVAILABLE;
    }
    
    StatusCode::OK
}
```

### 超时控制

使用 `tokio::time::timeout` 控制健康检查超时：

```rust
match timeout(Duration::from_secs(2), redis_cache.ping()).await {
    Ok(Ok(())) => StatusCode::OK,
    Ok(Err(e)) => { /* Redis error */ },
    Err(_) => { /* Timeout */ },
}
```

### 健康检查频率

由 K8s readiness probe 控制：
- periodSeconds: 10（每 10 秒检查一次）
- failureThreshold: 3（连续 3 次失败才标记为 NotReady）
- timeoutSeconds: 5（单次检查超时 5 秒）

## Consequences

### 正向影响

1. **早期发现问题**: Redis 故障时服务快速从负载均衡中移除
2. **流量保护**: 避免将请求路由到无法使用缓存的实例
3. **自愈支持**: K8s 可以自动重启不健康的 Pod
4. **可观测性**: 健康检查失败记录到日志，便于排查

### 代价与风险

1. **额外负载**: 每 10 秒一次的 PING 命令增加 Redis 负载（可忽略）
2. **依赖严格化**: Redis 短暂不可用会导致 Pod NotReady
3. **启动延迟**: 需要等待 Redis 就绪才能通过 readiness

### 兼容性影响

- **API 兼容**: 新增方法，不影响现有接口
- **行为变更**: readiness 更严格，Redis 不可用时服务标记为 NotReady

## Alternatives Considered

### 1. 只检查连接池状态，不执行 PING

- **方案**: 只检查 `pool.status().available > 0`
- **拒绝理由**: 连接池有可用连接不代表 Redis 服务正常，可能已断开

### 2. 异步后台健康检查

- **方案**: 后台任务定期执行健康检查，缓存结果
- **拒绝理由**: 增加复杂度，实时性不如按需检查

### 3. 可选的 Redis 健康检查

- **方案**: 通过配置控制是否检查 Redis
- **拒绝理由**: 当前设计 Redis 是必需依赖，不应可选

## Implementation Plan

1. 在 `RedisCache` 中添加 `ping()` 方法
2. 在 `AppState` 中添加 `redis_cache()` 方法暴露 RedisCache
3. 修改 `readiness` handler 调用 Redis 健康检查
4. 添加超时控制
5. 添加单元测试

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 3.3
- Redis PING: https://redis.io/commands/ping/
- K8s Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
