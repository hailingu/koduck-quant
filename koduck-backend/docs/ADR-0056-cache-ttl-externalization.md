# ADR-0056: 缓存 TTL 外部化配置

- Status: Accepted
- Date: 2026-04-04
- Issue: #404

## Context

当前 `CacheConfig.java` 将各缓存名称（`price`、`kline`、`marketSearch` 等）的 TTL 以 `private static final Duration` 硬编码在 Java 代码中：

```java
private static final Duration TTL_30_SECONDS = Duration.ofSeconds(30);
private static final Duration TTL_1_MINUTE = Duration.ofMinutes(1);
// ...
```

这导致：
- 无法在不修改代码、不重新编译部署的情况下调整缓存过期时间
- 开发/测试环境无法快速缩短 TTL 验证缓存失效逻辑
- 生产环境无法根据市场时段或负载动态调整策略

ARCHITECTURE-EVALUATION.md 将其列为可扩展性缺陷之一。

## Decision

引入 `CacheProperties` 配置类，将 TTL 从 `CacheConfig` 迁移到 `application.yml`（`koduck.cache.*` 前缀），采用 Spring Boot `@ConfigurationProperties` 机制：

1. 新建 `CacheProperties`（`@ConfigurationProperties(prefix = "koduck.cache")`）
2. `CacheConfig` 通过构造器注入 `CacheProperties`，替代原有硬编码常量
3. 在 `application.yml` 中声明默认值，保持与改造前完全一致
4. 不引入 Apollo/Nacos 等外部配置中心，避免当前阶段基础设施过重

## Consequences

正向影响：

- TTL 可通过 `application.yml`、环境变量或 profile 覆盖，无需改代码
- 默认行为不变，对现有 Service 层 `@Cacheable` 注解零侵入
- 为后续动态策略（如 Redis 策略表、规则引擎）预留扩展点

代价：

- 增加一个 `CacheProperties` 类，配置链路略变长
- 修改配置后需要重启服务（对当前阶段可接受）

## Alternatives Considered

1. 引入 Apollo / Nacos 配置中心
   - 拒绝：仅为解决 TTL 硬编码问题引入整套配置中心基础设施，运维成本和架构复杂度过高。

2. 使用 Redis 策略表实现运行时热更新
   - 暂不采用：当前阶段重启更新足够，热更新可在后续有明确需求时叠加。

3. 保持现状，继续硬编码
   - 拒绝：不符合 ARCHITECTURE-EVALUATION.md 的优化方向，可扩展性受限。

## Compatibility

- **默认行为完全一致**：`application.yml` 中默认值与改造前相同
- **Service 层零改动**：`@Cacheable` 注解、cache name、`CacheConfig` 常量均保持不变
- **API 兼容**：无外部接口变更
- **测试兼容**：`CacheConfigTest` 更新为注入 `CacheProperties`，断言逻辑不变

## Verification

- `CacheProperties` 编译通过并注册为 Spring Bean
- `CacheConfigTest` 验证各 cache 的 TTL 与预期一致
- `mvn -f koduck-backend/pom.xml clean compile` 通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 通过
- `./koduck-backend/scripts/quality-check.sh` 全绿
