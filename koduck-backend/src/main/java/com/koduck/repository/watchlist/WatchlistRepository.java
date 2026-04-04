package com.koduck.repository.watchlist;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.portfolio.WatchlistItem;

/**
 * Repository for watchlist operations.
 *
 * @author Koduck Team
 */
@Repository
public interface WatchlistRepository extends JpaRepository<WatchlistItem, Long> {

    /**
     * Find all watchlist items for a user, ordered by sort_order.
     *
     * @param userId the user ID
     * @return list of watchlist items
     */
    List<WatchlistItem> findByUserIdOrderBySortOrderAsc(Long userId);

    /**
     * Find a specific watchlist item by user and symbol.
     *
     * @param userId the user ID
     * @param market the market code
     * @param symbol the symbol
     * @return optional of watchlist item
     */
    Optional<WatchlistItem> findByUserIdAndMarketAndSymbol(
            Long userId, String market, String symbol);

    /**
     * Check if a symbol exists in user's watchlist.
     *
     * @param userId the user ID
     * @param market the market code
     * @param symbol the symbol
     * @return true if exists
     */
    boolean existsByUserIdAndMarketAndSymbol(
            Long userId, String market, String symbol);

    /**
     * Count items in user's watchlist.
     *
     * @param userId the user ID
     * @return the count
     */
    long countByUserId(Long userId);

    /**
     * Delete a watchlist item by user and symbol.
     *
     * @param userId the user ID
     * @param id     the item ID
     */
    @Modifying
    @Query("DELETE FROM WatchlistItem w WHERE w.userId = :userId AND w.id = :id")
    void deleteByUserIdAndId(
            @Param("userId") Long userId, @Param("id") Long id);

    /**
     * Find the maximum sort_order for a user (for appending new items).
     *
     * @param userId the user ID
     * @return optional of max sort order
     */
    @Query("SELECT MAX(w.sortOrder) FROM WatchlistItem w WHERE w.userId = :userId")
    Optional<Integer> findMaxSortOrderByUserId(@Param("userId") Long userId);

    /**
     * Update sort order for a batch of items.
     *
     * @param id        the item ID
     * @param userId    the user ID
     * @param sortOrder the sort order
     */
    @Modifying
    @Query("UPDATE WatchlistItem w SET w.sortOrder = :sortOrder "
            + "WHERE w.id = :id AND w.userId = :userId")
    void updateSortOrder(@Param("id") Long id, @Param("userId") Long userId,
                         @Param("sortOrder") Integer sortOrder);
}
