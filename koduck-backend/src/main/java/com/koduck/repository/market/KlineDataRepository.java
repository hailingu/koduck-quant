package com.koduck.repository.market;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.KlineData;

/**
 * Repository for K-line data operations.
 *
 * @author Koduck Team
 */
@Repository
public interface KlineDataRepository extends JpaRepository<KlineData, Long> {

    /**
     * Find K-line data by market, symbol, timeframe and time range.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @param startTime the start time
     * @param endTime the end time
     * @return list of K-line data
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeAndKlineTimeBetweenOrderByKlineTimeDesc(
            String market, String symbol, String timeframe,
            LocalDateTime startTime, LocalDateTime endTime);

    /**
     * Find K-line data with pagination.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @param pageable the pageable
     * @return list of K-line data
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe, Pageable pageable);

    /**
     * Find K-line data before a specific time.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @param beforeTime the before time
     * @param pageable the pageable
     * @return list of K-line data
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
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @return optional of K-line data
     */
    Optional<KlineData> findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe);

    /**
     * Check if data exists for a specific time.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @param klineTime the kline time
     * @return true if exists, false otherwise
     */
    boolean existsByMarketAndSymbolAndTimeframeAndKlineTime(
            String market, String symbol, String timeframe, LocalDateTime klineTime);

    /**
     * Count data points for a symbol.
     *
     * @param market the market
     * @param symbol the symbol
     * @param timeframe the timeframe
     * @return count of data points
     */
    long countByMarketAndSymbolAndTimeframe(String market, String symbol, String timeframe);

    /**
     * Delete old data (for data retention).
     *
     * @param cutoffTime the cutoff time
     */
    void deleteByKlineTimeBefore(LocalDateTime cutoffTime);
}
