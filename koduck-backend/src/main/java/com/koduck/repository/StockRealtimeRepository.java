package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.StockRealtime;

/**
 * Repository for stock real-time price data.
 *
 * @author Koduck Team
 */
@Repository
public interface StockRealtimeRepository extends JpaRepository<StockRealtime, String> {

    /**
     * Find stock by symbol.
     *
     * @param symbol the stock symbol
     * @return the stock realtime data
     */
    Optional<StockRealtime> findBySymbol(String symbol);

    /**
     * Find latest stock quote by symbol.
     * Useful when legacy data may contain duplicate symbol rows.
     *
     * @param symbol the stock symbol
     * @return the latest stock realtime data
     */
    Optional<StockRealtime> findFirstBySymbolOrderByUpdatedAtDesc(String symbol);

    /**
     * Find stock by normalized symbol (ignoring market prefix and case).
     * Uses case-insensitive matching with ILIKE for PostgreSQL.
     *
     * @param symbol the stock symbol
     * @return the stock realtime data
     */
    @Query("SELECT s FROM StockRealtime s WHERE UPPER(s.symbol) = UPPER(:symbol)")
    Optional<StockRealtime> findBySymbolIgnoreCase(@Param("symbol") String symbol);

    /**
     * Find stocks by normalized symbols (ignoring market prefix and case).
     *
     * @param symbols the list of stock symbols
     * @return the list of stock realtime data
     */
    @Query("SELECT s FROM StockRealtime s WHERE UPPER(s.symbol) IN "
            + "(SELECT UPPER(:symbol) FROM StockRealtime s)")
    List<StockRealtime> findBySymbolInIgnoreCase(@Param("symbols") List<String> symbols);

    /**
     * Find multiple stocks by symbols.
     *
     * @param symbols the list of stock symbols
     * @return the list of stock realtime data
     */
    List<StockRealtime> findBySymbolIn(List<String> symbols);

    /**
     * Find multiple stocks by symbols and type.
     * Used to distinguish between stocks and indices with same symbol code.
     *
     * @param symbols the list of stock symbols
     * @param type the stock type
     * @return the list of stock realtime data
     */
    List<StockRealtime> findBySymbolInAndType(List<String> symbols, String type);

    /**
     * Find stocks ordered by volume descending.
     *
     * @param limit the maximum number of results
     * @return the list of stock realtime data
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.volume IS NOT NULL ORDER BY s.volume DESC")
    List<StockRealtime> findTopByVolume(int limit);

    /**
     * Find stocks ordered by change percent descending.
     *
     * @param limit the maximum number of results
     * @return the list of stock realtime data
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.changePercent IS NOT NULL "
            + "ORDER BY s.changePercent DESC")
    List<StockRealtime> findTopByGain(int limit);

    /**
     * Find stocks ordered by change percent ascending.
     *
     * @param limit the maximum number of results
     * @return the list of stock realtime data
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.changePercent IS NOT NULL "
            + "ORDER BY s.changePercent ASC")
    List<StockRealtime> findTopByLoss(int limit);

    /**
     * Count total stocks in the database.
     *
     * @return the total count of stocks
     */
    @Query("SELECT COUNT(s) FROM StockRealtime s")
    long countAll();

    /**
     * Find stocks with delayed updates (delay > threshold in seconds).
     * Uses native query for PostgreSQL interval arithmetic.
     *
     * @param threshold the threshold in seconds
     * @return the list of stock realtime data with delayed updates
     */
    @Query(value = "SELECT * FROM stock_realtime WHERE updated_at < NOW() - MAKE_INTERVAL(secs => :threshold) "
            + "ORDER BY updated_at ASC", nativeQuery = true)
    List<StockRealtime> findDelayedStocks(int threshold);

    /**
     * Count stocks with delayed updates.
     *
     * @param threshold the threshold in seconds
     * @return the count of stocks with delayed updates
     */
    @Query(value = "SELECT COUNT(*) FROM stock_realtime WHERE updated_at < MAKE_INTERVAL(secs => :threshold)",
            nativeQuery = true)
    long countDelayedStocks(int threshold);
}
