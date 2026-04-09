# ADR-0017: gRPC Server Reflection Support

- Status: Accepted
- Date: 2026-04-08
- Issue: #662

## Context

koduck-auth 需要支持 gRPC Server Reflection，以提供以下能力：

1. **动态服务发现**: 客户端可以在运行时查询可用的 gRPC 服务和方法
2. **调试工具支持**: 支持使用 grpcurl、grpcui 等工具进行调试和测试
3. **开发便利性**: 无需 proto 文件即可进行 gRPC 调用

## Decision

### 1. 使用 tonic-reflection

选择 tonic-reflection crate 实现 gRPC Server Reflection，原因：

1. **官方支持**: tonic-reflection 是 tonic 生态的官方组件
2. **易于集成**: 与 tonic Server 无缝集成
3. **标准兼容**: 遵循 gRPC Server Reflection 协议
4. **已依赖**: 项目已有 tonic-reflection 依赖

### 2. 实现方案

在 server.rs 中集成反射服务：

```rust
use tonic_reflection::server::Builder as ReflectionBuilder;

// Build reflection service
let reflection_service = ReflectionBuilder::configure()
    .register_encoded_file_descriptor_set(tonic::include_file_descriptor_set!("koduck"))
    .build()?;

// Add to server
Server::builder()
    .add_service(reflection_service)
    .add_service(AuthServiceServer::new(...))
    .add_service(TokenServiceServer::new(...))
    .serve(addr)
    .await?;
```

### 3. File Descriptor Set 配置

tonic-reflection 需要预编译的 proto 文件描述符集。通过 tonic-build 在 build.rs 中生成：

```rust
// build.rs
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .file_descriptor_set_path("src/grpc/proto/koduck.bin")
        .compile(&["proto/koduck/auth/v1/auth.proto"], &["proto"])?;
    Ok(())
}
```

然后在代码中包含：

```rust
.register_encoded_file_descriptor_set(
    tonic::include_file_descriptor_set!("koduck")
)
```

### 4. 实现位置

在以下两个位置添加反射服务：

1. **GrpcServer::run()**: 用于独立 gRPC 服务器
2. **create_grpc_services()**: 用于 main.rs 中的组合服务器

## Consequences

### 正向影响

1. **开发效率**: 无需 proto 文件即可使用 grpcurl 调试
2. **服务发现**: 支持动态服务发现
3. **工具兼容**: 兼容所有支持 gRPC Reflection 的工具

### 代价与风险

1. **二进制大小**: 增加约 100-200KB 的二进制大小（proto 描述符数据）
2. **暴露信息**: 服务定义对外可见（通常不是安全问题，因为 gRPC 是内部服务）

### 兼容性影响

- **无破坏性变更**: 仅新增服务，不影响现有功能
- **可选使用**: 客户端可以选择是否使用 Reflection

## Implementation Plan

1. **检查 build.rs**: 确保 tonic-build 配置正确
2. **修改 server.rs**: 
   - 导入 tonic_reflection
   - 创建反射服务
   - 添加到 Server builder
3. **验证**: 使用 grpcurl 验证反射功能

## References

- 任务文档: `koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md` Task 6.3
- tonic-reflection: https://docs.rs/tonic-reflection/latest/tonic_reflection/
- gRPC Reflection Protocol: https://github.com/grpc/grpc/blob/master/doc/server-reflection.md
