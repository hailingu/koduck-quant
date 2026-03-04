package com.koduck.repository;

import com.koduck.entity.UserSignalStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * 用户信号统计 Repository
 */
@Repository
public interface UserSignalStatsRepository extends JpaRepository<UserSignalStats, Long> {

    /**
     * 根据用户 ID 查询统计
     */
    Optional<UserSignalStats> findByUserId(Long userId);

    /**
     * 检查用户是否有统计记录
     */
    boolean existsByUserId(Long userId);

    /**
     * 增加信号总数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementTotalSignals(@Param("userId") Long userId);

    /**
     * 增加盈利信号数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.winSignals = s.winSignals + 1, s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementWinSignals(@Param("userId") Long userId);

    /**
     * 增加亏损信号数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.lossSignals = s.lossSignals + 1, s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementLossSignals(@Param("userId") Long userId);

    /**
     * 增加关注者数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount + 1 WHERE s.userId = :userId")
    void incrementFollowerCount(@Param("userId") Long userId);

    /**
     * 减少关注者数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount - 1 WHERE s.userId = :userId AND s.followerCount > 0")
    void decrementFollowerCount(@Param("userId") Long userId);

    /**
     * 更新平均收益
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.avgProfit = :avgProfit WHERE s.userId = :userId")
    void updateAvgProfit(@Param("userId") Long userId, @Param("avgProfit") BigDecimal avgProfit);

    /**
     * 更新声望分数
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.reputationScore = :score WHERE s.userId = :userId")
    void updateReputationScore(@Param("userId") Long userId, @Param("score") Integer score);
}
