# ADR-0058: HTTP 客户端统一迁移到 WebClient（响应式）

- Status: Accepted
- Date: 2026-04-04
- Issue: #408

## Context

当前代码库同时使用了两种 HTTP 客户端：

1. **RestTemplate**（同步阻塞）- 用于 `DataServiceClient` 和所有 Market Provider
2. **WebClient**（异步响应式）- 用于 `AiStreamRelaySupport`

这种混合使用导致：

- **维护成本增加**：团队需要熟悉两套不同的 API 和错误处理模式
- **线程模型不一致**：RestTemplate 阻塞线程 vs WebClient 非阻塞
- **资源管理复杂**：需要分别维护两套连接池和监控配置
- **架构合理性下降**：ARCHITECTURE-EVALUATION.md 明确指出这是架构缺陷

需要在保持现有功能的前提下，统一迁移到 WebClient。

## Decision

统一使用 **WebClient**（Project Reactor 响应式）作为唯一的 HTTP 客户端：

### 迁移范围

1. **DataServiceClient** - 触发 data-service 实时更新
2. **AbstractDataServiceMarketProvider** - 市场数据 Provider 基类
3. **AKShareDataProvider** - A 股数据 Provider
4. **USStockProvider** - 美股数据 Provider
5. **HKStockProvider** - 港股数据 Provider
6. **FuturesProvider** - 期货数据 Provider
7. **ForexProvider** - 外汇数据 Provider
8. **KlineSyncServiceImpl** - K 线数据同步
9. **删除 RestTemplateConfig** - 移除 RestTemplate 配置类

### 关键技术决策

1. **WebClient 配置扩展**：
   - 在 `WebClientConfig` 中配置基础超时和连接池
   - 为 data-service 调用配置独立的超时参数

2. **响应式处理策略**：
   - 对于现有同步调用场景，使用 `.block()` 进行桥接
   - 保持现有接口签名不变，内部实现改为 WebClient

3. **熔断器保持**：
   - Resilience4j Circuit Breaker 继续作用于 WebClient
   - 通过 Reactive 方式实现 fallback 逻辑

4. **错误处理统一**：
   - 统一使用 `WebClientResponseException` 处理 HTTP 错误
   - 保持现有的日志记录和监控方式

## Consequences

### 正向影响

- **架构简化**：单一 HTTP 客户端策略，降低认知负担
- **性能提升**：WebClient 支持高并发非阻塞 I/O，减少线程开销
- **资源统一**：统一的连接池和超时配置管理
- **未来扩展**：为全链路响应式编程（Reactive Programming）奠定基础
- **一致性**：与 Spring WebFlux 生态更契合

### 代价与风险

- **迁移成本**：需要修改多处代码，涉及测试用例更新
- **学习曲线**：团队需要熟悉 WebClient 的响应式编程模型
- **阻塞桥接**：在 `.block()` 场景下需要注意线程调度问题
- **兼容性**：需确保熔断器、超时等机制在新实现中正常工作

### 兼容性影响

- **API 兼容**：所有公共接口签名保持不变
- **配置兼容**：application.yml 中的超时配置需调整（从 RestTemplate 到 WebClient）
- **行为兼容**：fallback 逻辑保持相同，仅实现方式调整为响应式

## Alternatives Considered

1. **统一使用 RestClient（Spring 6.2 新增）**
   - 优点：同步 API，与 WebClient API 设计一致，迁移成本低
   - 缺点：仍使用阻塞 I/O，无法享受响应式的高并发优势
   - 结论：暂不采用，未来可考虑作为中间过渡方案

2. **保留现状**
   - 拒绝：架构评估已明确指出这是缺陷，需要修复

3. **分阶段迁移**
   - 采用：优先迁移 DataServiceClient，然后逐步迁移 Market Providers
   - 在单个 feature 分支内完成，保持原子性

## Verification

- [x] `DataServiceClient` 已迁移到 WebClient
- [x] 所有 Market Provider 已迁移到 WebClient
- [x] `RestTemplateConfig` 已删除
- [x] `WebClientConfig` 已更新配置
- [x] 单元测试和集成测试通过
- [x] Checkstyle 检查通过
- [x] `./scripts/quality-check.sh` 全绿
- [x] `mvn -f koduck-backend/pom.xml clean compile checkstyle:check` 无异常

## References

- [Spring WebClient 官方文档](https://docs.spring.io/spring-framework/docs/current/reference/html/web-reactive.html#webflux-client)
- [Resilience4j Reactive Circuit Breaker](https://resilience4j.readme.io/docs/circuitbreaker-reactor)
- ARCHITECTURE-EVALUATION.md - "架构合理性"章节
