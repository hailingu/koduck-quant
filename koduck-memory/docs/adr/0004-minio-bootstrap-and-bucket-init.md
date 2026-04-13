# ADR-0004: 为 koduck-memory 建立 MinIO bootstrap 与 bucket 初始化基线

- Status: Accepted
- Date: 2026-04-12
- Issue: #794

## Context

Task 1.3 完成后，`koduck-memory` 已经具备 PostgreSQL readiness 与基础观测能力，但
L0 原始材料依赖的对象存储仍停留在配置层，没有实际的 dev 基础设施承接：

1. `koduck-dev` 中还没有可用的 MinIO pod / service / pvc。
2. `OBJECT_STORE__ENDPOINT` 与 bucket 名称虽然已经进入配置，但 bucket 并不会自动初始化。
3. 后续 Task 4.3 需要把原始记忆材料写入 S3 兼容对象存储，因此必须先把 dev 的对象存储基线建起来。

Task 1.4 的目标不是实现 L0 写入逻辑，而是把对象存储基础设施、bucket 准备流程和服务侧
可达性校验先稳定下来。

## Decision

### dev 环境使用 MinIO 作为 S3 兼容对象存储

在 Kubernetes 中新增：

1. `minio-secret`
2. `minio-data` PVC
3. `minio` Deployment
4. `minio` Service

MinIO 仅作为 dev bootstrap 基础设施使用，承接后续 L0 原始材料对象。

### 使用 Job 进行 bucket 初始化

新增 `minio-bucket-init` Job，使用 `minio/mc`：

1. 等待 MinIO API 就绪
2. 建立 `koduck-memory-dev` bucket
3. 对 bucket 执行一次 `mc stat` 作为成功信号

这样 bucket 初始化不依赖人工登录控制台，也不会耦合到 `koduck-memory` 镜像构建流程。

### 在 koduck-memory 启动前校验 bucket 可访问

为 `koduck-memory` Deployment 增加 `wait-for-object-store` initContainer，使用与
主容器同一份 `koduck-memory-secrets`：

1. 通过 `OBJECT_STORE__ENDPOINT`
2. 使用 `OBJECT_STORE__ACCESS_KEY` / `OBJECT_STORE__SECRET_KEY`
3. 对 `OBJECT_STORE__BUCKET` 执行 `mc stat`

只有 bucket 可访问时主容器才会启动。这样 rollout 结果可以直接反映对象存储前置条件是否满足。

## Consequences

### 正向影响

1. `koduck-dev` 现在具备可用的 S3 兼容对象存储，不再只是配置占位。
2. bucket 初始化流程被显式固化为 Job，后续新环境 bootstrap 更简单。
3. `koduck-memory` 的 rollout 现在会把对象存储可达性纳入启动前校验，降低后续 L0 写入前置风险。

### 权衡与代价

1. 本阶段仍使用单副本 MinIO，只满足 dev 与 bootstrap 诉求，不代表生产级对象存储设计。
2. `minio/mc:latest` 用于快速建立 bootstrap 能力，后续可以再收敛到固定 digest。
3. bucket 初始化仍是一次性 Job；如果未来清空 PVC，需要重新触发 Job 或重建资源。

### 兼容性影响

1. `koduck-dev` 新增 `dev-minio` Service 与对应 PVC，会占用额外本地磁盘。
2. `koduck-memory` Pod 新增 initContainer，因此对象存储不可用时会停留在初始化阶段而不是直接启动成功。

## Alternatives Considered

### 1. 在 koduck-memory 应用启动后再按需创建 bucket

- 未采用理由：会把基础设施准备与业务写路径耦合在一起，不利于明确 bootstrap 责任边界。

### 2. 仅增加 MinIO Deployment，不提供 bucket 初始化流程

- 未采用理由：后续仍需手工创建 bucket，容易让 dev 环境出现“服务在、bucket 不在”的半完成状态。

### 3. 直接在本阶段接入正式云 S3

- 未采用理由：Task 1.4 面向 dev 基础设施，优先需要的是本地可重复 bootstrap，而不是正式云依赖。

## Verification

- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl apply --validate=false -f /tmp/koduck-dev-rendered-task1-4.yaml`
- `kubectl rollout status deployment/dev-minio -n koduck-dev`
- `kubectl wait --for=condition=complete job/dev-minio-bucket-init -n koduck-dev --timeout=180s`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`
- `kubectl logs job/dev-minio-bucket-init -n koduck-dev`

## References

- 设计文档: [koduck-memory-service-design.md](../design/koduck-memory-service-design.md)
- 任务清单: [koduck-memory-service-tasks.md](../implementation/koduck-memory-service-tasks.md)
- 前序 ADR: [0003-postgres-readiness-and-observability.md](./0003-postgres-readiness-and-observability.md)
- Issue: [#794](https://github.com/hailingu/koduck-quant/issues/794)
