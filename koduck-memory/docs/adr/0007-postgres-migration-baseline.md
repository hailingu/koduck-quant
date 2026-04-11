# ADR-0007: 为 koduck-memory 建立 PostgreSQL migration 基线

- Status: Accepted
- Date: 2026-04-12
- Issue: #800

## Context

Task 2.3 要求把 `koduck-memory` 的 PostgreSQL schema 从设计文档落成“可执行基线”，
否则后续 Task 3.x 的 session repository、AppendMemory、Summary 与事实提炼都缺少稳定的持久化落点。

在 Task 1.3 之前，服务只完成了：

1. PostgreSQL 连接池初始化
2. 启动期 `SELECT 1` 依赖校验
3. readiness / metrics 暴露

但仍存在三个缺口：

1. 目标数据库 `koduck_memory` 在 dev 环境里尚未创建。
2. 没有任何 migration 文件能够落地 `memory_sessions` 等核心表。
3. schema 约束还停留在设计文档，未被应用启动链路自动执行。

## Decision

### 在仓内维护 migration 基线

新增 `koduck-memory/migrations/0001_initial_schema.sql`，一次性创建：

1. `memory_sessions`
2. `memory_entries`
3. `memory_index_records`
4. `memory_summaries`
5. `memory_facts`
6. `memory_idempotency_keys`

同时补齐设计文档中定义的：

1. 主键
2. 唯一约束
3. 高频查询索引
4. 文本检索 GIN 索引

### 在服务启动期自动建库并执行 migration

保留配置入口仍然是 `postgres.dsn`，但服务启动时新增两步：

1. 先从 DSN 解析目标数据库名
2. 如目标库不存在，则连接 `postgres` 管理库创建目标数据库
3. 再连到目标库执行 embedded migrations

这样 dev rollout 本身就能验证：

1. 目标数据库存在
2. schema 已经初始化
3. readiness 只有在 migration 成功后才会变为 ready

### 不引入数据库外键

继续遵循设计文档约束：

1. 不在 PostgreSQL 中声明外键
2. `session_id`、`entry_id` 等逻辑关联由应用层维护

这样可以避免：

1. 异步索引/摘要链路被数据库级联约束绑死
2. 后续跨表重放、补偿、迁移时出现额外耦合

## Consequences

### 正向影响

1. Task 2.3 的 schema 要求从文档约束变成可执行基线。
2. dev 环境首次部署时不需要手工创建 `koduck_memory` 数据库。
3. 后续 Task 3.x / 4.x 可以直接在稳定表结构上实现 repository 与 service。

### 权衡与代价

1. 服务启动链路新增了“建库 + 跑 migration”步骤，启动逻辑更重一些。
2. 如果未来需要更复杂的数据库权限隔离，可能要把建库权限从应用运行时剥离出来。
3. migration 目前只有初始基线，后续变更需要继续按顺序追加版本。

### 兼容性影响

1. `POSTGRES__DSN` 从连接 `postgres` 管理库改为连接业务库 `koduck_memory`。
2. 现有健康检查与 readiness 语义保持不变，但 now implicitly includes migration success。
3. 没有对外 southbound gRPC contract 的 breaking change。

## Alternatives Considered

### 1. 只提供 SQL 文件，不在启动时自动执行

- 未采用理由：无法保证 rollout 成功时 schema 已经就绪，仍需要额外人工步骤。

### 2. 用独立 Kubernetes Job 执行数据库 migration

- 未采用理由：当前 bootstrap 阶段更需要最小可运行闭环；先把 migration 逻辑内聚到服务内更简单。

### 3. 给表之间加数据库外键

- 未采用理由：与设计文档“通过应用层维护逻辑关联”的原则冲突，也会增加异步写入链路耦合。

## Verification

- `docker run --rm ... cargo test`
- `docker build -t koduck-memory:dev ./koduck-memory`
- `kubectl rollout restart deployment/dev-koduck-memory -n koduck-dev`
- `kubectl rollout status deployment/dev-koduck-memory -n koduck-dev --timeout=180s`
- `kubectl exec -n koduck-dev statefulset/dev-postgres -- psql -U koduck -d postgres -c '\\dt koduck_memory.public.*'`

## References

- 设计文档: [koduck-memory-for-koduck-ai.md](../../../docs/design/koduck-memory-for-koduck-ai.md)
- 任务清单: [koduck-memory-koduck-ai-tasks.md](../../../docs/implementation/koduck-memory-koduck-ai-tasks.md)
- 前序 ADR: [0003-postgres-readiness-and-observability.md](./0003-postgres-readiness-and-observability.md)
- Issue: [#800](https://github.com/hailingu/koduck-quant/issues/800)
