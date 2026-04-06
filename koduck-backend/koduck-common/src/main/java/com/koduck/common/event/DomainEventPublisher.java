package com.koduck.common.event;

/**
 * 领域事件发布器接口。
 *
 * <p>定义领域事件的发布契约。实现类负责将事件传递给所有订阅者。</p>
 *
 * <p>使用示例：</p>
 * <pre>
 * &#64;Service
 * public class PortfolioService {
 *     private final DomainEventPublisher eventPublisher;
 *
 *     public void createPortfolio(CreatePortfolioRequest request) {
 *         // 业务逻辑...
 *
 *         // 发布事件
 *         eventPublisher.publish(new PortfolioCreatedEvent(portfolioId, name, userId));
 *     }
 * }
 * </pre>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface DomainEventPublisher {

    /**
     * 发布领域事件。
     *
     * <p>事件将被异步分发给所有订阅者。</p>
     *
     * @param event 领域事件对象，不能为 null
     * @throws IllegalArgumentException 如果 event 为 null
     */
    void publish(DomainEvent event);
}
