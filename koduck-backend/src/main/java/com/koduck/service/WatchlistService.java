package com.koduck.service;
import java.util.List;

import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;

/**
 * Service interface for watchlist operations.
 */
public interface WatchlistService {

    /**
     * Get user's watchlist with real-time prices.
     *
     * @param userId the user ID
     * @return list of watchlist items with real-time prices
     */
    List<WatchlistItemDto> getWatchlist(Long userId);

    /**
     * Add a stock to user's watchlist.
     *
     * @param userId  the user ID
     * @param request the add request containing symbol, market, name, and notes
     * @return the created watchlist item
     */
    WatchlistItemDto addToWatchlist(Long userId, AddWatchlistRequest request);

    /**
     * Remove a stock from watchlist.
     *
     * @param userId the user ID
     * @param itemId the watchlist item ID to remove
     */
    void removeFromWatchlist(Long userId, Long itemId);

    /**
     * Update sort order of watchlist items.
     *
     * @param userId  the user ID
     * @param request the sort request containing item IDs and their new sort orders
     */
    void sortWatchlist(Long userId, SortWatchlistRequest request);

    /**
     * Update notes for a watchlist item.
     *
     * @param userId the user ID
     * @param itemId the watchlist item ID
     * @param notes  the new notes
     * @return the updated watchlist item
     */
    WatchlistItemDto updateNotes(Long userId, Long itemId, String notes);
}
