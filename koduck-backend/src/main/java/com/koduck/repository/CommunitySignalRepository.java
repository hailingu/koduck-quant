package com.koduck.repository;

import com.koduck.entity.CommunitySignal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  Repository
 */
@Repository
public interface CommunitySignalRepository extends JpaRepository<CommunitySignal, Long> {

    /**
     *  ID 
     */
    Page<CommunitySignal> findByUserId(Long userId, Pageable pageable);

    /**
     * 
     */
    Page<CommunitySignal> findByStatus(CommunitySignal.Status status, Pageable pageable);

    /**
     * 
     */
    Page<CommunitySignal> findByIsFeaturedTrueAndStatus(Pageable pageable, CommunitySignal.Status status);

    /**
     * 
     */
    Page<CommunitySignal> findBySymbolContainingAndStatus(String symbol, CommunitySignal.Status status, Pageable pageable);

    /**
     * 
     */
    Page<CommunitySignal> findBySignalTypeAndStatus(CommunitySignal.SignalType signalType, CommunitySignal.Status status, Pageable pageable);

    /**
     * （）
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = :status ORDER BY (s.likeCount + s.subscribeCount * 2 + s.commentCount * 3) DESC")
    Page<CommunitySignal> findHotSignals(@Param("status") CommunitySignal.Status status, Pageable pageable);

    /**
     * 
     */
    List<CommunitySignal> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = 'ACTIVE' AND s.expiresAt < :now")
    List<CommunitySignal> findExpiredSignals(@Param("now") LocalDateTime now);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.status = :status WHERE s.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") CommunitySignal.Status status);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.viewCount = s.viewCount + 1 WHERE s.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount + 1 WHERE s.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount - 1 WHERE s.id = :id AND s.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount + 1 WHERE s.id = :id")
    void incrementSubscribeCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount - 1 WHERE s.id = :id AND s.subscribeCount > 0")
    void decrementSubscribeCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount + 1 WHERE s.id = :id")
    void incrementFavoriteCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount - 1 WHERE s.id = :id AND s.favoriteCount > 0")
    void decrementFavoriteCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount + 1 WHERE s.id = :id")
    void incrementCommentCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount - 1 WHERE s.id = :id AND s.commentCount > 0")
    void decrementCommentCount(@Param("id") Long id);

    /**
     * 
     */
    long countByUserId(Long userId);

    /**
     * 
     */
    long countByUserIdAndStatus(Long userId, CommunitySignal.Status status);
}
