package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalComment;

/**
 * 信号评论仓库，提供信号评论数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface SignalCommentRepository extends JpaRepository<SignalComment, Long> {

    /**
     * 根据信号 ID 查询顶级评论（分页）。
     *
     * @param signalId 信号 ID
     * @param pageable 分页信息
     * @return 评论分页结果
     */
    Page<SignalComment> findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(
            Long signalId, Pageable pageable);

    /**
     * 根据信号 ID 查询所有评论（包括回复）。
     *
     * @param signalId 信号 ID
     * @return 评论列表
     */
    List<SignalComment> findBySignalIdAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId);

    /**
     * 根据父评论 ID 查询回复。
     *
     * @param parentId 父评论 ID
     * @return 回复列表
     */
    List<SignalComment> findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(Long parentId);

    /**
     * 根据用户 ID 查询评论。
     *
     * @param userId 用户 ID
     * @return 评论列表
     */
    List<SignalComment> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 根据信号 ID 统计评论数量。
     *
     * @param signalId 信号 ID
     * @return 评论数量
     */
    long countBySignalIdAndIsDeletedFalse(Long signalId);

    /**
     * 根据用户 ID 统计评论数量。
     *
     * @param userId 用户 ID
     * @return 评论数量
     */
    long countByUserId(Long userId);

    /**
     * 软删除评论。
     *
     * @param id 评论 ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.isDeleted = true, c.content = '[已删除]' "
            + "WHERE c.id = :id")
    void softDelete(@Param("id") Long id);

    /**
     * 增加点赞次数。
     *
     * @param id 评论 ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount + 1 WHERE c.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 减少点赞次数。
     *
     * @param id 评论 ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount - 1 "
            + "WHERE c.id = :id AND c.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);
}
