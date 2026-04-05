package com.koduck.community.repository;

import com.koduck.community.entity.Signal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 信号存储库。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Repository
public interface SignalRepository extends JpaRepository<Signal, Long> {

    /**
     * 查询用户的信号。
     *
     * @param userId 用户ID
     * @param pageable 分页参数
     * @return 信号分页
     */
    Page<Signal> findByUserId(Long userId, Pageable pageable);

    /**
     * 查询投资组合的信号。
     *
     * @param portfolioId 投资组合ID
     * @param pageable 分页参数
     * @return 信号分页
     */
    Page<Signal> findByPortfolioId(Long portfolioId, Pageable pageable);

    /**
     * 查询活跃信号。
     *
     * @param status 状态
     * @param pageable 分页参数
     * @return 信号分页
     */
    Page<Signal> findByStatus(Signal.Status status, Pageable pageable);

    /**
     * 搜索信号。
     *
     * @param keyword 关键词
     * @param pageable 分页参数
     * @return 信号分页
     */
    @Query("SELECT s FROM Signal s WHERE s.title LIKE %:keyword% OR s.content LIKE %:keyword% OR s.symbol LIKE %:keyword%")
    Page<Signal> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);

    /**
     * 查询热门信号（按点赞数排序）。
     *
     * @param limit 数量限制
     * @return 信号列表
     */
    @Query("SELECT s FROM Signal s WHERE s.status = 'ACTIVE' ORDER BY s.likeCount DESC, s.viewCount DESC")
    List<Signal> findHotSignals(Pageable pageable);

    /**
     * 计算用户的信号数量。
     *
     * @param userId 用户ID
     * @return 信号数量
     */
    long countByUserId(Long userId);

    /**
     * 检查信号是否属于用户。
     *
     * @param signalId 信号ID
     * @param userId 用户ID
     * @return 是否属于
     */
    boolean existsByIdAndUserId(Long signalId, Long userId);
}
