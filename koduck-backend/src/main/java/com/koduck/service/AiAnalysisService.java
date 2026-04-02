package com.koduck.service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.koduck.dto.ai.*;

/**
 * AI 分析服务接口
 */
public interface AiAnalysisService {

    /**
     * 分析股票 - 调用 koduck-agent AI 服务
     */
    StockAnalysisResponse analyzeStock(Long userId, StockAnalysisRequest request);

    /**
     * 流式聊天，调用 koduck-agent
     */
    SseEmitter streamChat(Long userId, ChatStreamRequest request);

    /**
     * 推荐策略
     */
    StrategyRecommendResponse recommendStrategies(Long userId, StrategyRecommendRequest request);

    /**
     * 解读回测结果
     */
    BacktestInterpretResponse interpretBacktest(Long userId, Long backtestResultId);

    /**
     * 风险评估
     */
    RiskAssessmentResponse assessRisk(Long userId, Long portfolioId);
}
