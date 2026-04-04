package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalLike;

/**
 * Repository for signal like operations.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalLikeRepository extends JpaRepository<SignalLike, Long> {

    /**
     * Check if like exists by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId   the user ID
     * @return true if exists
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Delete like by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId   the user ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Find signal IDs liked by user.
     *
     * @param userId the user ID
     * @return list of signal IDs
     */
    @Query("SELECT l.signalId FROM SignalLike l WHERE l.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
