# ADR-0006: 社区信号查询链路 N+1 风险治理（EntityGraph 预加载）

- Status: Accepted
- Date: 2026-04-01
- Issue: #302

## Context

社区信号列表/详情读取路径中，`CommunitySignalResponseAssembler` 在组装 DTO 时对每条
`CommunitySignal` 执行一次 `userRepository.findById(...)`。当返回 N 条信号时，会出现
“1 次主查询 + N 次用户查询”的访问模式，存在典型 N+1 查询风险。

该问题在如下读取场景最明显：

- 信号列表：按状态、热门、symbol/type 过滤查询；
- 精选信号列表；
- 用户发布信号列表；
- 信号详情。

## Decision

采用 JPA `@EntityGraph(attributePaths = "user")` 在 `CommunitySignalRepository` 的关键读取方法中预加载 `user` 关联，并在组装器中优先使用 `signal.getUser()`。

具体执行：

- 为 `CommunitySignalRepository` 的核心读方法添加 `@EntityGraph(attributePaths = "user")`；
- 覆盖 `findById` 并加 `@EntityGraph(attributePaths = "user")`；
- 在 `CommunitySignalResponseAssembler.toSignalResponse` 中优先读取已加载的 `signal.user`，仅在缺失时兜底查询。

## Consequences

正向影响：

- 列表读取场景显著降低额外用户查询次数；
- 在保持 API 行为不变前提下提升查询效率；
- 方案局部、低风险，便于快速落地。

代价：

- Repository 查询声明增加，维护时需注意 EntityGraph 覆盖范围；
- 仍存在非 signal 路径的潜在 N+1（例如评论/订阅组装）需后续分批治理。

## Alternatives Considered

1. 在 Service 层批量预查询用户并手工映射  
   - 暂不采用：实现分散，重复逻辑较多。

2. 保持现状，仅依赖缓存缓解  
   - 拒绝：不能从查询结构上根治 N+1。

## Verification

- `CommunitySignalRepository` 关键读取方法已添加 `@EntityGraph(attributePaths = "user")`；
- `CommunitySignalResponseAssembler` 已优先使用 `signal.getUser()`；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
