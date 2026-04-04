package com.koduck.repository.watchlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.portfolio.WatchlistItem;

/**
 * 自选股操作仓库，提供自选股数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface WatchlistRepository extends JpaRepository<WatchlistItem, Long> {

    /**
     * 查询用户的所有自选股，按排序顺序排列。
     *
     * @param userId 用户 ID
     * @return 自选股列表
     */
    List<WatchlistItem> findByUserIdOrderBySortOrderAsc(Long userId);

    /**
     * 根据用户和股票代码查询特定自选股。
     *
     * @param userId 用户 ID
     * @param market 市场代码
     * @param symbol 股票代码
     * @return 自选股
     */
    Optional<WatchlistItem> findByUserIdAndMarketAndSymbol(
            Long userId, String market, String symbol);

    /**
     * 检查用户的自选股中是否包含指定股票。
     *
     * @param userId 用户 ID
     * @param market 市场代码
     * @param symbol 股票代码
     * @return 如果存在返回 true
     */
    boolean existsByUserIdAndMarketAndSymbol(
            Long userId, String market, String symbol);

    /**
     * 统计用户的自选股数量。
     *
     * @param userId 用户 ID
     * @return 数量
     */
    long countByUserId(Long userId);

    /**
     * 根据用户和股票代码删除自选股。
     *
     * @param userId 用户 ID
     * @param id 项目 ID
     */
    @Modifying
    @Query("DELETE FROM WatchlistItem w WHERE w.userId = :userId AND w.id = :id")
    void deleteByUserIdAndId(
            @Param("userId") Long userId, @Param("id") Long id);

    /**
     * 查询用户的最大排序顺序（用于添加新项目）。
     *
     * @param userId 用户 ID
     * @return 最大排序顺序
     */
    @Query("SELECT MAX(w.sortOrder) FROM WatchlistItem w WHERE w.userId = :userId")
    Optional<Integer> findMaxSortOrderByUserId(@Param("userId") Long userId);

    /**
     * 批量更新排序顺序。
     *
     * @param id 项目 ID
     * @param userId 用户 ID
     * @param sortOrder 排序顺序
     */
    @Modifying
    @Query("UPDATE WatchlistItem w SET w.sortOrder = :sortOrder "
            + "WHERE w.id = :id AND w.userId = :userId")
    void updateSortOrder(@Param("id") Long id, @Param("userId") Long userId,
                         @Param("sortOrder") Integer sortOrder);
}
