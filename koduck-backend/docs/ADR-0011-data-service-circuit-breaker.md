# ADR-0011: 外部数据服务调用引入 Circuit Breaker（Resilience4j）

- Status: Accepted
- Date: 2026-04-01
- Issue: #312

## Context

`DataServiceClient` 负责触发 data-service 的实时更新调用。当前链路在下游持续失败时缺少熔断机制，可能导致：

- 持续重试/调用放大下游故障；
- 上游线程和连接资源被无效调用占用；
- 故障恢复前系统稳定性下降。

需要在不改变既有业务接口的前提下，引入可配置、可观测的熔断保护。

## Decision

采用 Resilience4j Circuit Breaker，并首批落地到 `DataServiceClient` 外部调用：

- 引入 `resilience4j-spring-boot3` 依赖；
- 在 `DataServiceClient#triggerRealtimeUpdate(List<String>)` 增加 `@CircuitBreaker`；
- 配置 `dataServiceClient` 熔断实例（窗口、失败率阈值、Open 等待时长、Half-Open 探测量）；
- 增加 fallback：熔断打开或调用异常时记录告警日志并快速返回。

## Consequences

正向影响：

- 连续失败场景下快速失败，避免故障扩散；
- 调用方行为保持兼容（失败时仍以“记录并返回”为主）；
- 熔断参数可通过配置和环境变量调整。

代价：

- 新增运行时依赖与配置维护成本；
- 首批仅覆盖 `DataServiceClient`，其他外部调用链路需后续分批纳入。

## Alternatives Considered

1. 仅使用重试（无熔断）  
   - 拒绝：下游故障持续时会增加压力，无法快速止损。

2. 自研熔断逻辑  
   - 暂不采用：成熟度与可观测性不如 Resilience4j，维护成本高。

## Verification

- `pom.xml` 已引入 Resilience4j 依赖；
- `DataServiceClient` 已接入 `@CircuitBreaker` 与 fallback；
- `application.yml` 已新增 `resilience4j.circuitbreaker.instances.dataServiceClient` 配置；
- 编译验证通过：`mvn -DskipTests compile -f koduck-backend/pom.xml`。
