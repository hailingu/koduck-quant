package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.ai.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.AiAnalysisService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller providing AI analysis endpoints.
 *
 * <p>Endpoints include stock analysis, strategy recommendations, backtest
 * interpretation, and risk assessments. All require an authenticated user.</p>
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI分析", description = "智能股票分析、策略推荐、风险评估等AI分析接口")
@Slf4j
public class AiAnalysisController {

    private final AiAnalysisService aiAnalysisService;

    /**
     * Analyze a stock using AI models.
     *
     * @param userPrincipal authenticated user principal
     * @param request       details of the stock to analyze
     * @return analysis result wrapped in {@link ApiResponse}
     */
    @PostMapping("/analyze")
    public ApiResponse<StockAnalysisResponse> analyzeStock(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody StockAnalysisRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("POST /api/v1/ai/analyze: user={}, symbol={}", userId, request.getSymbol());
        
        StockAnalysisResponse response = aiAnalysisService.analyzeStock(
            request.getSymbol(), 
            request.getMarket(), 
            request.getAnalysisType()
        );
        return ApiResponse.success(response);
    }

    /**
     * Provide strategy recommendations for the user.
     *
     * @param userPrincipal authenticated user principal
     * @param request       recommendation parameters
     * @return recommendations wrapped in {@link ApiResponse}
     */
    @PostMapping("/strategy-recommend")
    public ApiResponse<StrategyRecommendResponse> recommendStrategies(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody StrategyRecommendRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("POST /api/v1/ai/strategy-recommend: user={}, risk={}", 
                 userId, request.getRiskPreference());
        
        StrategyRecommendResponse response = aiAnalysisService.recommendStrategies(userId, request);
        return ApiResponse.success(response);
    }

    /**
     * Interpret a backtest result for the user.
     *
     * @param userPrincipal authenticated user principal
     * @param request       backtest interpretation request
     * @return interpretation wrapped in {@link ApiResponse}
     */
    @PostMapping("/interpret-backtest")
    public ApiResponse<BacktestInterpretResponse> interpretBacktest(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody BacktestInterpretRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("POST /api/v1/ai/interpret-backtest: user={}, backtestId={}", 
                 userId, request.getBacktestResultId());
        
        BacktestInterpretResponse response = aiAnalysisService.interpretBacktest(
            userId, 
            request.getBacktestResultId()
        );
        return ApiResponse.success(response);
    }

    /**
     * Assess portfolio risk for the user.
     *
     * @param userPrincipal authenticated user principal
     * @param request       risk assessment request
     * @return risk report wrapped in {@link ApiResponse}
     */
    @PostMapping("/risk-assessment")
    public ApiResponse<RiskAssessmentResponse> assessRisk(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody RiskAssessmentRequest request) {
        
        Long userId = userPrincipal.getUser().getId();
        log.debug("POST /api/v1/ai/risk-assessment: user={}, portfolioId={}", 
                 userId, request.getPortfolioId());
        
        RiskAssessmentResponse response = aiAnalysisService.assessRisk(
            userId, 
            request.getPortfolioId()
        );
        return ApiResponse.success(response);
    }
}
