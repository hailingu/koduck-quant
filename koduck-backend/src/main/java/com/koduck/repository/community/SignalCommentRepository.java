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
 * Repository for signal comments.
 *
 * @author Koduck Team
 */
@Repository
public interface SignalCommentRepository extends JpaRepository<SignalComment, Long> {

    /**
     * Find top-level comments by signal ID (paginated).
     *
     * @param signalId the signal ID
     * @param pageable the pagination information
     * @return the page of comments
     */
    Page<SignalComment> findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(
            Long signalId, Pageable pageable);

    /**
     * Find all comments by signal ID (including replies).
     *
     * @param signalId the signal ID
     * @return the list of comments
     */
    List<SignalComment> findBySignalIdAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId);

    /**
     * Find replies by parent comment ID.
     *
     * @param parentId the parent comment ID
     * @return the list of replies
     */
    List<SignalComment> findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(Long parentId);

    /**
     * Find comments by user ID.
     *
     * @param userId the user ID
     * @return the list of comments
     */
    List<SignalComment> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Count comments by signal ID.
     *
     * @param signalId the signal ID
     * @return the count of comments
     */
    long countBySignalIdAndIsDeletedFalse(Long signalId);

    /**
     * Count comments by user ID.
     *
     * @param userId the user ID
     * @return the count of comments
     */
    long countByUserId(Long userId);

    /**
     * Soft delete a comment.
     *
     * @param id the comment ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.isDeleted = true, c.content = '[已删除]' "
            + "WHERE c.id = :id")
    void softDelete(@Param("id") Long id);

    /**
     * Increment like count.
     *
     * @param id the comment ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount + 1 WHERE c.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * Decrement like count.
     *
     * @param id the comment ID
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount - 1 "
            + "WHERE c.id = :id AND c.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);
}
