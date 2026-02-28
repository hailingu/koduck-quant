package com.koduck.service;

import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.entity.WatchlistItem;
import com.koduck.repository.WatchlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for watchlist operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WatchlistService {
    
    private final WatchlistRepository watchlistRepository;
    private final KlineService klineService;
    
    private static final String DEFAULT_TIMEFRAME = "1D";
    private static final int MAX_WATCHLIST_SIZE = 100;
    
    /**
     * Get user's watchlist with real-time prices.
     */
    public List<WatchlistItemDto> getWatchlist(Long userId) {
        log.debug("Getting watchlist for user: {}", userId);
        
        List<WatchlistItem> items = watchlistRepository.findByUserIdOrderBySortOrderAsc(userId);
        
        return items.stream()
            .map(this::convertToDtoWithPrice)
            .collect(Collectors.toList());
    }
    
    /**
     * Add a stock to user's watchlist.
     */
    @Transactional
    public WatchlistItemDto addToWatchlist(Long userId, AddWatchlistRequest request) {
        log.debug("Adding to watchlist: user={}, market={}, symbol={}", 
                 userId, request.market(), request.symbol());
        
        // Check if already exists
        if (watchlistRepository.existsByUserIdAndMarketAndSymbol(
                userId, request.market(), request.symbol())) {
            throw new IllegalArgumentException("Stock already in watchlist");
        }
        
        // Check watchlist size limit
        long currentSize = watchlistRepository.countByUserId(userId);
        if (currentSize >= MAX_WATCHLIST_SIZE) {
            throw new IllegalStateException("Watchlist limit reached (" + MAX_WATCHLIST_SIZE + ")");
        }
        
        // Get next sort order
        Integer maxOrder = watchlistRepository.findMaxSortOrderByUserId(userId).orElse(-1);
        
        WatchlistItem item = WatchlistItem.builder()
            .userId(userId)
            .market(request.market())
            .symbol(request.symbol())
            .name(request.name())
            .notes(request.notes())
            .sortOrder(maxOrder + 1)
            .build();
        
        WatchlistItem saved = watchlistRepository.save(item);
        log.info("Added to watchlist: id={}, user={}, symbol={}", saved.getId(), userId, request.symbol());
        
        return convertToDtoWithPrice(saved);
    }
    
    /**
     * Remove a stock from watchlist.
     */
    @Transactional
    public void removeFromWatchlist(Long userId, Long itemId) {
        log.debug("Removing from watchlist: user={}, itemId={}", userId, itemId);
        
        watchlistRepository.deleteByUserIdAndId(userId, itemId);
        log.info("Removed from watchlist: user={}, itemId={}", userId, itemId);
    }
    
    /**
     * Update sort order of watchlist items.
     */
    @Transactional
    public void sortWatchlist(Long userId, SortWatchlistRequest request) {
        log.debug("Sorting watchlist: user={}, items={}", userId, request.items().size());
        
        for (SortWatchlistRequest.SortItem item : request.items()) {
            watchlistRepository.updateSortOrder(item.id(), userId, item.sortOrder());
        }
        
        log.info("Watchlist sorted: user={}", userId);
    }
    
    /**
     * Update notes for a watchlist item.
     */
    @Transactional
    public WatchlistItemDto updateNotes(Long userId, Long itemId, String notes) {
        log.debug("Updating notes: user={}, itemId={}", userId, itemId);
        
        WatchlistItem item = watchlistRepository.findById(itemId)
            .orElseThrow(() -> new IllegalArgumentException("Watchlist item not found"));
        
        if (!item.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to update this item");
        }
        
        item.setNotes(notes);
        WatchlistItem saved = watchlistRepository.save(item);
        
        return convertToDtoWithPrice(saved);
    }
    
    private WatchlistItemDto convertToDtoWithPrice(WatchlistItem item) {
        // Get real-time price
        Optional<BigDecimal> price = klineService.getLatestPrice(
            item.getMarket(), item.getSymbol(), DEFAULT_TIMEFRAME);
        
        // TODO: Calculate change percent (need previous close)
        BigDecimal changePercent = null;
        
        return WatchlistItemDto.builder()
            .id(item.getId())
            .market(item.getMarket())
            .symbol(item.getSymbol())
            .name(item.getName())
            .sortOrder(item.getSortOrder())
            .notes(item.getNotes())
            .currentPrice(price.orElse(null))
            .changePercent(changePercent)
            .createdAt(item.getCreatedAt())
            .build();
    }
}
