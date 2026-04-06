# ADR-0143: 领域事件机制

- Status: Accepted
- Date: 2026-04-06
- Issue: #618

## Context

随着 Phase 2 完成，各业务领域模块已拆分完成：

- `koduck-market-impl`
- `koduck-portfolio-impl`
- `koduck-community-impl`
- `koduck-ai-impl`

当前模块间通信主要通过 ACL 接口直接调用，存在以下问题：

1. **耦合度高**：调用方需要知道被调用方的接口
2. **同步阻塞**：调用是同步的，影响响应时间
3. **难以扩展**：新增消费者需要修改调用方代码
4. **无法审计**：没有事件历史记录

### 当前通信方式

```java
// AI 模块直接调用 Portfolio ACL
@Service
public class AiAnalysisServiceImpl {
    private final PortfolioQueryService portfolioQueryService;
    
    public void analyze(Long portfolioId) {
        PortfolioSnapshot snapshot = portfolioQueryService.getSnapshot(portfolioId);
        // 分析逻辑
    }
}
```

### 期望的通信方式

```java
// Portfolio 模块发布事件
@Service
public class PortfolioCommandServiceImpl {
    private final DomainEventPublisher eventPublisher;
    
    public void createPortfolio(CreatePortfolioRequest request) {
        // 创建组合
        Portfolio portfolio = portfolioRepository.save(...);
        
        // 发布事件
        eventPublisher.publish(new PortfolioCreatedEvent(
            portfolio.getId(),
            portfolio.getName(),
            portfolio.getUserId()
        ));
    }
}

// AI 模块订阅事件
@Component
public class AiAnalysisEventListener {
    @EventListener
    public void onPortfolioCreated(PortfolioCreatedEvent event) {
        // 自动分析新创建的组合
        aiAnalysisService.analyze(event.getPortfolioId());
    }
}
```

## Decision

### 1. 领域事件架构

采用 Spring Event 作为基础，未来可扩展至 RabbitMQ：

```
koduck-common
└── event/
    ├── DomainEvent.java (基础事件类)
    └── DomainEventPublisher.java (发布器接口)

koduck-*-api
└── event/
    └── {Domain}Event.java (各领域事件)

koduck-infrastructure
└── event/
    ├── SpringDomainEventPublisher.java (Spring 实现)
    └── EventListenerSupport.java (监听器支持)
```

### 2. 基础事件类设计

```java
package com.koduck.common.event;

import java.time.Instant;
import java.util.UUID;

/**
 * 领域事件基类。
 *
 * <p>所有领域事件必须继承此类。</p>
 */
public abstract class DomainEvent {
    
    private final String eventId;
    private final Instant occurredOn;
    private final String eventType;
    
    protected DomainEvent() {
        this.eventId = UUID.randomUUID().toString();
        this.occurredOn = Instant.now();
        this.eventType = this.getClass().getSimpleName();
    }
    
    // Getters
    public String getEventId() { return eventId; }
    public Instant getOccurredOn() { return occurredOn; }
    public String getEventType() { return eventType; }
}
```

### 3. 事件发布器接口

```java
package com.koduck.common.event;

/**
 * 领域事件发布器。
 */
public interface DomainEventPublisher {
    
    /**
     * 发布领域事件。
     *
     * @param event 事件对象
     */
    void publish(DomainEvent event);
}
```

### 4. Spring 实现

```java
package com.koduck.infrastructure.event;

import com.koduck.common.event.DomainEvent;
import com.koduck.common.event.DomainEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SpringDomainEventPublisher implements DomainEventPublisher {
    
    private final ApplicationEventPublisher applicationEventPublisher;
    
    @Override
    public void publish(DomainEvent event) {
        applicationEventPublisher.publishEvent(event);
    }
}
```

### 5. 各领域事件定义

#### Portfolio 领域

```java
package com.koduck.portfolio.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

/**
 * 投资组合创建事件。
 */
@Getter
public class PortfolioCreatedEvent extends DomainEvent {
    
    private final Long portfolioId;
    private final String portfolioName;
    private final Long userId;
    
    public PortfolioCreatedEvent(Long portfolioId, String portfolioName, Long userId) {
        super();
        this.portfolioId = portfolioId;
        this.portfolioName = portfolioName;
        this.userId = userId;
    }
}
```

#### Community 领域

```java
package com.koduck.community.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

/**
 * 信号发布事件。
 */
@Getter
public class SignalPublishedEvent extends DomainEvent {
    
    private final Long signalId;
    private final String symbol;
    private final String signalType;
    private final Long publisherId;
    
    public SignalPublishedEvent(Long signalId, String symbol, 
                                String signalType, Long publisherId) {
        super();
        this.signalId = signalId;
        this.symbol = symbol;
        this.signalType = signalType;
        this.publisherId = publisherId;
    }
}
```

#### Market 领域

```java
package com.koduck.market.event;

import com.koduck.common.event.DomainEvent;
import lombok.Getter;

import java.math.BigDecimal;

/**
 * 行情数据更新事件。
 */
@Getter
public class MarketDataUpdatedEvent extends DomainEvent {
    
    private final String symbol;
    private final BigDecimal currentPrice;
    private final BigDecimal changePercent;
    
    public MarketDataUpdatedEvent(String symbol, BigDecimal currentPrice, 
                                   BigDecimal changePercent) {
        super();
        this.symbol = symbol;
        this.currentPrice = currentPrice;
        this.changePercent = changePercent;
    }
}
```

### 6. 事件监听器示例

```java
package com.koduck.ai.event;

import com.koduck.community.event.SignalPublishedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiAnalysisEventListener {
    
    private final AiAnalysisService aiAnalysisService;
    
    /**
     * 监听信号发布事件，自动进行分析。
     */
    @Async
    @EventListener
    public void onSignalPublished(SignalPublishedEvent event) {
        log.info("Received SignalPublishedEvent: signalId={}", event.getSignalId());
        
        // 异步分析信号
        aiAnalysisService.analyzeSignal(event.getSignalId());
    }
}
```

### 7. 试点场景

选择 **信号发布通知** 作为试点场景：

1. 用户发布信号
2. `CommunitySignalService` 发布 `SignalPublishedEvent`
3. `AiAnalysisEventListener` 订阅并分析信号
4. `NotificationEventListener` 订阅并发送通知

### 8. 配置

```java
package com.koduck.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

@Configuration
@EnableAsync
public class EventConfig {
    // 异步事件配置
}
```

## Consequences

### 正向影响

1. **模块解耦**：发布方不需要知道谁订阅了事件
2. **异步处理**：事件处理是异步的，不阻塞主流程
3. **易于扩展**：新增消费者只需添加监听器
4. **可审计**：事件可以持久化用于审计
5. **支持 Saga**：为分布式事务奠定基础

### 代价与风险

1. **最终一致性**：事件处理是异步的，数据可能短暂不一致
2. **调试困难**：异步流程调试比同步困难
3. **事件风暴**：可能产生大量事件，需要限流
4. **顺序保证**：需要额外机制保证事件顺序

### 兼容性影响

- **现有代码**：ACL 接口保留，逐步迁移到事件驱动
- **数据库**：无变化
- **API**：无变化
- **部署**：需要配置异步线程池

## Alternatives Considered

1. **直接使用 RabbitMQ**
   - 拒绝：引入外部依赖，增加复杂度
   - 当前方案：先使用 Spring Event，未来可扩展至 RabbitMQ

2. **使用 Axon Framework**
   - 拒绝：学习成本高，过度工程
   - 当前方案：轻量级实现，满足当前需求

3. **保持直接调用**
   - 拒绝：耦合度高，难以扩展
   - 当前方案：引入事件机制解耦

## Implementation

### 交付物

1. **ADR-0143**: 本决策记录
2. **DomainEvent.java**: 基础事件类
3. **DomainEventPublisher.java**: 发布器接口
4. **SpringDomainEventPublisher.java**: Spring 实现
5. **各领域事件类**:
   - `PortfolioCreatedEvent`
   - `SignalPublishedEvent`
   - `MarketDataUpdatedEvent`
6. **EventConfig.java**: 配置类
7. **示例监听器**: `AiAnalysisEventListener`

### 验证清单

- [x] DomainEvent 基础类创建
- [ ] 各领域事件定义完成
- [ ] 事件发布/订阅机制运行正常
- [ ] 至少一个业务场景使用事件驱动
- [ ] 质量检查脚本全绿
- [ ] 代码编译通过

## References

- [ARCHITECTURE-TASKS.md](./ARCHITECTURE-TASKS.md) - Task 3.3
- [Spring Events](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/context/event/package-summary.html) - Spring 事件文档
- [DDD 领域事件](https://ddd-practitioners.com/domain-event) - DDD 领域事件模式
