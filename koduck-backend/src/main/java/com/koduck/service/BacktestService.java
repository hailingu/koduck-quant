package com.koduck.service;

import java.util.List;

import com.koduck.dto.backtest.BacktestResultDto;
import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.dto.backtest.RunBacktestRequest;

/**
 * Service interface for backtest operations.
 *
 * @author Koduck Team
 */
public interface BacktestService {

    /**
     * Gets all backtest results for a user.
     *
     * @param userId the user ID
     * @return a list of backtest results
     */
    List<BacktestResultDto> getBacktestResults(Long userId);

    /**
     * Gets a backtest result by id.
     *
     * @param userId the user ID
     * @param id the backtest result ID
     * @return the backtest result
     */
    BacktestResultDto getBacktestResult(Long userId, Long id);

    /**
     * Runs a backtest.
     *
     * @param userId the user ID
     * @param request the backtest request
     * @return the backtest result
     */
    BacktestResultDto runBacktest(Long userId, RunBacktestRequest request);

    /**
     * Gets trades for a backtest result.
     *
     * @param userId the user ID
     * @param backtestId the backtest ID
     * @return a list of backtest trades
     */
    List<BacktestTradeDto> getBacktestTrades(Long userId, Long backtestId);

    /**
     * Deletes a backtest result.
     *
     * @param userId the user ID
     * @param id the backtest result ID
     */
    void deleteBacktestResult(Long userId, Long id);
}
