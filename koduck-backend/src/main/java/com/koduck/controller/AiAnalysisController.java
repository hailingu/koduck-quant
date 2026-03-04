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
 * AI 分析 REST API controller.
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI分析", description = "智能股票分析、策略推荐、风险评估等AI分析接口")
@Slf4j
public class AiAnalysisController {

    private final AiAnalysisService aiAnalysisService;

    /**
     * 股票智能分析
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
     * 策略智能推荐
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
     * 回测结果解读
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
     * 风险评估
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
