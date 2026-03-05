package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.portfolio.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.PortfolioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API controller for user portfolios.
 * <p>Provides endpoints to manage positions, trades and summary statistics.</p>
 */
@RestController
@RequestMapping("/api/v1/portfolio")
@RequiredArgsConstructor
@Tag(name = "投资组合", description = "持仓管理、交易记录、盈亏统计等投资组合接口")
@Validated
@Slf4j
public class PortfolioController {
    
    private final PortfolioService portfolioService;
    
    /**
     * Retrieve all portfolio positions belonging to the authenticated user.
     *
     * @param userPrincipal authenticated user principal injected by Spring Security
     * @return list of {@link PortfolioPositionDto} objects representing current holdings
     */
    @GetMapping
    public ApiResponse<List<PortfolioPositionDto>> getPositions(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio: user={}", userPrincipal.getUser().getId());
        
        List<PortfolioPositionDto> positions = portfolioService.getPositions(userPrincipal.getUser().getId());
        return ApiResponse.success(positions);
    }
    
    /**
     * Retrieve a summary of the authenticated user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @return {@link PortfolioSummaryDto} containing aggregated costs, market values and PnL
     */
    @GetMapping("/summary")
    public ApiResponse<PortfolioSummaryDto> getPortfolioSummary(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio/summary: user={}", userPrincipal.getUser().getId());
        
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userPrincipal.getUser().getId());
        return ApiResponse.success(summary);
    }
    
    /**
     * Create a new position or update an existing one in the user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @param request payload describing the position to add ({@link AddPositionRequest})
     * @return the created or updated {@link PortfolioPositionDto}
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
     * Modify an existing portfolio position.
     *
     * @param userPrincipal authenticated user principal
     * @param id identifier of the position to update
     * @param request fields to change ({@link UpdatePositionRequest})
     * @return updated {@link PortfolioPositionDto}
     */
    @PutMapping("/{id}")
    public ApiResponse<PortfolioPositionDto> updatePosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Position ID must be positive") Long id,
            @Valid @RequestBody UpdatePositionRequest request) {
        
        log.debug("PUT /api/v1/portfolio/{}: user={}", id, userPrincipal.getUser().getId());
        
        PortfolioPositionDto position = portfolioService.updatePosition(userPrincipal.getUser().getId(), id, request);
        return ApiResponse.success(position);
    }
    
    /**
     * Remove a position from the user's portfolio.
     *
     * @param userPrincipal authenticated user principal
     * @param id identifier of the position to delete
     * @return empty success response
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deletePosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive(message = "Position ID must be positive") Long id) {
        
        log.debug("DELETE /api/v1/portfolio/{}: user={}", id, userPrincipal.getUser().getId());
        
        portfolioService.deletePosition(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }
    
    /**
     * List trade records associated with the authenticated user.
     *
     * @param userPrincipal authenticated user principal
     * @return list of {@link TradeDto} entries sorted by trade time descending
     */
    @GetMapping("/trades")
    public ApiResponse<List<TradeDto>> getTrades(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/portfolio/trades: user={}", userPrincipal.getUser().getId());
        
        List<TradeDto> trades = portfolioService.getTrades(userPrincipal.getUser().getId());
        return ApiResponse.success(trades);
    }
    
    /**
     * Create a new trade record and update the corresponding position.
     *
     * @param userPrincipal authenticated user principal
     * @param request trade details ({@link AddTradeRequest})
     * @return the created {@link TradeDto}
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
