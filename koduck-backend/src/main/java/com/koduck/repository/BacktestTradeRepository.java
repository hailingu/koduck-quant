package com.koduck.repository;

import com.koduck.entity.BacktestTrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for backtest trade operations.
 */
@Repository
public interface BacktestTradeRepository extends JpaRepository<BacktestTrade, Long> {
    
    /**
     * Find all trades for a backtest result.
     */
    List<BacktestTrade> findByBacktestResultIdOrderByTradeTimeAsc(Long backtestResultId);
    
    /**
     * Delete all trades for a backtest result.
     */
    void deleteByBacktestResultId(Long backtestResultId);
}
