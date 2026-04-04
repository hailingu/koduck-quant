# ADR-0060: Service 层异常捕获精细化

- Status: Accepted
- Date: 2026-04-04
- Issue: #414

## Context

根据 `ARCHITECTURE-EVALUATION.md` 的代码质量评估，Service 层存在多处过度使用 `catch (Exception e)` 的情况：

1. **StockSubscriptionServiceImpl**: 订阅/取消订阅/推送价格更新时捕获 Exception
2. **StockCacheServiceImpl**: 缓存操作时捕获 Exception
3. **BacktestServiceImpl**: 回测执行时捕获 Exception
4. **UserCacheServiceImpl**: 用户缓存操作时捕获 Exception
5. **MarketSentimentServiceImpl**: 市场情绪计算时捕获 Exception

这些问题导致：
- 吞掉具体异常类型，调用方难以根据异常类型做差异化处理
- 掩盖本应立即暴露的系统缺陷（如 OOM、InterruptedException）
- 日志中丢失原始异常类型信息，调试困难

## Decision

### 异常捕获范围收窄

将 Service 层中过于宽泛的 `catch (Exception e)` 统一收窄为 `catch (RuntimeException e)`：

```java
// 修改前
catch (Exception e) {
    log.warn("Failed to ...: {}", e.getMessage());
    return fallbackValue;
}

// 修改后
catch (RuntimeException e) {
    log.warn("Failed to ...: {}", e.getMessage());
    return fallbackValue;
}
```

### 修改范围

| 文件 | 修改位置 | 说明 |
|------|----------|------|
| StockSubscriptionServiceImpl.java | 3 处 | 订阅、取消订阅、价格推送 |
| StockCacheServiceImpl.java | 6 处 | 缓存读写操作 |
| BacktestServiceImpl.java | 1 处 | 回测执行 |
| UserCacheServiceImpl.java | 8 处 | 用户追踪/观察列表缓存 |
| MarketSentimentServiceImpl.java | 3 处 | 情绪计算、活跃度、波动率 |

### 保留策略

以下场景保持现状，不修改：

1. **DataInitializer**: 启动初始化时的容错处理，需要捕获所有异常防止启动失败
2. **监控类 (MonitoringServiceImpl)**: 监控检查失败不应影响主流程
3. **邮件服务 (EmailServiceImpl)**: 邮件发送失败是边缘功能，不应影响主流程
4. **限流服务 (RateLimiterServiceImpl)**: Redis 异常时需要降级允许请求通过
5. **工具类 (DataConverter, AKShareDataMapperSupport)**: 数据转换的容错处理
6. **WebSocket 消息解析**: 消息解析失败不应断开连接

## Consequences

### 正向影响

- 异常捕获范围从 `Exception` 收窄到 `RuntimeException`，避免受检异常被无意义吞掉
- 系统级错误（如 OOM、InterruptedException）将向上传播，由全局异常处理器处理或导致应用终止
- 问题定位更精确，日志中保留原始异常类型信息

### 兼容性影响

- 行为变更：原本会被捕获的受检异常（如 IOException）现在会向上传播
- 风险评估：这些异常原本就是被"意外"捕获的，正确行为应该是向上传播
- 降级逻辑保留：对于预期的运行时异常（如 Redis 连接失败），仍保留降级处理

## Alternatives Considered

1. **捕获更具体的异常（如 DataAccessException、RedisConnectionFailureException）**
   - 拒绝：需要引入额外的依赖和类型检查，复杂度较高
   - 当前方案：使用 RuntimeException 作为合理折中，涵盖所有业务/数据访问异常

2. **完全移除 try-catch，所有异常向上传播**
   - 拒绝：缓存、订阅等场景需要合理的降级逻辑，不能直接失败
   - 当前方案：保留降级逻辑，仅收窄异常捕获范围

3. **使用 @SneakyThrows 或异常包装**
   - 拒绝：不符合项目编码规范，会增加调试复杂度

## Verification

- `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- `./koduck-backend/scripts/quality-check.sh` 全绿
