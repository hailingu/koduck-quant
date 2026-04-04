package com.koduck.repository.backtest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.Trade;

/**
 * Repository for trade record operations.
 *
 * @author Koduck Team
 */
@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {

    /**
     * Find all trades for a user, ordered by trade time descending.
     *
     * @param userId the user ID
     * @return the list of trades
     */
    List<Trade> findByUserIdOrderByTradeTimeDesc(Long userId);

    /**
     * Find trades for a user and symbol.
     *
     * @param userId the user ID
     * @param market the market
     * @param symbol the symbol
     * @return the list of trades
     */
    List<Trade> findByUserIdAndMarketAndSymbolOrderByTradeTimeDesc(
            Long userId, String market, String symbol);

    /**
     * Find trades within a time range.
     *
     * @param userId the user ID
     * @param startTime the start time
     * @param endTime the end time
     * @return the list of trades
     */
    @Query("SELECT t FROM Trade t WHERE t.userId = :userId "
            + "AND t.tradeTime BETWEEN :startTime AND :endTime "
            + "ORDER BY t.tradeTime DESC")
    List<Trade> findByUserIdAndTradeTimeBetween(
            @Param("userId") Long userId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * Calculate total buy quantity for a symbol.
     *
     * @param userId the user ID
     * @param market the market
     * @param symbol the symbol
     * @return the total buy quantity
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t "
            + "WHERE t.userId = :userId AND t.market = :market "
            + "AND t.symbol = :symbol AND t.tradeType = 'BUY'")
    BigDecimal sumBuyQuantityByUserAndSymbol(
            @Param("userId") Long userId,
            @Param("market") String market,
            @Param("symbol") String symbol);

    /**
     * Calculate total sell quantity for a symbol.
     *
     * @param userId the user ID
     * @param market the market
     * @param symbol the symbol
     * @return the total sell quantity
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t "
            + "WHERE t.userId = :userId AND t.market = :market "
            + "AND t.symbol = :symbol AND t.tradeType = 'SELL'")
    BigDecimal sumSellQuantityByUserAndSymbol(
            @Param("userId") Long userId,
            @Param("market") String market,
            @Param("symbol") String symbol);
}
