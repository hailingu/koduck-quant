package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.SignalLike;

/**
 * Repository for signal like operations.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalLikeRepository extends JpaRepository<SignalLike, Long> {

    /**
     * Find like by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId   the user ID
     * @return optional of signal like
     */
    Optional<SignalLike> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Check if like exists by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId   the user ID
     * @return true if exists
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Find likes by user ID.
     *
     * @param userId the user ID
     * @return list of signal likes
     */
    List<SignalLike> findByUserId(Long userId);

    /**
     * Find likes by signal ID.
     *
     * @param signalId the signal ID
     * @return list of signal likes
     */
    List<SignalLike> findBySignalId(Long signalId);

    /**
     * Count likes by signal ID.
     *
     * @param signalId the signal ID
     * @return the count
     */
    long countBySignalId(Long signalId);

    /**
     * Count likes by user ID.
     *
     * @param userId the user ID
     * @return the count
     */
    long countByUserId(Long userId);

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
