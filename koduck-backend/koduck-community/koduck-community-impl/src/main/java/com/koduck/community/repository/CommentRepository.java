package com.koduck.community.repository;

import com.koduck.community.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 评论存储库。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    /**
     * 查询信号的评论。
     *
     * @param signalId 信号ID
     * @param pageable 分页参数
     * @return 评论分页
     */
    Page<Comment> findBySignalId(Long signalId, Pageable pageable);

    /**
     * 查询评论的回复。
     *
     * @param parentId 父评论ID
     * @param pageable 分页参数
     * @return 回复分页
     */
    Page<Comment> findByParentId(Long parentId, Pageable pageable);

    /**
     * 查询用户的评论。
     *
     * @param userId 用户ID
     * @param pageable 分页参数
     * @return 评论分页
     */
    Page<Comment> findByUserId(Long userId, Pageable pageable);

    /**
     * 查询信号的顶级评论（不包含回复）。
     *
     * @param signalId 信号ID
     * @param pageable 分页参数
     * @return 评论分页
     */
    Page<Comment> findBySignalIdAndParentIdIsNull(Long signalId, Pageable pageable);

    /**
     * 计算信号的评论数量。
     *
     * @param signalId 信号ID
     * @return 评论数量
     */
    long countBySignalId(Long signalId);
}
