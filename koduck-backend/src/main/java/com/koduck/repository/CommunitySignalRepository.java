package com.koduck.repository;

import com.koduck.entity.CommunitySignal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Repository for CommunitySignal entity.
 *
 * @author Koduck Team
 */
@Repository
public interface CommunitySignalRepository extends JpaRepository<CommunitySignal, Long> {

    /**
     * Find signals by user ID with pagination.
     *
     * @param userId the user ID
     * @param pageable the pagination information
     * @return a page of community signals
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByUserId(Long userId, Pageable pageable);

    /**
     * Find signals by status with pagination.
     *
     * @param status the signal status
     * @param pageable the pagination information
     * @return a page of community signals
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByStatus(CommunitySignal.Status status, Pageable pageable);

    /**
     * Find featured signals by status with pagination.
     *
     * @param pageable the pagination information
     * @param status the signal status
     * @return a page of featured community signals
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByIsFeaturedTrueAndStatus(Pageable pageable,
                                                        CommunitySignal.Status status);

    /**
     * Find signals by symbol containing and status with pagination.
     *
     * @param symbol the symbol to search
     * @param status the signal status
     * @param pageable the pagination information
     * @return a page of community signals
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findBySymbolContainingAndStatus(String symbol,
                                                          CommunitySignal.Status status,
                                                          Pageable pageable);

    /**
     * Find signals by signal type and status with pagination.
     *
     * @param signalType the signal type
     * @param status the signal status
     * @param pageable the pagination information
     * @return a page of community signals
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findBySignalTypeAndStatus(CommunitySignal.SignalType signalType,
                                                    CommunitySignal.Status status,
                                                    Pageable pageable);

    /**
     * Find hot signals ordered by engagement score.
     * Engagement score = likes + subscriptions * 2 + comments * 3
     *
     * @param status the signal status
     * @param pageable the pagination information
     * @return a page of hot community signals
     */
    @EntityGraph(attributePaths = "user")
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = :status "
           + "ORDER BY (s.likeCount + s.subscribeCount * 2 + s.commentCount * 3) DESC")
    Page<CommunitySignal> findHotSignals(@Param("status") CommunitySignal.Status status,
                                         Pageable pageable);

    /**
     * Find signals by user ID ordered by creation time descending.
     *
     * @param userId the user ID
     * @return a list of community signals
     */
    @EntityGraph(attributePaths = "user")
    List<CommunitySignal> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Find signal by ID with user details preloaded to avoid N+1 query issues.
     *
     * @param id the signal ID
     * @return an optional containing the community signal
     */
    @Override
    @EntityGraph(attributePaths = "user")
    java.util.Optional<CommunitySignal> findById(Long id);

    /**
     * Find expired signals that are still active.
     *
     * @param now the current time
     * @return a list of expired community signals
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = 'ACTIVE' AND s.expiresAt < :now")
    List<CommunitySignal> findExpiredSignals(@Param("now") LocalDateTime now);

    /**
     * Update signal status by ID.
     *
     * @param id the signal ID
     * @param status the new status
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.status = :status WHERE s.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") CommunitySignal.Status status);

    /**
     * Increment view count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.viewCount = s.viewCount + 1 WHERE s.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /**
     * Increment like count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount + 1 WHERE s.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * Decrement like count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount - 1 "
           + "WHERE s.id = :id AND s.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);

    /**
     * Increment subscribe count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount + 1 WHERE s.id = :id")
    void incrementSubscribeCount(@Param("id") Long id);

    /**
     * Decrement subscribe count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount - 1 "
           + "WHERE s.id = :id AND s.subscribeCount > 0")
    void decrementSubscribeCount(@Param("id") Long id);

    /**
     * Increment favorite count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount + 1 WHERE s.id = :id")
    void incrementFavoriteCount(@Param("id") Long id);

    /**
     * Decrement favorite count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount - 1 "
           + "WHERE s.id = :id AND s.favoriteCount > 0")
    void decrementFavoriteCount(@Param("id") Long id);

    /**
     * Increment comment count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount + 1 WHERE s.id = :id")
    void incrementCommentCount(@Param("id") Long id);

    /**
     * Decrement comment count by ID.
     *
     * @param id the signal ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount - 1 "
           + "WHERE s.id = :id AND s.commentCount > 0")
    void decrementCommentCount(@Param("id") Long id);

    /**
     * Count signals by user ID.
     *
     * @param userId the user ID
     * @return the count of signals
     */
    long countByUserId(Long userId);

    /**
     * Count signals by user ID and status.
     *
     * @param userId the user ID
     * @param status the signal status
     * @return the count of signals
     */
    long countByUserIdAndStatus(Long userId, CommunitySignal.Status status);
}
