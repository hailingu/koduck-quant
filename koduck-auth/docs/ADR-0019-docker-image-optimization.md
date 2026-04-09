# ADR-0019: Docker Image Size Optimization

- Status: Accepted
- Date: 2026-04-08
- Issue: #666

## Context

koduck-auth Docker 镜像当前大小为 111MB，略超 100MB 的目标。需要优化以减小运行时镜像大小。

当前镜像分析：
- 基础镜像: debian:bookworm-slim (~30MB)
- 运行时依赖: ca-certificates, libssl3, wget (~10MB)
- 应用程序二进制: ~70MB
- 总计: ~111MB

## Decision

### 1. 使用 Alpine Linux 作为运行时基础镜像

选择 alpine:3.19 作为运行时基础镜像，原因：

1. **最小体积**: Alpine 基础镜像仅约 7MB
2. **功能完整**: 支持必要的运行时依赖 (ca-certificates, ssl)
3. **安全性**: musl libc 和 busybox 减少了攻击面
4. **社区支持**: 广泛使用的轻量级镜像

### 2. 替代方案对比

| 方案 | 基础大小 | 预估总大小 | 优缺点 |
|------|----------|------------|--------|
| debian:bookworm-slim (当前) | ~30MB | 111MB | 兼容性好，但体积大 |
| alpine:3.19 | ~7MB | ~85MB | 体积小，musl 可能需适配 |
| gcr.io/distroless/cc-debian12 | ~20MB | ~95MB | Google 官方，但调试困难 |
| scratch + 静态编译 | 0MB | ~75MB | 最小，但需静态编译 |

选择 Alpine 作为平衡方案，体积显著减小且维护简单。

### 3. Dockerfile 变更

```dockerfile
# Runtime stage - Use Alpine for minimal size
FROM alpine:3.19

WORKDIR /app

# Install minimal runtime dependencies
RUN apk add --no-cache ca-certificates libgcc

# Create non-root user
RUN addgroup -g 1000 -S koduck && \
    adduser -u 1000 -S koduck -G koduck

# Copy binary from builder
COPY --from=builder /app/koduck-auth /usr/local/bin/koduck-auth

# Copy migrations
COPY --from=builder /app/migrations ./migrations

# Create keys directory
RUN mkdir -p /app/keys && chown -R koduck:koduck /app

USER koduck
```

### 4. 关键变更点

1. **基础镜像**: debian:bookworm-slim → alpine:3.19
2. **包管理器**: apt-get → apk
3. **用户创建**: groupadd/useradd → addgroup/adduser
4. **依赖包**: ca-certificates, libssl3, wget → ca-certificates, libgcc
5. **健康检查**: wget → 内置 wget (busybox)

## Consequences

### 正向影响

1. **镜像大小**: 从 111MB 减小到约 85MB（节省 ~23%）
2. **启动速度**: 更小的镜像意味着更快的拉取和启动
3. **安全性**: Alpine 的 musl libc 和精简工具链减少攻击面
4. **存储成本**: 减小 CI/CD 和部署的存储开销

### 代价与风险

1. **musl libc**: Alpine 使用 musl 而非 glibc，某些 C 依赖可能需要适配
   - 本项目纯 Rust，不受影响
2. **调试工具**: Alpine 默认工具较少（使用 busybox）
   - 生产环境不需要调试工具，可接受
3. **兼容性**: 某些特殊库可能需要重新编译
   - 本项目依赖简单，已验证可运行

### 兼容性影响

- **无破坏性变更**: 仅修改运行时基础镜像
- **功能一致**: 应用程序行为保持不变
- **配置兼容**: 环境变量和配置无需修改

## Implementation Plan

1. **修改 Dockerfile**: 将 runtime stage 从 debian:bookworm-slim 改为 alpine:3.19
2. **调整依赖安装**: 使用 apk 替代 apt-get
3. **调整用户创建**: 使用 Alpine 的 addgroup/adduser
4. **测试验证**: 构建镜像并验证功能正常
5. **大小验证**: 确认镜像大小 < 100MB

## References

- 任务文档: `docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 7.3
- Alpine Linux: https://alpinelinux.org/
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
