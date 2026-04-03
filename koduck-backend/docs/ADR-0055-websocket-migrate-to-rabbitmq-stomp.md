# ADR-0055: WebSocket 迁移到 RabbitMQ STOMP

- Status: Accepted
- Date: 2026-04-04
- Issue: #402
- PR: (待定)

## Context

当前系统使用 Spring 内置的 `SimpleBroker`（内存级消息代理）处理 WebSocket 消息：

```java
// 当前配置（问题代码）
@Override
public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableSimpleBroker("/topic", "/queue");
    // ...
}
```

**核心问题**：订阅状态存储在实例内存中，多实例部署时无法共享：

- 用户1连接实例A，订阅 `/topic/stock/AAPL`
- 用户2连接实例B，订阅 `/topic/stock/AAPL`
- 当 AAPL 价格更新到达实例A时，只有用户1能收到推送
- 用户2因连接在实例B，无法收到更新

这在生产环境高并发场景下是不可接受的。

## Decision

将消息代理从 `SimpleBroker` 迁移到 **RabbitMQ STOMP**，使用 `StompBrokerRelay`：

```java
// 新配置
@Override
public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableStompBrokerRelay("/topic", "/queue")
            .setRelayHost(rabbitmqProperties.getHost())
            .setRelayPort(61613)  // STOMP 协议端口
            .setClientLogin(rabbitmqProperties.getUsername())
            .setClientPasscode(rabbitmqProperties.getPassword());
    // ...
}
```

**方案要点**：

1. **引入 RabbitMQ 服务**：在 docker-compose 中增加 RabbitMQ 容器，启用 STOMP 插件
2. **配置迁移**：`WebSocketConfig` 改为使用 `StompBrokerRelay`
3. **配置外化**：RabbitMQ 连接参数通过 `RabbitMQProperties` 配置类管理
4. **协议兼容**：保持 STOMP 协议，前端客户端无需任何改动

## Consequences

正向影响：

- **订阅状态共享**：所有实例共享 RabbitMQ 中的订阅关系，任意实例推送，所有订阅者都能收到
- **横向扩展**：增加后端实例即可提升连接和消息处理能力
- **高可用**：RabbitMQ 支持集群模式，可配置镜像队列实现故障转移
- **削峰填谷**：消息队列缓冲，避免瞬时高流量冲垮服务
- **生产级稳定性**：RabbitMQ 是金融级验证的消息中间件

代价：

- **运维复杂度增加**：需要维护 RabbitMQ 服务（监控、告警、备份）
- **网络延迟增加**：消息需经过 RabbitMQ 中转（通常 <1ms，可接受）
- **部署依赖**：本地开发环境需要启动 RabbitMQ 容器

## Alternatives Considered

1. **Redis Pub/Sub 作为消息代理**
   - 拒绝：Spring 的 `StompBrokerRelay` 不直接支持 Redis Pub/Sub，需自行实现桥接，复杂度更高

2. **Kafka + 自定义消息路由**
   - 拒绝：Kafka 是日志型消息队列，不适合实时推送场景；且缺少 STOMP 协议原生支持

3. **使用 Hazelcast/Apache Ignite 分布式内存网格**
   - 拒绝：引入新的分布式系统增加学习成本，且生态不如 RabbitMQ 成熟

4. **保持 SimpleBroker，通过 Redis Pub/Sub 广播消息到所有实例**
   - 拒绝：需要自行实现消息广播和订阅状态同步，代码复杂且容易出错

## Compatibility

- **前端协议完全兼容**：STOMP 协议不变，前端订阅逻辑无需改动
- **后端 API 不变**：WebSocket 端点、消息格式、目的地前缀保持不变
- **配置平滑迁移**：通过 `RabbitMQProperties` 配置，默认启用 RabbitMQ 模式
- **本地开发**：docker-compose 自动启动 RabbitMQ，对开发者透明

## Verification

- WebSocket 连接建立测试
- 多实例消息广播测试
- 质量检查通过：`./scripts/quality-check.sh`
- Checkstyle 无违规：`mvn checkstyle:check`
