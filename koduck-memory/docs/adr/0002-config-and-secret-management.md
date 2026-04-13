# ADR-0002: 为 koduck-memory 建立配置覆盖与 Secret 脱敏基线

- Status: Accepted
- Date: 2026-04-12
- Issue: #790

## Context

Task 1.1 已经为 `koduck-memory` 建立了最小服务骨架，但配置能力仍停留在
`app/server` 两个轻量 section，仅能支撑服务启动，无法满足设计文档对
PostgreSQL、对象存储、capabilities TTL、summary 开关等运行时配置要求。

同时，当前启动日志虽然不会主动打印敏感值，但也没有统一的 Secret 脱敏策略，
而且当关键配置缺失时不会在启动早期清晰失败，这会把问题推迟到后续数据库或
对象存储接入阶段。

Task 1.2 要求补齐：

1. 配置文件 + 环境变量覆盖
2. 关键配置项落位
3. Secret 自动脱敏
4. 配置校验失败时快速失败

## Decision

### 配置模型

在 `AppConfig` 下新增以下 section：

- `postgres.dsn`
- `object_store.endpoint`
- `object_store.bucket`
- `object_store.access_key`
- `object_store.secret_key`
- `object_store.region`
- `index.mode`
- `capabilities.ttl_secs`
- `summary.async_enabled`

默认配置放在 `config/default.toml`，其中 server/app 提供可运行默认值，
外部依赖相关字段默认留空，由环境变量或 `config/local.toml` 提供。

### 环境变量覆盖

配置系统同时支持两类环境变量：

- 设计文档中的裸 key，例如 `SERVER__GRPC_ADDR`
- 带服务前缀的 key，例如 `KODUCK_MEMORY__SERVER__GRPC_ADDR`

### Secret 脱敏

启动日志不直接打印原始 `AppConfig`，而是输出脱敏后的配置摘要：

- `postgres.dsn` 屏蔽凭据段，只保留协议、用户名和地址
- `object_store.access_key` / `secret_key` 仅保留首尾少量字符

### 失败快校验

在 `AppConfig::load()` 完成合并后立即执行校验：

- 所有关键字符串配置不能为空
- `capabilities.ttl_secs` 必须大于 0
- 布尔值和整数环境变量在解析失败时直接报错终止启动

### k8s 注入

在 `k8s/base/koduck-memory.yaml` 中新增 `koduck-memory-secrets`，
并通过 `envFrom.secretRef` 注入运行时配置，使 `koduck-dev` rollout
在 Task 1.2 完成后可以继续工作。

## Consequences

### 正向影响

1. `koduck-memory` 已具备后续接通 PostgreSQL、MinIO 和摘要任务的配置基础。
2. 关键配置问题会在启动时暴露，而不是延后到业务调用路径。
3. 日志排障能力提升，同时避免 Secret 明文泄漏。
4. dev 环境能够以与未来生产更接近的方式管理配置注入。

### 权衡与代价

1. 当前环境变量解析采用显式映射而不是完整通用配置库，代码量略多，但依赖更轻、更可控。
2. base k8s 中仍保留占位 Secret 值，这适合当前 bootstrap 阶段，但后续应迁移到更安全的 Secret 管理方式。
3. `INDEX__MODE` 虽然不在 Task 1.2 明细中，但为对齐设计文档一并纳入模型。

### 兼容性影响

1. 启动日志格式新增了脱敏后的 `config` 字段，但不会破坏现有探活或 gRPC 行为。
2. Deployment 新增 `envFrom.secretRef`，对现有 `koduck-dev` 资源是增量兼容变更。
3. 支持裸 key 与服务前缀 key 两种环境变量格式，不会破坏后续部署脚本选择空间。

## Alternatives Considered

### 1. 继续使用通用配置库自动映射所有环境变量

- 拒绝理由：Task 1.1 期间已经遇到依赖链兼容性问题，当前阶段更适合使用轻量、明确的手工覆盖逻辑。

### 2. 完全不在日志中输出配置

- 拒绝理由：会降低排障效率，尤其是在 k8s 环境里很难快速判断 Secret 是否正确注入。

### 3. 仅支持带 `KODUCK_MEMORY__` 前缀的环境变量

- 拒绝理由：不完全符合设计文档列出的必要配置命名，且会增加后续脚本对变量名的转换成本。

## Verification

- `docker run --rm ... cargo test`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 任务清单: [koduck-memory-service-tasks.md](../implementation/koduck-memory-service-tasks.md)
- 前序 ADR: [0001-init-rust-grpc-project-structure.md](./0001-init-rust-grpc-project-structure.md)
- Issue: [#790](https://github.com/hailingu/koduck-quant/issues/790)
