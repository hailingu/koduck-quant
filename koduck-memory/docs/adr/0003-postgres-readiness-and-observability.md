# ADR-0003: 为 koduck-memory 建立 PostgreSQL readiness 与基础观测基线

- Status: Accepted
- Date: 2026-04-12
- Issue: #792

## Context

Task 1.2 之后，`koduck-memory` 已经具备配置与 Secret 管理能力，但服务仍然没有真正
连接 PostgreSQL，HTTP 探针也没有区分 liveness 与 readiness，导致：

1. Pod 只能反映“进程还活着”，不能反映“数据库依赖已就绪”。
2. `/metrics` 只有静态 build 信息，无法为后续存储接入提供基础观测。
3. `POSTGRES__DSN` 虽然存在，但没有被真实验证。

Task 1.3 要求先打通 PostgreSQL 连接池和健康检查，再为后续 Task 2.3 的 schema /
migration 基线提供可运行的存储入口。

## Decision

### PostgreSQL 连接池

引入 `sqlx` PostgreSQL 连接池，在启动阶段执行以下流程：

1. 读取 `POSTGRES__DSN`
2. 创建最小连接池
3. 执行 `SELECT 1`
4. 成功后才继续暴露服务

如果初始化阶段数据库不可达，服务直接失败退出，避免把错误延迟到业务路径。

### readiness / liveness 分离

在 metrics 端口暴露：

- `/livez`: 仅表示进程可用
- `/readyz`: 依赖 PostgreSQL 健康检查结果
- `/healthz`: 兼容现有调用，等价于 `/readyz`

Kubernetes 中：

- liveness probe 改为 `/livez`
- readiness probe 改为 `/readyz`

这样数据库短暂抖动不会被当成“进程死亡”，但依赖异常会及时把 Pod 从流量中摘除。

### 后台健康探测

启动后使用后台周期性 `SELECT 1` 刷新 PostgreSQL 状态，将 readiness 与 metrics
持续绑定到当前依赖状态，而不是只在启动时检查一次。

### 基础 metrics

在 `/metrics` 中增加最小可用指标：

- `koduck_memory_readiness`
- `koduck_memory_postgres_up`
- `koduck_memory_postgres_pool_size`
- `koduck_memory_postgres_pool_idle`

### PostgreSQL 数据库选择

由于 `koduck-dev` 当前尚未创建独立的 `koduck_memory` 数据库，而 Task 2.3 才负责
建立 migration 基线，本阶段先把 DSN 指向现有可用的 `postgres` 数据库，以保证
连接池、探针和 rollout 验证可以先跑通。

这被视为 bootstrap 选择，不代表后续长期数据归属决策。

## Consequences

### 正向影响

1. `koduck-memory` 对 PostgreSQL 的依赖已经成为运行时真条件，而不是仅存在于配置中。
2. readiness 真正反映依赖就绪状态，`koduck-dev` rollout 更可信。
3. 基础 metrics 已能反映数据库连通性与连接池状态，便于后续观测扩展。

### 权衡与代价

1. 当前健康探测使用简单 `SELECT 1`，足以满足 Task 1.3，但后续仍需补充更细粒度数据库错误分类。
2. 暂时复用 `postgres` 数据库而不是独立 `koduck_memory`，这是一种阶段性折中。
3. 目前 metrics 仍为手工拼接 Prometheus 文本，后续若指标继续增加，可以再引入专用 metrics 库。

### 兼容性影响

1. k8s 探针路径从统一 `/healthz` 调整为 `/livez` + `/readyz`，但保留 `/healthz` 兼容。
2. `POSTGRES__DSN` 现在会在启动时被真实校验，错误配置将导致快速失败。

## Alternatives Considered

### 1. 仅在 `/healthz` 请求时临时连接数据库

- 拒绝理由：无法提供稳定连接池，也会让探针本身变成高频建连操作。

### 2. 仍保持 `/healthz` 单一路径

- 拒绝理由：会让 Kubernetes 无法区分“依赖暂不可用”和“进程已经失活”。

### 3. 本阶段同时创建独立 `koduck_memory` 数据库

- 未采用理由：会把 Task 1.3 和 Task 2.3 的职责混在一起，增加变更面。

## Verification

- `docker run --rm ... cargo test`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl apply --validate=false -f /tmp/koduck-dev-rendered-task1-3.yaml`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev`
- `kubectl logs deployment/dev-koduck-memory -n koduck-dev`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0002-config-and-secret-management.md](./0002-config-and-secret-management.md)
- Issue: [#792](https://github.com/hailingu/koduck-quant/issues/792)
