package com.koduck.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.BacktestTrade;

/**
 * Repository for backtest trade operations.
 *
 * @author Koduck Team
 */
@Repository
public interface BacktestTradeRepository extends JpaRepository<BacktestTrade, Long> {

    /**
     * Find all trades for a backtest result.
     *
     * @param backtestResultId the backtest result ID
     * @return list of backtest trades
     */
    List<BacktestTrade> findByBacktestResultIdOrderByTradeTimeAsc(Long backtestResultId);

    /**
     * Delete all trades for a backtest result.
     *
     * @param backtestResultId the backtest result ID
     */
    void deleteByBacktestResultId(Long backtestResultId);
}
