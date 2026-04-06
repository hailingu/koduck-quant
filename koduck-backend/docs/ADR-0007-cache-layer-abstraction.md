# ADR-0007: 统一缓存访问抽象层（CacheLayer）

- Status: Accepted
- Date: 2026-04-01
- Issue: #304

## Context

当前缓存策略在多个服务实现中分散：

- `UserCacheServiceImpl` 与 `StockCacheServiceImpl` 都直接依赖 `RedisTemplate`
- key 删除、集合替换、列表替换、TTL 设置等底层模式重复出现
- 异常处理和参数校验逻辑分散，维护时容易产生不一致

在不改变业务接口的前提下，需要建立统一缓存访问层来收敛实现细节。

## Decision

引入统一缓存抽象 `CacheLayer`，并提供 Redis 实现 `RedisCacheLayer`，统一承载：

- value 读写（含 TTL）
- key 删除与存在性判断
- set/list 的替换和读取操作

然后将以下服务迁移为依赖 `CacheLayer`：

- `UserCacheServiceImpl`
- `StockCacheServiceImpl`

保留现有服务接口和 key 规则，确保上层调用无感知。

## Consequences

正向影响：

- 缓存底层操作集中，减少重复代码；
- 缓存策略更一致，后续维护成本下降；
- 后续若切换缓存实现或统一监控/熔断策略，改动面更小。

代价：

- 增加一层抽象，初期阅读链路略变长；
- 需要在新增缓存场景中遵循抽象层而非直接注入 `RedisTemplate`。

## Alternatives Considered

1. 保持现状，分别维护多个 CacheService 实现  
   - 拒绝：重复逻辑持续增长，策略一致性难保障。

2. 全量切换到 Spring Cache 注解统一管理  
   - 暂不采用：当前存在集合结构与细粒度 key 操作，迁移成本和风险较高。

## Verification

- 新增 `CacheLayer` 与 `RedisCacheLayer`；
- `UserCacheServiceImpl` 与 `StockCacheServiceImpl` 已迁移到抽象层；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
