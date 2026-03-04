package com.koduck.repository;

import com.koduck.entity.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for trade record operations.
 */
@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {
    
    /**
     * Find all trades for a user, ordered by trade time descending.
     */
    List<Trade> findByUserIdOrderByTradeTimeDesc(Long userId);
    
    /**
     * Find trades for a user and symbol.
     */
    List<Trade> findByUserIdAndMarketAndSymbolOrderByTradeTimeDesc(Long userId, String market, String symbol);
    
    /**
     * Find trades within a time range.
     */
    @Query("SELECT t FROM Trade t WHERE t.userId = :userId AND t.tradeTime BETWEEN :startTime AND :endTime ORDER BY t.tradeTime DESC")
    List<Trade> findByUserIdAndTradeTimeBetween(@Param("userId") Long userId, 
                                                 @Param("startTime") LocalDateTime startTime, 
                                                 @Param("endTime") LocalDateTime endTime);
    
    /**
     * Calculate total buy quantity for a symbol.
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t WHERE t.userId = :userId AND t.market = :market AND t.symbol = :symbol AND t.tradeType = 'BUY'")
    java.math.BigDecimal sumBuyQuantityByUserAndSymbol(@Param("userId") Long userId, @Param("market") String market, @Param("symbol") String symbol);
    
    /**
     * Calculate total sell quantity for a symbol.
     */
    @Query("SELECT COALESCE(SUM(t.quantity), 0) FROM Trade t WHERE t.userId = :userId AND t.market = :market AND t.symbol = :symbol AND t.tradeType = 'SELL'")
    java.math.BigDecimal sumSellQuantityByUserAndSymbol(@Param("userId") Long userId, @Param("market") String market, @Param("symbol") String symbol);
}
