package com.koduck.repository;

import com.koduck.entity.KlineData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for K-line data operations.
 */
@Repository
public interface KlineDataRepository extends JpaRepository<KlineData, Long> {
    
    /**
     * Find K-line data by market, symbol, timeframe and time range.
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeAndKlineTimeBetweenOrderByKlineTimeDesc(
            String market, String symbol, String timeframe, 
            LocalDateTime startTime, LocalDateTime endTime);
    
    /**
     * Find K-line data with pagination.
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe, Pageable pageable);
    
    /**
     * Find K-line data before a specific time.
     */
    @Query("SELECT k FROM KlineData k WHERE k.market = :market AND k.symbol = :symbol " +
           "AND k.timeframe = :timeframe AND k.klineTime < :beforeTime " +
           "ORDER BY k.klineTime DESC")
    List<KlineData> findBeforeTime(@Param("market") String market,
                                   @Param("symbol") String symbol,
                                   @Param("timeframe") String timeframe,
                                   @Param("beforeTime") LocalDateTime beforeTime,
                                   Pageable pageable);
    
    /**
     * Find the latest K-line data for a symbol.
     */
    Optional<KlineData> findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe);
    
    /**
     * Check if data exists for a specific time.
     */
    boolean existsByMarketAndSymbolAndTimeframeAndKlineTime(
            String market, String symbol, String timeframe, LocalDateTime klineTime);
    
    /**
     * Count data points for a symbol.
     */
    long countByMarketAndSymbolAndTimeframe(String market, String symbol, String timeframe);
    
    /**
     * Delete old data (for data retention).
     */
    void deleteByKlineTimeBefore(LocalDateTime cutoffTime);
}
