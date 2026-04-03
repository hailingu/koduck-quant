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
 * AI analysis service interface for stock analysis,
 * chat streaming, strategy recommendation, backtest interpretation,
 * and risk assessment.
 *
 * @author Koduck Team
 */
public interface AiAnalysisService {

    /**
     * Analyzes a stock using AI service.
     *
     * @param userId  the user ID
     * @param request the stock analysis request
     * @return the stock analysis response
     */
    StockAnalysisResponse analyzeStock(Long userId, StockAnalysisRequest request);

    /**
     * Streams chat response using AI service.
     *
     * @param userId  the user ID
     * @param request the chat stream request
     * @return the SSE emitter for streaming response
     */
    SseEmitter streamChat(Long userId, ChatStreamRequest request);

    /**
     * Recommends strategies based on user request.
     *
     * @param userId  the user ID
     * @param request the strategy recommendation request
     * @return the strategy recommendation response
     */
    StrategyRecommendResponse recommendStrategies(
            Long userId,
            StrategyRecommendRequest request);

    /**
     * Interprets backtest results using AI.
     *
     * @param userId         the user ID
     * @param backtestResultId the backtest result ID
     * @return the backtest interpretation response
     */
    BacktestInterpretResponse interpretBacktest(
            Long userId,
            Long backtestResultId);

    /**
     * Assesses portfolio risk using AI.
     *
     * @param userId      the user ID
     * @param portfolioId the portfolio ID
     * @return the risk assessment response
     */
    RiskAssessmentResponse assessRisk(Long userId, Long portfolioId);
}
