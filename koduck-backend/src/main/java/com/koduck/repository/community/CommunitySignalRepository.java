package com.koduck.repository.community;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.CommunitySignal;

/**
 * 社区信号仓库，提供社区信号数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface CommunitySignalRepository extends JpaRepository<CommunitySignal, Long> {

    /**
     * 根据用户 ID 分页查询信号。
     *
     * @param userId 用户 ID
     * @param pageable 分页信息
     * @return 社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByUserId(Long userId, Pageable pageable);

    /**
     * 根据状态分页查询信号。
     *
     * @param status 信号状态
     * @param pageable 分页信息
     * @return 社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByStatus(CommunitySignal.Status status, Pageable pageable);

    /**
     * 根据状态分页查询精选信号。
     *
     * @param pageable 分页信息
     * @param status 信号状态
     * @return 精选社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findByIsFeaturedTrueAndStatus(Pageable pageable,
                                                        CommunitySignal.Status status);

    /**
     * 根据股票代码模糊搜索和状态分页查询信号。
     *
     * @param symbol 股票代码
     * @param status 信号状态
     * @param pageable 分页信息
     * @return 社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findBySymbolContainingAndStatus(String symbol,
                                                          CommunitySignal.Status status,
                                                          Pageable pageable);

    /**
     * 根据信号类型和状态分页查询信号。
     *
     * @param signalType 信号类型
     * @param status 信号状态
     * @param pageable 分页信息
     * @return 社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    Page<CommunitySignal> findBySignalTypeAndStatus(CommunitySignal.SignalType signalType,
                                                    CommunitySignal.Status status,
                                                    Pageable pageable);

    /**
     * 按热度排序查询信号。
     * 热度评分 = 点赞数 + 订阅数 * 2 + 评论数 * 3
     *
     * @param status 信号状态
     * @param pageable 分页信息
     * @return 热门社区信号分页结果
     */
    @EntityGraph(attributePaths = "user")
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = :status "
           + "ORDER BY (s.likeCount + s.subscribeCount * 2 + s.commentCount * 3) DESC")
    Page<CommunitySignal> findHotSignals(@Param("status") CommunitySignal.Status status,
                                         Pageable pageable);

    /**
     * 根据用户 ID 按创建时间降序查询信号。
     *
     * @param userId 用户 ID
     * @return 社区信号列表
     */
    @EntityGraph(attributePaths = "user")
    List<CommunitySignal> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 根据 ID 查询信号并预加载用户详情，避免 N+1 查询问题。
     *
     * @param id 信号 ID
     * @return 社区信号
     */
    @Override
    @EntityGraph(attributePaths = "user")
    @NonNull
    Optional<CommunitySignal> findById(@NonNull Long id);

    /**
     * 查询过期但仍处于活跃状态的信号。
     *
     * @param now 当前时间
     * @return 过期社区信号列表
     */
    @Query("SELECT s FROM CommunitySignal s WHERE s.status = 'ACTIVE' AND s.expiresAt < :now")
    List<CommunitySignal> findExpiredSignals(@Param("now") LocalDateTime now);

    /**
     * 根据 ID 更新信号状态。
     *
     * @param id 信号 ID
     * @param status 新状态
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.status = :status WHERE s.id = :id")
    void updateStatus(@Param("id") Long id, @Param("status") CommunitySignal.Status status);

    /**
     * 根据 ID 增加浏览次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.viewCount = s.viewCount + 1 WHERE s.id = :id")
    void incrementViewCount(@Param("id") Long id);

    /**
     * 根据 ID 增加点赞次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount + 1 WHERE s.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 根据 ID 减少点赞次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.likeCount = s.likeCount - 1 "
           + "WHERE s.id = :id AND s.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);

    /**
     * 根据 ID 增加订阅次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount + 1 WHERE s.id = :id")
    void incrementSubscribeCount(@Param("id") Long id);

    /**
     * 根据 ID 减少订阅次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.subscribeCount = s.subscribeCount - 1 "
           + "WHERE s.id = :id AND s.subscribeCount > 0")
    void decrementSubscribeCount(@Param("id") Long id);

    /**
     * 根据 ID 增加收藏次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount + 1 WHERE s.id = :id")
    void incrementFavoriteCount(@Param("id") Long id);

    /**
     * 根据 ID 减少收藏次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.favoriteCount = s.favoriteCount - 1 "
           + "WHERE s.id = :id AND s.favoriteCount > 0")
    void decrementFavoriteCount(@Param("id") Long id);

    /**
     * 根据 ID 增加评论次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount + 1 WHERE s.id = :id")
    void incrementCommentCount(@Param("id") Long id);

    /**
     * 根据 ID 减少评论次数。
     *
     * @param id 信号 ID
     */
    @Modifying
    @Query("UPDATE CommunitySignal s SET s.commentCount = s.commentCount - 1 "
           + "WHERE s.id = :id AND s.commentCount > 0")
    void decrementCommentCount(@Param("id") Long id);

    /**
     * 根据用户 ID 统计信号数量。
     *
     * @param userId 用户 ID
     * @return 信号数量
     */
    long countByUserId(Long userId);

    /**
     * 根据用户 ID 和状态统计信号数量。
     *
     * @param userId 用户 ID
     * @param status 信号状态
     * @return 信号数量
     */
    long countByUserIdAndStatus(Long userId, CommunitySignal.Status status);
}
