package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalFavorite;

/**
 * 信号收藏操作仓库，提供信号收藏数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface SignalFavoriteRepository extends JpaRepository<SignalFavorite, Long> {

    /**
     * 检查指定信号 ID 和用户 ID 的收藏是否存在。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     * @return 如果收藏存在返回 true，否则返回 false
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据信号 ID 和用户 ID 删除收藏。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询所有收藏的信号 ID。
     *
     * @param userId 用户 ID
     * @return 信号 ID 列表
     */
    @Query("SELECT f.signalId FROM SignalFavorite f WHERE f.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
