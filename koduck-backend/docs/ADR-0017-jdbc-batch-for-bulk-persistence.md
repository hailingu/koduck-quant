# ADR-0017: 批量持久化启用 JDBC Batch

- Status: Accepted
- Date: 2026-04-02
- Issue: #324

## Context

当前代码中存在多处批量持久化操作（如 `saveAll`），但 JPA/Hibernate 未显式启用 JDBC Batch。该情况下批量 Insert/Update 可能退化为逐条 SQL 执行，造成：

- 往返数据库次数偏高；
- 批量写入吞吐受限；
- 在同步任务或批处理场景下耗时放大。

## Decision

在全局 JPA 配置中启用 Hibernate JDBC Batch：

- `hibernate.jdbc.batch_size=${JPA_JDBC_BATCH_SIZE:50}`
- `hibernate.jdbc.batch_versioned_data=true`
- `hibernate.order_inserts=true`
- `hibernate.order_updates=true`

采用环境变量方式暴露批大小，便于按环境调优。

## Consequences

正向影响：

- 批量 Insert/Update 场景减少 SQL 往返，提升吞吐；
- 对 `saveAll` 等批处理路径具备直接收益；
- 批大小可配置，便于压测后微调。

代价：

- 过大的 batch 可能增加内存占用或锁竞争；
- 需要结合数据库参数与业务负载做容量验证。

## Alternatives Considered

1. 保持默认配置，不启用 batch
   - 拒绝：无法改善批量写入性能瓶颈。

2. 在代码层手工分批，不改 Hibernate 配置
   - 未采用：维护成本高，难以统一覆盖所有持久化路径。

## Verification

- `application.yml` 已启用 JDBC Batch 与 insert/update 排序；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
