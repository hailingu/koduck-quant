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
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.updatedAt < CURRENT_TIMESTAMP - :threshold * INTERVAL '1 second' ORDER BY s.updatedAt ASC")
    List<StockRealtime> findDelayedStocks(int threshold);
    
    /**
     * Count stocks with delayed updates.
     */
    @Query("SELECT COUNT(s) FROM StockRealtime s WHERE s.updatedAt < CURRENT_TIMESTAMP - :threshold * INTERVAL '1 second'")
    long countDelayedStocks(int threshold);
}
