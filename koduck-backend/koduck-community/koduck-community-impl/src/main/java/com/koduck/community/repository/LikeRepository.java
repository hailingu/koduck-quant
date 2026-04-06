package com.koduck.community.repository;

import com.koduck.community.entity.Like;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 点赞存储库。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Repository
public interface LikeRepository extends JpaRepository<Like, Long> {

    /**
     * 查询目标的点赞。
     *
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @param pageable 分页参数
     * @return 点赞分页
     */
    Page<Like> findByTargetTypeAndTargetId(String targetType, Long targetId, Pageable pageable);

    /**
     * 查询用户的点赞。
     *
     * @param userId 用户ID
     * @param pageable 分页参数
     * @return 点赞分页
     */
    Page<Like> findByUserId(Long userId, Pageable pageable);

    /**
     * 查找用户的点赞记录。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 点赞记录
     */
    Optional<Like> findByUserIdAndTargetTypeAndTargetId(Long userId, String targetType, Long targetId);

    /**
     * 检查用户是否点赞了目标。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 是否已点赞
     */
    boolean existsByUserIdAndTargetTypeAndTargetId(Long userId, String targetType, Long targetId);

    /**
     * 计算目标的点赞数量。
     *
     * @param targetType 目标类型
     * @param targetId 目标ID
     * @return 点赞数量
     */
    long countByTargetTypeAndTargetId(String targetType, Long targetId);

    /**
     * 删除用户的点赞。
     *
     * @param userId 用户ID
     * @param targetType 目标类型
     * @param targetId 目标ID
     */
    void deleteByUserIdAndTargetTypeAndTargetId(Long userId, String targetType, Long targetId);
}
