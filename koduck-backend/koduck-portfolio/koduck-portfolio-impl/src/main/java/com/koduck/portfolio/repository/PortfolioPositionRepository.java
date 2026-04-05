package com.koduck.portfolio.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.portfolio.entity.PortfolioPosition;

/**
 * 投资组合持仓操作仓库，提供投资组合持仓数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface PortfolioPositionRepository extends JpaRepository<PortfolioPosition, Long> {

    /**
     * 查询用户的所有持仓。
     *
     * @param userId 用户 ID
     * @return 投资组合持仓列表
     */
    List<PortfolioPosition> findByUserId(Long userId);

    /**
     * 根据用户和股票代码查询特定持仓。
     *
     * @param userId 用户 ID
     * @param market 市场
     * @param symbol 股票代码
     * @return 投资组合持仓
     */
    Optional<PortfolioPosition> findByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);

    /**
     * 检查用户是否持有指定股票。
     *
     * @param userId 用户 ID
     * @param market 市场
     * @param symbol 股票代码
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);

    /**
     * 根据用户和持仓 ID 删除持仓。
     *
     * @param userId 用户 ID
     * @param id 持仓 ID
     */
    @Modifying
    @Query("DELETE FROM PortfolioPosition p WHERE p.userId = :userId AND p.id = :id")
    void deleteByUserIdAndId(@Param("userId") Long userId, @Param("id") Long id);
}
