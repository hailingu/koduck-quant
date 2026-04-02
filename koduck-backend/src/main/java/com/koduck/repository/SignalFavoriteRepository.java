package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.SignalFavorite;

/**
 * Repository for signal favorite operations.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalFavoriteRepository extends JpaRepository<SignalFavorite, Long> {

    /**
     * Finds a signal favorite by signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     * @return an optional containing the favorite if found
     */
    Optional<SignalFavorite> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Checks if a favorite exists for the given signal ID and user ID.
     *
     * @param signalId the signal ID
     * @param userId the user ID
     * @return true if the favorite exists, false otherwise
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * Finds favorites by user ID with pagination.
     *
     * @param userId the user ID
     * @param pageable the pagination information
     * @return a page of signal favorites
     */
    Page<SignalFavorite> findByUserId(Long userId, Pageable pageable);

    /**
     * Finds all favorites by user ID.
     *
     * @param userId the user ID
     * @return a list of signal favorites
     */
    List<SignalFavorite> findByUserId(Long userId);

    /**
     * Finds all favorites by signal ID.
     *
     * @param signalId the signal ID
     * @return a list of signal favorites
     */
    List<SignalFavorite> findBySignalId(Long signalId);

    /**
     * Counts the number of favorites for a given signal ID.
     *
     * @param signalId the signal ID
     * @return the count of favorites
     */
    long countBySignalId(Long signalId);

    /**
     * Counts the number of favorites for a given user ID.
     *
     * @param userId the user ID
     * @return the count of favorites
     */
    long countByUserId(Long userId);

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
