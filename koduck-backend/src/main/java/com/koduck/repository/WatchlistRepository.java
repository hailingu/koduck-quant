package com.koduck.repository;

import com.koduck.entity.WatchlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for watchlist operations.
 */
@Repository
public interface WatchlistRepository extends JpaRepository<WatchlistItem, Long> {
    
    /**
     * Find all watchlist items for a user, ordered by sort_order.
     */
    List<WatchlistItem> findByUserIdOrderBySortOrderAsc(Long userId);
    
    /**
     * Find a specific watchlist item by user and symbol.
     */
    Optional<WatchlistItem> findByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);
    
    /**
     * Check if a symbol exists in user's watchlist.
     */
    boolean existsByUserIdAndMarketAndSymbol(Long userId, String market, String symbol);
    
    /**
     * Count items in user's watchlist.
     */
    long countByUserId(Long userId);
    
    /**
     * Delete a watchlist item by user and symbol.
     */
    @Modifying
    @Query("DELETE FROM WatchlistItem w WHERE w.userId = :userId AND w.id = :id")
    void deleteByUserIdAndId(@Param("userId") Long userId, @Param("id") Long id);
    
    /**
     * Find the maximum sort_order for a user (for appending new items).
     */
    @Query("SELECT MAX(w.sortOrder) FROM WatchlistItem w WHERE w.userId = :userId")
    Optional<Integer> findMaxSortOrderByUserId(@Param("userId") Long userId);
    
    /**
     * Update sort order for a batch of items.
     */
    @Modifying
    @Query("UPDATE WatchlistItem w SET w.sortOrder = :sortOrder WHERE w.id = :id AND w.userId = :userId")
    void updateSortOrder(@Param("id") Long id, @Param("userId") Long userId, @Param("sortOrder") Integer sortOrder);
}
