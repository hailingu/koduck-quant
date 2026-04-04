package com.koduck.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.koduck.dto.ai.BacktestInterpretResponse;
import com.koduck.dto.ai.ChatStreamRequest;
import com.koduck.dto.ai.RiskAssessmentResponse;
import com.koduck.dto.ai.StockAnalysisRequest;
import com.koduck.dto.ai.StockAnalysisResponse;
import com.koduck.dto.ai.StrategyRecommendRequest;
import com.koduck.dto.ai.StrategyRecommendResponse;

/**
 * AI分析服务接口，提供股票分析、聊天流、策略推荐、
 * 回测解读和风险评估功能。
 *
 * @author Koduck Team
 */
public interface AiAnalysisService {

    /**
     * 使用AI服务分析股票。
     *
     * @param userId  用户ID
     * @param request 股票分析请求
     * @return 股票分析响应
     */
    StockAnalysisResponse analyzeStock(Long userId, StockAnalysisRequest request);

    /**
     * 使用AI服务流式聊天响应。
     *
     * @param userId  用户ID
     * @param request 聊天流请求
     * @return 用于流式响应的SSE发射器
     */
    SseEmitter streamChat(Long userId, ChatStreamRequest request);

    /**
     * 根据用户请求推荐策略。
     *
     * @param userId  用户ID
     * @param request 策略推荐请求
     * @return 策略推荐响应
     */
    StrategyRecommendResponse recommendStrategies(
            Long userId,
            StrategyRecommendRequest request);

    /**
     * 使用AI解读回测结果。
     *
     * @param userId           用户ID
     * @param backtestResultId 回测结果ID
     * @return 回测解读响应
     */
    BacktestInterpretResponse interpretBacktest(
            Long userId,
            Long backtestResultId);

    /**
     * 使用AI评估投资组合风险。
     *
     * @param userId      用户ID
     * @param portfolioId 投资组合ID
     * @return 风险评估响应
     */
    RiskAssessmentResponse assessRisk(Long userId, Long portfolioId);
}
