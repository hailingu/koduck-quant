package com.koduck.repository.community;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.UserSignalStats;

/**
 * Repository for user signal stats operations.
 *
 * @author Koduck Team
 */
@Repository
public interface UserSignalStatsRepository extends JpaRepository<UserSignalStats, Long> {

    /**
     * Find stats by user ID.
     *
     * @param userId the user ID
     * @return the user signal stats
     */
    Optional<UserSignalStats> findByUserId(Long userId);

    /**
     * Check if stats exists by user ID.
     *
     * @param userId the user ID
     * @return true if exists
     */
    boolean existsByUserId(Long userId);

    /**
     * Increment total signals.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementTotalSignals(@Param("userId") Long userId);

    /**
     * Increment win signals.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.winSignals = s.winSignals + 1, "
            + "s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementWinSignals(@Param("userId") Long userId);

    /**
     * Increment loss signals.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.lossSignals = s.lossSignals + 1, "
            + "s.totalSignals = s.totalSignals + 1 WHERE s.userId = :userId")
    void incrementLossSignals(@Param("userId") Long userId);

    /**
     * Increment follower count.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount + 1 WHERE s.userId = :userId")
    void incrementFollowerCount(@Param("userId") Long userId);

    /**
     * Decrement follower count.
     *
     * @param userId the user ID
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.followerCount = s.followerCount - 1 "
            + "WHERE s.userId = :userId AND s.followerCount > 0")
    void decrementFollowerCount(@Param("userId") Long userId);

    /**
     * Update average profit.
     *
     * @param userId the user ID
     * @param avgProfit the average profit
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.avgProfit = :avgProfit WHERE s.userId = :userId")
    void updateAvgProfit(@Param("userId") Long userId, @Param("avgProfit") BigDecimal avgProfit);

    /**
     * Update reputation score.
     *
     * @param userId the user ID
     * @param score the score
     */
    @Modifying
    @Query("UPDATE UserSignalStats s SET s.reputationScore = :score WHERE s.userId = :userId")
    void updateReputationScore(@Param("userId") Long userId, @Param("score") Integer score);
}
