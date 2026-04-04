package com.koduck.repository.community;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.UserSignalStats;

/**
 * 用户信号统计操作仓库，提供用户信号统计数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface UserSignalStatsRepository extends JpaRepository<UserSignalStats, Long> {

    /**
     * 根据用户 ID 查询统计。
     *
     * @param userId 用户 ID
     * @return 用户信号统计
     */
    Optional<UserSignalStats> findByUserId(Long userId);

    /**
     * 根据用户 ID 检查统计是否存在。
     *
     * @param userId 用户 ID
     * @return 如果存在返回 true
     */
    boolean existsByUserId(Long userId);

    /**
     * 增加总信号数。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementTotalSignals(@Param("userId") Long userId);

    /**
     * 增加盈利信号数。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.winSignals = s.winSignals + 1, "
            + "s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementWinSignals(@Param("userId") Long userId);

    /**
     * 增加亏损信号数。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.lossSignals = s.lossSignals + 1, "
            + "s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementLossSignals(@Param("userId") Long userId);

    /**
     * 增加关注者数量。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount + 1 WHERE s.userId = :userId")
    void incrementFollowerCount(@Param("userId") Long userId);

    /**
     * 减少关注者数量。
     *
     * @param userId 用户 ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount - 1 "
            + "WHERE s.userId = :userId AND s.followerCount > 0")
    void decrementFollowerCount(@Param("userId") Long userId);

    /**
     * 更新平均盈利。
     *
     * @param userId 用户 ID
     * @param avgProfit 平均盈利
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.avgProfit = :avgProfit WHERE s.userId = :userId")
    void updateAvgProfit(@Param("userId") Long userId, @Param("avgProfit") BigDecimal avgProfit);

    /**
     * 更新声誉评分。
     *
     * @param userId 用户 ID
     * @param score 评分
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.reputationScore = :score WHERE s.userId = :userId")
    void updateReputationScore(@Param("userId") Long userId, @Param("score") Integer score);
}
