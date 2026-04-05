package com.koduck.repository.portfolio;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.portfolio.Trade;

/**
 * 交易记录操作仓库，提供交易数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {

    /**
     * 查询用户的所有交易，按交易时间降序排列。
     *
     * @param userId 用户 ID
     * @return 交易列表
     */
    List<Trade> findByUserIdOrderByTradeTimeDesc(Long userId);

    /**
     * 查询用户指定股票的交易。
     *
     * @param userId 用户 ID
     * @param market 市场
     * @param symbol 股票代码
     * @return 交易列表
     */
    List<Trade> findByUserIdAndMarketAndSymbolOrderByTradeTimeDesc(
            Long userId, String market, String symbol);

    /**
     * 查询指定时间范围内的交易。
     *
     * @param userId 用户 ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 交易列表
     */
    @Query("SELECT t FROM Trade t WHERE t.userId = :userId "
            + "AND t.tradeTime BETWEEN :startTime AND :endTime "
            + "ORDER BY t.tradeTime DESC")
    List<Trade> findByUserIdAndTradeTimeBetween(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 计算指定股票的累计买入数量。
     *
     * @param userId 用户 ID
     * @param market 市场
     * @param symbol 股票代码
     * @return 累计买入数量
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t "
            + "WHERE t.userId = :userId AND t.market = :market "
            + "AND t.symbol = :symbol AND t.tradeType = 'BUY'")
    BigDecimal sumBuyQuantityByUserAndSymbol(
            @Param("userId") Long userId,
            @Param("market") String market,
            @Param("symbol") String symbol);

    /**
     * 计算指定股票的累计卖出数量。
     *
     * @param userId 用户 ID
     * @param market 市场
     * @param symbol 股票代码
     * @return 累计卖出数量
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t "
            + "WHERE t.userId = :userId AND t.market = :market "
            + "AND t.symbol = :symbol AND t.tradeType = 'SELL'")
    BigDecimal sumSellQuantityByUserAndSymbol(
            @Param("userId") Long userId,
            @Param("market") String market,
            @Param("symbol") String symbol);
}
