package com.koduck.strategy.repository.backtest;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.strategy.entity.backtest.BacktestResult;

/**
 * 回测结果操作仓库，提供回测结果数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface BacktestResultRepository extends JpaRepository<BacktestResult, Long> {

    /**
     * 查询用户的所有回测结果。
     *
     * @param userId 用户 ID
     * @return 回测结果列表
     */
    List<BacktestResult> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 根据用户和策略查询回测结果。
     *
     * @param userId 用户 ID
     * @param strategyId 策略 ID
     * @return 回测结果列表
     */
    List<BacktestResult> findByUserIdAndStrategyIdOrderByCreatedAtDesc(Long userId, Long strategyId);

    /**
     * 根据 ID 和用户查询回测结果。
     *
     * @param id 回测结果 ID
     * @param userId 用户 ID
     * @return 回测结果
     */
    Optional<BacktestResult> findByIdAndUserId(Long id, Long userId);

    /**
     * 更新状态。
     *
     * @param id 回测结果 ID
     * @param status 回测状态
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status WHERE br.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") BacktestResult.BacktestStatus status);

    /**
     * 更新状态和错误信息。
     *
     * @param id 回测结果 ID
     * @param status 回测状态
     * @param errorMessage 错误信息
     */
    @Modifying
    @Query("UPDATE BacktestResult br SET br.status = :status, "
            + "br.errorMessage = :errorMessage WHERE br.id = :id")
    void updateStatusAndError(@Param("id") Long id,
                              @Param("status") BacktestResult.BacktestStatus status,
                              @Param("errorMessage") String errorMessage);
}
