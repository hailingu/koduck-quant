package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalLike;

/**
 * 信号点赞操作仓库，提供信号点赞数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface SignalLikeRepository extends JpaRepository<SignalLike, Long> {

    /**
     * 根据信号 ID 和用户 ID 检查点赞是否存在。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     * @return 如果存在返回 true
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据信号 ID 和用户 ID 删除点赞。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 查询用户点赞的信号 ID 列表。
     *
     * @param userId 用户 ID
     * @return 信号 ID 列表
     */
    @Query("SELECT l.signalId FROM SignalLike l WHERE l.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
