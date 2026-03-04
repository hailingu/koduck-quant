package com.koduck.repository;

import com.koduck.entity.BacktestResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for backtest result operations.
 */
@Repository
public interface BacktestResultRepository extends JpaRepository<BacktestResult, Long> {
    
    /**
     * Find all backtest results for a user.
     */
    List<BacktestResult> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    /**
     * Find backtest results by user and strategy.
     */
    List<BacktestResult> findByUserIdAndStrategyIdOrderByCreatedAtDesc(Long userId, Long strategyId);
    
    /**
     * Find a backtest result by id and user.
     */
    Optional<BacktestResult> findByIdAndUserId(Long id, Long userId);
    
    /**
     * Update status.
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status WHERE br.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") BacktestResult.BacktestStatus status);
    
    /**
     * Update status and error message.
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status, br.errorMessage = :errorMessage WHERE br.id = :id")
    void updateStatusAndError(@Param("id") Long id, 
                              @Param("status") BacktestResult.BacktestStatus status, 
                              @Param("errorMessage") String errorMessage);
}
