package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalFavorite;

/**
 * Repository for signal favorite operations.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalFavoriteRepository extends JpaRepository<SignalFavorite, Long> {

    /**
     * Checks if a favorite exists for the given signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     * @return true if the favorite exists, false otherwise
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Deletes a favorite by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Finds all signal IDs favorited by the given user ID.
     *
     * @param userId the user ID
     * @return a list of signal IDs
     */
    @Query("SELECT f.signalId FROM SignalFavorite f WHERE f.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
