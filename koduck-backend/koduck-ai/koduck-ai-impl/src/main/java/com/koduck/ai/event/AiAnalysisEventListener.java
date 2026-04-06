package com.koduck.ai.event;

import com.koduck.community.event.SignalPublishedEvent;
import com.koduck.portfolio.event.PortfolioCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * AI 分析事件监听器。
 *
 * <p>监听领域事件并触发 AI 分析。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiAnalysisEventListener {

    /**
     * 监听信号发布事件。
     *
     * <p>异步分析新发布的信号。</p>
     *
     * @param event 信号发布事件
     */
    @Async
    @EventListener
    public void onSignalPublished(SignalPublishedEvent event) {
        log.info("Received SignalPublishedEvent: signalId={}, symbol={}",
            event.getSignalId(), event.getSymbol());

        try {
            // 异步分析信号
            // TODO: 调用 AI 分析服务
            log.info("Analyzing signal {} for symbol {}",
                event.getSignalId(), event.getSymbol());

            // 模拟分析延迟
            Thread.sleep(100);

            log.info("Signal analysis completed: signalId={}", event.getSignalId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Signal analysis interrupted: signalId={}", event.getSignalId());
        }
    }

    /**
     * 监听投资组合创建事件。
     *
     * <p>异步分析新创建的投资组合。</p>
     *
     * @param event 投资组合创建事件
     */
    @Async
    @EventListener
    public void onPortfolioCreated(PortfolioCreatedEvent event) {
        log.info("Received PortfolioCreatedEvent: portfolioId={}, name={}",
            event.getPortfolioId(), event.getPortfolioName());

        try {
            // 异步分析投资组合
            // TODO: 调用 AI 分析服务
            log.info("Analyzing portfolio {} for user {}",
                event.getPortfolioId(), event.getUserId());

            // 模拟分析延迟
            Thread.sleep(100);

            log.info("Portfolio analysis completed: portfolioId={}", event.getPortfolioId());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Portfolio analysis interrupted: portfolioId={}", event.getPortfolioId());
        }
    }
}
