package com.koduck.repository;

import com.koduck.entity.StockRealtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for stock real-time price data.
 */
@Repository
public interface StockRealtimeRepository extends JpaRepository<StockRealtime, String> {
    
    /**
     * Find stock by symbol.
     */
    Optional<StockRealtime> findBySymbol(String symbol);
    
    /**
     * Find multiple stocks by symbols.
     */
    List<StockRealtime> findBySymbolIn(List<String> symbols);
    
    /**
     * Find stocks ordered by volume descending.
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.volume IS NOT NULL ORDER BY s.volume DESC")
    List<StockRealtime> findTopByVolume(int limit);
    
    /**
     * Find stocks ordered by change percent descending.
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.changePercent IS NOT NULL ORDER BY s.changePercent DESC")
    List<StockRealtime> findTopByGain(int limit);
    
    /**
     * Find stocks ordered by change percent ascending.
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.changePercent IS NOT NULL ORDER BY s.changePercent ASC")
    List<StockRealtime> findTopByLoss(int limit);
    
    /**
     * Count total stocks in the database.
     */
    @Query("SELECT COUNT(s) FROM StockRealtime s")
    long countAll();
    
    /**
     * Find stocks with delayed updates (delay > threshold in seconds).
     * Uses native query for PostgreSQL interval arithmetic.
     */
    @Query(value = "SELECT * FROM stock_realtime WHERE updated_at < NOW() - MAKE_INTERVAL(secs => :threshold) ORDER BY updated_at ASC", nativeQuery = true)
    List<StockRealtime> findDelayedStocks(int threshold);
    
    /**
     * Count stocks with delayed updates.
     */
    @Query(value = "SELECT COUNT(*) FROM stock_realtime WHERE updated_at < MAKE_INTERVAL(secs => :threshold)", nativeQuery = true)
    long countDelayedStocks(int threshold);
}
