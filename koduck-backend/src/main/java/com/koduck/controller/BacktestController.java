package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.backtest.*;
import com.koduck.security.UserPrincipal;
import com.koduck.service.BacktestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Backtest (回测) REST API controller.
 */
@RestController
@RequestMapping("/api/v1/backtest")
@RequiredArgsConstructor
@Validated
@Slf4j
public class BacktestController {
    
    private final BacktestService backtestService;
    
    /**
     * Get all backtest results for the current user.
     */
    @GetMapping
    public ApiResponse<List<BacktestResultDto>> getBacktestResults(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        
        log.debug("GET /api/v1/backtest: user={}", userPrincipal.getUser().getId());
        
        List<BacktestResultDto> results = backtestService.getBacktestResults(userPrincipal.getUser().getId());
        return ApiResponse.success(results);
    }
    
    /**
     * Get a backtest result by id.
     */
    @GetMapping("/{id}")
    public ApiResponse<BacktestResultDto> getBacktestResult(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("GET /api/v1/backtest/{}: user={}", id, userPrincipal.getUser().getId());
        
        BacktestResultDto result = backtestService.getBacktestResult(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(result);
    }
    
    /**
     * Run a new backtest.
     */
    @PostMapping("/run")
    public ApiResponse<BacktestResultDto> runBacktest(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody RunBacktestRequest request) {
        
        log.debug("POST /api/v1/backtest/run: user={}, strategyId={}, symbol={}", 
                 userPrincipal.getUser().getId(), request.strategyId(), request.symbol());
        
        BacktestResultDto result = backtestService.runBacktest(userPrincipal.getUser().getId(), request);
        return ApiResponse.success(result);
    }
    
    /**
     * Get trades for a backtest result.
     */
    @GetMapping("/{id}/trades")
    public ApiResponse<List<BacktestTradeDto>> getBacktestTrades(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("GET /api/v1/backtest/{}/trades: user={}", id, userPrincipal.getUser().getId());
        
        List<BacktestTradeDto> trades = backtestService.getBacktestTrades(userPrincipal.getUser().getId(), id);
        return ApiResponse.success(trades);
    }
    
    /**
     * Delete a backtest result.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteBacktestResult(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id) {
        
        log.debug("DELETE /api/v1/backtest/{}: user={}", id, userPrincipal.getUser().getId());
        
        backtestService.deleteBacktestResult(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }
}
