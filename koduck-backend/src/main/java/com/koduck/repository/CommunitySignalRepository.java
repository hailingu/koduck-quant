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
 * 社区信号 Repository
 */
@Repository
public interface CommunitySignalRepository extends JpaRepository<CommunitySignal, Long> {

    /**
     * 根据用户 ID 查询信号
     */
    Page<CommunitySignal> findByUserId(Long userId, Pageable pageable);

    /**
     * 查询活跃信号
     */
    Page<CommunitySignal> findByStatus(CommunitySignal.Status status, Pageable pageable);

    /**
     * 查询推荐信号
     */
    Page<CommunitySignal> findByIsFeaturedTrueAndStatus(Pageable pageable, CommunitySignal.Status status);

    /**
     * 根据股票代码查询
     */
    Page<CommunitySignal> findBySymbolContainingAndStatus(String symbol, CommunitySignal.Status status, Pageable pageable);

    /**
     * 根据信号类型查询
     */
    Page<CommunitySignal> findBySignalTypeAndStatus(CommunitySignal.SignalType signalType, CommunitySignal.Status status, Pageable pageable);

    /**
     * 热门信号排序（按点赞、订阅、评论数）
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = :status ORDER BY (s.likeCount + s.subscribeCount * 2 + s.commentCount * 3) DESC")
    Page<CommunitySignal> findHotSignals(@Param("status") CommunitySignal.Status status, Pageable pageable);

    /**
     * 获取用户的信号列表
     */
    List<CommunitySignal> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 获取过期信号
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = 'ACTIVE' AND s.expiresAt < :now")
    List<CommunitySignal> findExpiredSignals(@Param("now") LocalDateTime now);

    /**
     * 更新信号状态
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.status = :status WHERE s.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") CommunitySignal.Status status);

    /**
     * 增加浏览数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.viewCount = s.viewCount + 1 WHERE s.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /**
     * 增加点赞数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount + 1 WHERE s.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 减少点赞数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount - 1 WHERE s.id = :id AND s.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);

    /**
     * 增加订阅数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount + 1 WHERE s.id = :id")
    void incrementSubscribeCount(@Param("id") Long id);

    /**
     * 减少订阅数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount - 1 WHERE s.id = :id AND s.subscribeCount > 0")
    void decrementSubscribeCount(@Param("id") Long id);

    /**
     * 增加收藏数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount + 1 WHERE s.id = :id")
    void incrementFavoriteCount(@Param("id") Long id);

    /**
     * 减少收藏数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount - 1 WHERE s.id = :id AND s.favoriteCount > 0")
    void decrementFavoriteCount(@Param("id") Long id);

    /**
     * 增加评论数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount + 1 WHERE s.id = :id")
    void incrementCommentCount(@Param("id") Long id);

    /**
     * 减少评论数
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount - 1 WHERE s.id = :id AND s.commentCount > 0")
    void decrementCommentCount(@Param("id") Long id);

    /**
     * 统计用户信号数量
     */
    long countByUserId(Long userId);

    /**
     * 统计用户活跃信号数量
     */
    long countByUserIdAndStatus(Long userId, CommunitySignal.Status status);
}
