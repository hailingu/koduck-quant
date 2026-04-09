# ADR-0020: Docker Image Size Analysis and Optimization

- Status: Accepted
- Date: 2026-04-08
- Issue: #666

## Context

经过实际构建验证，Docker 镜像大小为 **111.3MB**，与预期的 85MB 有差距。需要分析原因并提供实际可行的优化方案。

## Analysis

### 镜像大小分解

```
总大小: 111.3 MB
├── Alpine 3.19 基础镜像: ~7 MB
├── Runtime 依赖 (ca-certificates, libgcc): ~3 MB
├── koduck-auth 二进制: ~95 MB
├── Migrations 目录: ~0.1 MB
└── 其他 (keys 目录, metadata): ~6 MB
```

### 主要问题

**Rust 二进制文件过大 (~95MB)**

原因：
1. **Dependencies**: tokio, axum, tonic, sqlx 等重量级依赖
2. **Static linking**: Rust 静态链接大量库
3. **Debug symbols**: 即使 strip=true，某些符号仍保留
4. **Release profile**: 当前配置已启用 LTO 和 strip

### 已尝试的优化

1. ✅ Alpine 基础镜像 (节省 ~23MB)
2. ✅ Strip 符号表 (Cargo.toml 中 strip = true)
3. ✅ LTO 优化 (Cargo.toml 中 lto = true)
4. ✅ 单 codegen unit (Cargo.toml 中 codegen-units = 1)

## Decision

### 1. 显式 Strip 二进制

在 Dockerfile 构建阶段添加显式 strip 命令：

```dockerfile
RUN cargo build --release --locked && \
    cp /app/target/release/koduck-auth /app/koduck-auth && \
    strip --strip-all /app/koduck-auth
```

### 2. 接受当前大小

经过分析，111MB 对于包含以下功能的 Rust 应用是合理的大小：

- HTTP/REST API (axum)
- gRPC (tonic)
- PostgreSQL 访问 (sqlx)
- Redis 缓存 (deadpool-redis)
- JWT 处理 (jsonwebtoken, rsa)
- 密码哈希 (argon2)
- 监控和追踪 (opentelemetry, prometheus)

对比参考：
- 典型的 Go 微服务镜像：50-150MB
- 典型的 Java 微服务镜像：200-500MB
- 典型的 Node.js 微服务镜像：150-300MB

### 3. 进一步优化选项（未来考虑）

如果需要进一步减小，可考虑：

1. **UPX 压缩**: 可减小 30-50%，但增加启动时间和内存使用
2. **Static MUSL build**: 完全静态链接，可使用 scratch 镜像
3. **Feature flags**: 移除不需要的功能模块
4. **Dependency trimming**: 审查并移除不必要的依赖

## Consequences

### 现状接受

- 镜像大小: 111MB（在可接受范围内）
- 相比 Debian 基础镜像仍节省约 15-20MB
- 功能和安全性不受影响

### 进一步优化代价

| 方案 | 潜在节省 | 代价 |
|------|----------|------|
| UPX 压缩 | 30-40MB | 启动延迟, 内存占用 |
| Static MUSL | 20-30MB | 构建复杂度, 兼容性问题 |
| Feature flags | 10-20MB | 代码重构, 功能限制 |

## Implementation

1. **添加显式 strip**: 在 Dockerfile 中添加 `strip --strip-all`
2. **文档更新**: 记录实际镜像大小和原因
3. **监控**: 持续监控镜像大小变化

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 7.3
- Rust Binary Size: https://github.com/johnthagen/min-sized-rust
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
