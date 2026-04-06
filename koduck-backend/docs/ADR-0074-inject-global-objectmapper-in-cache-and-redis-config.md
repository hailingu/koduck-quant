# ADR-0074: 在 CacheConfig 与 RedisConfig 中注入全局 ObjectMapper

- Status: Accepted
- Date: 2026-04-04
- Issue: #442

## Context

`ARCHITECTURE-EVALUATION.md` 指出：`CacheConfig` 自行创建 `ObjectMapper` 实例，可能与全局配置不一致。进一步审查发现，`RedisConfig` 也存在同样的问题。

当前实现：
- `CacheConfig.createJsonSerializer()` 中 `new ObjectMapper()`，仅注册 `JavaTimeModule`
- `RedisConfig.createObjectMapper()` 中 `new ObjectMapper()`，仅注册 `JavaTimeModule`
- `RabbitPricePushConfig.rabbitMessageConverter(ObjectMapper)` 已正确注入 Spring 管理的 `ObjectMapper`

这会导致：
- **配置割裂**：`spring.jackson.*`（日期格式、命名策略、忽略未知字段等）对 Redis/Cache 序列化失效
- **序列化不一致**：同一对象通过 Web API 返回的 JSON 格式可能与 Redis 缓存中的格式不同，前端解析时容易出错
- **维护负担**：两处各自维护孤立的 ObjectMapper 创建逻辑，新增 Jackson Module 时需要改多个地方

## Decision

### 1. 注入全局 ObjectMapper

在 `CacheConfig` 和 `RedisConfig` 的构造函数中注入 Spring Boot 自动配置的 `ObjectMapper` Bean。

### 2. 使用 `copy()` 避免副作用

由于 Redis/Cache 需要额外注册 `JavaTimeModule`，而全局 `ObjectMapper` 可能已被其他组件共享，因此采用 `objectMapper.copy().registerModule(new JavaTimeModule())`：
- 继承全局 Jackson 配置（`spring.jackson.*` 及所有自动注册的模块）
- 不影响 Web 层、RabbitMQ 消息转换器等共享实例
- 满足 Redis JSON 序列化对 Java 8 日期时间的支持

### 3. 删除私有静态工厂方法

移除 `CacheConfig.createJsonSerializer()` 和 `RedisConfig.createObjectMapper()` 这两个无参静态方法，改为在 Bean 方法内部基于注入的 `ObjectMapper` 构造序列化器。

## Consequences

### 正向影响

- **配置一致性**：Redis/Cache 的 JSON 序列化行为与 Web API 对齐
- **可维护性提升**：Jackson 相关配置集中由 Spring Boot 管理，无需在配置类中重复创建 ObjectMapper
- **与现有实践对齐**：`RabbitPricePushConfig` 已采用注入模式，`CacheConfig` 和 `RedisConfig` 与其保持一致

### 兼容性影响

- **无 API 变更**：HTTP 接口、DTO 结构、数据库表结构均无变化
- **无行为倒退**：`JavaTimeModule` 仍然被注册，现有日期/时间类型的序列化能力保留
- **测试影响**：`CacheConfigTest` 等涉及配置类构造的测试可能需要补充或调整 ObjectMapper 的 mock/注入方式

## Alternatives Considered

1. **直接修改注入的全局 ObjectMapper（不 copy）**
   - 拒绝：注册 `JavaTimeModule` 会改变全局实例状态，可能影响 Controller、RabbitMQ 等其他组件的序列化行为（尽管 JavaTimeModule 通常是幂 additive，但修改共享实例仍属不良实践）
   - 当前方案：使用 `copy()` 创建独立副本

2. **保持现状（继续 new ObjectMapper）**
   - 拒绝：明确存在配置不一致风险，且已被架构评估报告列为缺陷
   - 当前方案：注入全局实例

3. **自定义 Jackson2ObjectMapperBuilder Bean 统一构建**
   - 拒绝：项目已经依赖 Spring Boot 的自动配置，引入额外的 Builder 会增加不必要的复杂度；`ObjectMapper.copy()` 足够满足需求
   - 当前方案：直接注入 Spring Boot 自动配置的 ObjectMapper

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
- 所有现有单元测试与切片测试通过
