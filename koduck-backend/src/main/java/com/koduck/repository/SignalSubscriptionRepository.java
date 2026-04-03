package com.koduck.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.SignalSubscription;

/**
 * Signal subscription repository.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalSubscriptionRepository extends JpaRepository<SignalSubscription, Long> {

    /**
     * Checks if subscription exists by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     * @return true if exists, false otherwise
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Finds subscriptions by user ID.
     *
     * @param userId the user ID
     * @return the list of subscriptions
     */
    List<SignalSubscription> findByUserId(Long userId);

    /**
     * Deletes subscription by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Finds signal IDs by user ID.
     *
     * @param userId the user ID
     * @return the list of signal IDs
     */
    @Query("SELECT s.signalId FROM SignalSubscription s WHERE s.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
