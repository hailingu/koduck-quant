package com.koduck.repository;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.SignalComment;

/**
 *  Repository
 */
@Repository
public interface SignalCommentRepository extends JpaRepository<SignalComment, Long> {

    /**
     *  ID （）
     */
    Page<SignalComment> findBySignalIdAndParentIdIsNullAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId, Pageable pageable);

    /**
     *  ID （）
     */
    List<SignalComment> findBySignalIdAndIsDeletedFalseOrderByCreatedAtDesc(Long signalId);

    /**
     * （）
     */
    List<SignalComment> findByParentIdAndIsDeletedFalseOrderByCreatedAtAsc(Long parentId);

    /**
     *  ID 
     */
    List<SignalComment> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * 
     */
    long countBySignalIdAndIsDeletedFalse(Long signalId);

    /**
     * 
     */
    long countByUserId(Long userId);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.isDeleted = true, c.content = '[已删除]' WHERE c.id = :id")
    void softDelete(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount + 1 WHERE c.id = :id")
    void incrementLikeCount(@Param("id") Long id);

    /**
     * 
     */
    @Modifying
    @Query("UPDATE SignalComment c SET c.likeCount = c.likeCount - 1 WHERE c.id = :id AND c.likeCount > 0")
    void decrementLikeCount(@Param("id") Long id);
}
