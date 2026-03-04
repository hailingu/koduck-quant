package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.portfolio.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.PortfolioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Portfolio (投资组合) REST API controller.
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
@Tag(name = "投资组合", description = "持仓管理、交易记录、盈亏统计等投资组合接口")
@Slf4j
public class PortfolioController {
    
    private final PortfolioService portfolioService;
    
    /**
     * Get user's portfolio positions.
     */
    @GetMapping
    public ApiResponse<List<PortfolioPositionDto>> getPositions(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio: user={}", userPrincipal.getUser().getId());
        
        List<PortfolioPositionDto> positions = portfolioService.getPositions(userPrincipal.getUser().getId());
        return ApiResponse.success(positions);
    }
    
    /**
     * Get portfolio summary.
     */
    @GetMapping("/summary")
    public ApiResponse<PortfolioSummaryDto> getPortfolioSummary(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio/summary: user={}", userPrincipal.getUser().getId());
        
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userPrincipal.getUser().getId());
        return ApiResponse.success(summary);
    }
    
    /**
     * Add a position to portfolio.
     */
    @PostMapping
    public ApiResponse<PortfolioPositionDto> addPosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddPositionRequest request) {
        
        log.debug("POST /api/v1/portfolio: user={}, market={}, symbol={}", 
                 userPrincipal.getUser().getId(), request.market(), request.symbol());
        
        PortfolioPositionDto position = portfolioService.addPosition(userPrincipal.getUser().getId(), request);
        return ApiResponse.success(position);
    }
    
    /**
     * Update a position.
     */
    @PutMapping("/{id}")
    public ApiResponse<PortfolioPositionDto> updatePosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdatePositionRequest request) {
        
        log.debug("PUT /api/v1/portfolio/{}: user={}", id, userPrincipal.getUser().getId());
        
        PortfolioPositionDto position = portfolioService.updatePosition(userPrincipal.getUser().getId(), id, request);
        return ApiResponse.success(position);
    }
    
    /**
     * Delete a position.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deletePosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("DELETE /api/v1/portfolio/{}: user={}", id, userPrincipal.getUser().getId());
        
        portfolioService.deletePosition(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }
    
    /**
     * Get trade records.
     */
    @GetMapping("/trades")
    public ApiResponse<List<TradeDto>> getTrades(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio/trades: user={}", userPrincipal.getUser().getId());
        
        List<TradeDto> trades = portfolioService.getTrades(userPrincipal.getUser().getId());
        return ApiResponse.success(trades);
    }
    
    /**
     * Add a trade record.
     */
    @PostMapping("/trades")
    public ApiResponse<TradeDto> addTrade(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddTradeRequest request) {
        
        log.debug("POST /api/v1/portfolio/trades: user={}, market={}, symbol={}, type={}", 
                 userPrincipal.getUser().getId(), request.market(), request.symbol(), request.tradeType());
        
        TradeDto trade = portfolioService.addTrade(userPrincipal.getUser().getId(), request);
        return ApiResponse.success(trade);
    }
}
