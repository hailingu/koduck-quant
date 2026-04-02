package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.BacktestResult;

/**
 * Repository for backtest result operations.
 *
 * @author Koduck Team
 */
@Repository
public interface BacktestResultRepository extends JpaRepository<BacktestResult, Long> {

    /**
     * Find all backtest results for a user.
     *
     * @param userId the user ID
     * @return list of backtest results
     */
    List<BacktestResult> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Find backtest results by user and strategy.
     *
     * @param userId the user ID
     * @param strategyId the strategy ID
     * @return list of backtest results
     */
    List<BacktestResult> findByUserIdAndStrategyIdOrderByCreatedAtDesc(Long userId, Long strategyId);

    /**
     * Find a backtest result by id and user.
     *
     * @param id the backtest result ID
     * @param userId the user ID
     * @return the backtest result
     */
    Optional<BacktestResult> findByIdAndUserId(Long id, Long userId);

    /**
     * Update status.
     *
     * @param id the backtest result ID
     * @param status the backtest status
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status WHERE br.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") BacktestResult.BacktestStatus status);

    /**
     * Update status and error message.
     *
     * @param id the backtest result ID
     * @param status the backtest status
     * @param errorMessage the error message
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status, "
            + "br.errorMessage = :errorMessage WHERE br.id = :id")
    void updateStatusAndError(@Param("id") Long id,
                              @Param("status") BacktestResult.BacktestStatus status,
                              @Param("errorMessage") String errorMessage);
}
