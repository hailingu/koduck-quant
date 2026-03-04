package com.koduck.repository;

import com.koduck.entity.SignalFavorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 信号收藏 Repository
 */
@Repository
public interface SignalFavoriteRepository extends JpaRepository<SignalFavorite, Long> {

    /**
     * 根据信号 ID 和用户 ID 查询收藏
     */
    Optional<SignalFavorite> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 检查用户是否已收藏信号
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询收藏列表（分页）
     */
    Page<SignalFavorite> findByUserId(Long userId, Pageable pageable);

    /**
     * 根据用户 ID 查询收藏列表
     */
    List<SignalFavorite> findByUserId(Long userId);

    /**
     * 根据信号 ID 查询收藏列表
     */
    List<SignalFavorite> findBySignalId(Long signalId);

    /**
     * 统计信号的收藏数量
     */
    long countBySignalId(Long signalId);

    /**
     * 统计用户的收藏数量
     */
    long countByUserId(Long userId);

    /**
     * 删除收藏
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 获取用户收藏的信号 ID 列表
     */
    @Query("SELECT f.signalId FROM SignalFavorite f WHERE f.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
