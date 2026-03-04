package com.koduck.repository;

import com.koduck.entity.SignalComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 信号评论 Repository
 */
@Repository
public interface SignalCommentRepository extends JpaRepository<SignalComment, Long> {

    /**
     * 根据信号 ID 查询评论（分页）
     */
    Page<SignalComment> findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId, Pageable pageable);

    /**
     * 根据信号 ID 查询评论（不分页）
     */
    List<SignalComment> findBySignalIdAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId);

    /**
     * 查询子评论（回复）
     */
    List<SignalComment> findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(Long parentId);

    /**
     * 根据用户 ID 查询评论
     */
    List<SignalComment> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 统计信号的评论数量
     */
    long countBySignalIdAndIsDeletedFalse(Long signalId);

    /**
     * 统计用户的评论数量
     */
    long countByUserId(Long userId);

    /**
     * 软删除评论
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.isDeleted = true, c.content = '[已删除]' WHERE c.id = :id")
    void softDelete(@Param("id") Long id);

    /**
     * 增加点赞数
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount + 1 WHERE c.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 减少点赞数
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount - 1 WHERE c.id = :id AND c.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);
}
