package com.koduck.repository;

import com.koduck.entity.SignalLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 信号点赞 Repository
 */
@Repository
public interface SignalLikeRepository extends JpaRepository<SignalLike, Long> {

    /**
     * 根据信号 ID 和用户 ID 查询点赞
     */
    Optional<SignalLike> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 检查用户是否已点赞信号
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询点赞列表
     */
    List<SignalLike> findByUserId(Long userId);

    /**
     * 根据信号 ID 查询点赞列表
     */
    List<SignalLike> findBySignalId(Long signalId);

    /**
     * 统计信号的点赞数量
     */
    long countBySignalId(Long signalId);

    /**
     * 统计用户的点赞数量
     */
    long countByUserId(Long userId);

    /**
     * 删除点赞
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 获取用户点赞的信号 ID 列表
     */
    @Query("SELECT l.signalId FROM SignalLike l WHERE l.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
