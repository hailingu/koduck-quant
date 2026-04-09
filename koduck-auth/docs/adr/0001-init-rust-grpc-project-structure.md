# ADR-0001: 初始化 koduck-auth Rust + gRPC 项目目录结构

- Status: Accepted
- Date: 2026-04-07
- Issue: #630

## Context

随着系统架构演进，我们需要将 koduck-auth 认证服务从 Java 迁移到 Rust 实现，以获得更好的性能和资源利用率。根据设计文档 `docs/design/koduck-auth-rust-grpc-design.md`，新的认证服务需要：

1. **双协议支持**：同时提供 HTTP REST API（对外）和 gRPC（服务间通信）
2. **与现有 API 兼容**：对外接口与现有 Java 版本完全一致
3. **高性能**：利用 Rust 的异步运行时实现亚毫秒级响应
4. **可扩展性**：支持通过 APISIX 网关进行协议转换和负载均衡

### 技术选型决策

| 领域 | 技术选择 | 理由 |
|------|----------|------|
| 语言 | Rust 1.75+ | 高性能、内存安全、优秀的异步生态 |
| HTTP 框架 | axum 0.7 | 基于 tokio 和 tower，生态完善 |
| gRPC | tonic 0.11 | Rust 主流 gRPC 实现，与 tokio 集成好 |
| 数据库 | sqlx 0.7 | 编译期 SQL 检查，零成本抽象 |
| 缓存 | deadpool-redis | 异步 Redis 连接池 |
| JWT | jsonwebtoken | 成熟的 JWT 实现，支持 RS256 |
| 密码哈希 | argon2 | 现代密码哈希算法，抗 GPU/ASIC 破解 |

## Decision

### 项目目录结构

创建标准的 Rust 项目结构，按职责分层：

```
koduck-auth/
├── Cargo.toml              # 项目配置和依赖
├── build.rs                # tonic-build 编译 proto
├── Dockerfile              # 多阶段构建镜像
├── proto/                  # gRPC proto 定义
│   └── koduck/
│       └── auth/
│           └── v1/
│               └── auth.proto
├── migrations/             # SQLx 数据库迁移
│   ├── 001_initial.sql
│   └── 002_add_indexes.sql
├── src/
│   ├── main.rs             # 服务入口
│   ├── lib.rs              # 库入口
│   ├── config.rs           # 配置管理
│   ├── error.rs            # 错误定义
│   ├── state.rs            # 应用状态
│   ├── model/              # 数据模型
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── token.rs
│   │   ├── request.rs
│   │   └── response.rs
│   ├── repository/         # 数据访问层
│   │   ├── mod.rs
│   │   ├── user_repository.rs
│   │   ├── refresh_token_repository.rs
│   │   ├── password_reset_repository.rs
│   │   └── cache.rs
│   ├── service/            # 业务逻辑层
│   │   ├── mod.rs
│   │   ├── auth_service.rs
│   │   └── token_service.rs
│   ├── http/               # HTTP REST API
│   │   ├── mod.rs
│   │   ├── routes.rs
│   │   ├── middleware/
│   │   │   ├── mod.rs
│   │   │   ├── logging.rs
│   │   │   └── error_handler.rs
│   │   └── handler/
│   │       ├── mod.rs
│   │       ├── auth.rs
│   │       ├── jwks.rs
│   │       ├── health.rs
│   │       └── metrics.rs
│   ├── grpc/               # gRPC 服务
│   │   ├── mod.rs
│   │   ├── server.rs
│   │   ├── auth_service.rs
│   │   └── token_service.rs
│   ├── jwt/                # JWT 处理
│   │   ├── mod.rs
│   │   ├── generator.rs
│   │   ├── validator.rs
│   │   └── jwks.rs
│   ├── crypto/             # 加密相关
│   │   ├── mod.rs
│   │   └── password.rs
│   ├── client/             # 外部服务客户端
│   │   ├── mod.rs
│   │   └── user_client.rs
│   └── util/               # 工具函数
│       ├── mod.rs
│       └── ip.rs
├── tests/                  # 集成测试
│   ├── integration_tests.rs
│   ├── grpc_tests.rs
│   └── common/
│       └── mod.rs
├── benches/                # 性能测试
│   └── jwt_bench.rs
├── k8s/                    # K8s 部署配置
│   └── base/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── secrets.yaml
└── scripts/                # 运维脚本
    └── apisix-route-init-auth.sh
```

### 端口规划

| 端口 | 用途 | 协议 |
|------|------|------|
| 8081 | HTTP REST API | HTTP/1.1, HTTP/2 |
| 50051 | gRPC Service | HTTP/2 |
| 9090 | Metrics (Prometheus) | HTTP/1.1 |

### 依赖管理策略

1. **核心依赖固定版本**：tokio, axum, tonic 等核心库使用固定版本
2. **安全相关依赖**：jsonwebtoken, argon2, rsa 等严格固定版本
3. **开发依赖**：允许 minor 版本更新

## Consequences

### 正向影响

1. **性能提升**：相比 Java 版本，预期启动时间从 3-5 秒降至 100ms，内存占用从 200-400MB 降至 20-30MB
2. **编译期安全**：Rust 所有权系统消除空指针、数据竞争等运行时错误
3. **双协议支持**：HTTP REST 对外友好，gRPC 对内高效
4. **类型安全 SQL**：sqlx 在编译期检查 SQL 语句，避免运行时错误
5. **模块化设计**：清晰的分层架构便于测试和维护

### 代价与风险

1. **团队学习成本**：需要团队成员掌握 Rust 异步编程模型
2. **生态成熟度**：相比 Java，Rust 企业级监控、链路追踪等生态仍在发展中
3. **构建时间**：Rust 编译时间较长，需要配置缓存优化
4. **调试复杂度**：异步代码调试相对复杂

### 兼容性影响

- **API 兼容性**：对外 REST API 与 Java 版本 100% 兼容
- **数据库兼容性**：复用现有数据库表结构，无需迁移
- **JWT 兼容性**：使用相同的 RSA 密钥对，已有 Token 继续有效
- **gRPC 兼容性**：定义新的 proto 接口，供内部服务调用

## Alternatives Considered

### 1. 继续使用 Java + Spring Boot

- **拒绝理由**：无法达到 Rust 的性能和资源效率目标，且 Java gRPC 生态相对笨重

### 2. 使用 Go 实现

- **未采用理由**：Go 的 gRPC 生态成熟，但 Rust 在内存安全和零成本抽象方面更优，且团队已有 Rust 基础

### 3. 使用纯 HTTP/REST 无 gRPC

- **未采用理由**：服务间通信需要高效的二进制协议，gRPC 提供流式处理和强类型接口

## Implementation Plan

### Phase 1: 项目初始化（当前 ADR）

- [x] 创建 Rust 项目目录结构
- [x] 配置 Cargo.toml 和 build.rs
- [x] 实现配置管理 (config.rs)
- [x] 实现错误处理框架 (error.rs)
- [x] 创建数据库迁移脚本

### Phase 2-7: 后续任务

详见 `docs/implementation/koduck-auth-rust-grpc-tasks.md`

## Verification

- `cargo check` 无错误
- `cargo clippy` 无警告
- 目录结构与设计方案一致
- 所有必要的源文件和配置文件已创建

## References

- 设计文档: [docs/design/koduck-auth-rust-grpc-design.md](../../design/koduck-auth-rust-grpc-design.md)
- 任务清单: [docs/implementation/koduck-auth-rust-grpc-tasks.md](../../implementation/koduck-auth-rust-grpc-tasks.md)
- API 定义: [docs/design/koduck-auth-rust-api.yaml](../../design/koduck-auth-rust-api.yaml)
- Issue: [#630](https://github.com/hailingu/koduck-quant/issues/630)
