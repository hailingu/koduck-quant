package com.koduck.service;

import com.koduck.dto.backtest.BacktestResultDto;
import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.dto.backtest.RunBacktestRequest;

import java.util.List;

/**
 * Service interface for backtest operations.
 */
public interface BacktestService {
    
    /**
     * Get all backtest results for a user.
     */
    List<BacktestResultDto> getBacktestResults(Long userId);
    
    /**
     * Get a backtest result by id.
     */
    BacktestResultDto getBacktestResult(Long userId, Long id);
    
    /**
     * Run a backtest.
     */
    BacktestResultDto runBacktest(Long userId, RunBacktestRequest request);
    
    /**
     * Get trades for a backtest result.
     */
    List<BacktestTradeDto> getBacktestTrades(Long userId, Long backtestId);
    
    /**
     * Delete a backtest result.
     */
    void deleteBacktestResult(Long userId, Long id);
}
