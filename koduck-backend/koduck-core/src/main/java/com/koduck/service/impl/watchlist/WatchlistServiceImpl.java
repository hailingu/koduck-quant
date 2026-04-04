package com.koduck.service.impl.watchlist;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.client.DataServiceClient;
import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.entity.market.StockRealtime;
import com.koduck.entity.portfolio.WatchlistItem;
import com.koduck.exception.DuplicateException;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.exception.StateException;
import com.koduck.repository.market.StockRealtimeRepository;
import com.koduck.repository.watchlist.WatchlistRepository;
import com.koduck.service.WatchlistService;
import com.koduck.util.SymbolUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import static com.koduck.util.ServiceValidationUtils.assertOwner;
import static com.koduck.util.ServiceValidationUtils.requireFound;

/**
 * Implementation of {@link WatchlistService} for watchlist operations.
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WatchlistServiceImpl implements WatchlistService {

    /** Maximum number of items allowed in watchlist. */
    private static final int MAX_WATCHLIST_SIZE = 100;

    /** Timeout in seconds for realtime data update. */
    private static final long REALTIME_UPDATE_TIMEOUT_SECONDS = 3L;

    /** Repository for watchlist items. */
    private final WatchlistRepository watchlistRepository;

    /** Repository for stock realtime data. */
    private final StockRealtimeRepository stockRealtimeRepository;

    /** Client for data service operations. */
    private final DataServiceClient dataServiceClient;

    /**
     * {@inheritDoc}
     */
    @Override
    public List<WatchlistItemDto> getWatchlist(Long userId) {
        log.debug("watchlist_get userId={}", userId);
        List<WatchlistItem> items = watchlistRepository.findByUserIdOrderBySortOrderAsc(userId);
        List<String> symbolsToRefresh = items.stream()
                .map(WatchlistItem::getSymbol)
                .map(SymbolUtils::normalize)
                .filter(symbol -> symbol != null && !symbol.isBlank())
                .distinct()
                .collect(Collectors.toCollection(ArrayList::new));
        triggerRealtimeUpdateAsync(symbolsToRefresh);
        Map<String, StockRealtime> realtimeBySymbol = loadRealtimeMap(symbolsToRefresh);
        return items.stream()
            .map(item -> convertToDtoWithPrice(item, realtimeBySymbol))
            .toList();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public WatchlistItemDto addToWatchlist(Long userId, AddWatchlistRequest request) {
        // Normalize symbol to standard 6-digit format for consistent storage
        // This ensures watchlist symbols match stock_realtime table format
        String normalizedSymbol = SymbolUtils.normalize(request.symbol());
        log.debug("watchlist_add_start userId={} market={} symbol={} normalizedSymbol={}",
                userId, request.market(), request.symbol(), normalizedSymbol);
        // Check if already exists (using normalized symbol)
        if (watchlistRepository.existsByUserIdAndMarketAndSymbol(
                userId, request.market(), normalizedSymbol)) {
            throw new DuplicateException("symbol", normalizedSymbol, "Stock already in watchlist");
        }
        // Check watchlist size limit
        long currentSize = watchlistRepository.countByUserId(userId);
        if (currentSize >= MAX_WATCHLIST_SIZE) {
            throw new StateException("Watchlist limit reached (" + MAX_WATCHLIST_SIZE + ")");
        }
        // Get next sort order
        Integer maxOrder = watchlistRepository.findMaxSortOrderByUserId(userId).orElse(-1);
        WatchlistItem item = WatchlistItem.builder()
            .userId(userId)
            .market(request.market())
            .symbol(normalizedSymbol)
            .name(request.name())
            .notes(request.notes())
            .sortOrder(maxOrder + 1)
            .build();
        WatchlistItem saved = watchlistRepository.save(
            Objects.requireNonNull(item, "watchlist item must not be null"));
        log.info("watchlist_add_success id={} userId={} symbol={}",
                saved.getId(), userId, request.symbol());
        // Trigger realtime data update for the newly added symbol
        // This is asynchronous and non-blocking - failures are logged but don't affect the main flow
        triggerRealtimeUpdateAsync(Collections.singletonList(normalizedSymbol));
        Map<String, StockRealtime> realtimeBySymbol =
            loadRealtimeMap(Collections.singletonList(normalizedSymbol));
        return convertToDtoWithPrice(saved, realtimeBySymbol);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void removeFromWatchlist(Long userId, Long itemId) {
        log.debug("watchlist_remove_start userId={} itemId={}", userId, itemId);
        watchlistRepository.deleteByUserIdAndId(userId, itemId);
        log.info("watchlist_remove_success userId={} itemId={}", userId, itemId);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public void sortWatchlist(Long userId, SortWatchlistRequest request) {
        log.debug("watchlist_sort_start userId={} itemsCount={}",
            userId, request.items().size());
        for (SortWatchlistRequest.SortItem item : request.items()) {
            watchlistRepository.updateSortOrder(item.id(), userId, item.sortOrder());
        }
        log.info("watchlist_sort_success userId={}", userId);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @Transactional
    public WatchlistItemDto updateNotes(Long userId, Long itemId, String notes) {
        log.debug("watchlist_update_notes_start userId={} itemId={}", userId, itemId);
        WatchlistItem item = loadWatchlistItemOrThrow(itemId);
        assertOwner(item.getUserId(), userId, "Not authorized to update this item");
        item.setNotes(notes);
        WatchlistItem saved = watchlistRepository.save(item);
        String normalizedSymbol = SymbolUtils.normalize(saved.getSymbol());
        Map<String, StockRealtime> realtimeBySymbol =
                loadRealtimeMap(normalizedSymbol == null
                    ? Collections.emptyList()
                    : Collections.singletonList(normalizedSymbol));
        return convertToDtoWithPrice(saved, realtimeBySymbol);
    }

    /**
     * Load watchlist item by ID or throw exception if not found.
     *
     * @param itemId the item ID
     * @return the watchlist item
     * @throws ResourceNotFoundException if item not found
     */
    private WatchlistItem loadWatchlistItemOrThrow(Long itemId) {
        return requireFound(watchlistRepository.findById(Objects.requireNonNull(itemId)),
                () -> new ResourceNotFoundException("watchlist item", itemId));
    }

    /**
     * Load realtime stock data map for given symbols.
     *
     * @param normalizedSymbols the list of normalized symbols
     * @return map of symbol to stock realtime data
     */
    private Map<String, StockRealtime> loadRealtimeMap(List<String> normalizedSymbols) {
        if (normalizedSymbols == null || normalizedSymbols.isEmpty()) {
            return Collections.emptyMap();
        }
        List<StockRealtime> realtimeList =
            stockRealtimeRepository.findBySymbolIn(normalizedSymbols);
        Map<String, StockRealtime> realtimeBySymbol = new HashMap<>();
        for (StockRealtime realtime : realtimeList) {
            if (realtime.getSymbol() == null) {
                continue;
            }
            realtimeBySymbol.put(SymbolUtils.normalize(realtime.getSymbol()), realtime);
        }
        return realtimeBySymbol;
    }

    /**
     * Trigger async realtime data update for given symbols.
     *
     * @param symbolsToRefresh the list of symbols to refresh
     */
    private void triggerRealtimeUpdateAsync(List<String> symbolsToRefresh) {
        if (symbolsToRefresh == null || symbolsToRefresh.isEmpty()) {
            return;
        }
        CompletableFuture.runAsync(() -> dataServiceClient.triggerRealtimeUpdate(symbolsToRefresh))
                .orTimeout(REALTIME_UPDATE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .exceptionally(ex -> {
                    log.warn("watchlist_realtime_update_failed symbols={} error={}",
                            symbolsToRefresh, ex.getMessage());
                    return null;
                });
    }

    /**
     * Convert watchlist item to DTO with price information.
     *
     * @param item the watchlist item
     * @param realtimeBySymbol map of symbol to stock realtime data
     * @return the watchlist item DTO
     */
    private WatchlistItemDto convertToDtoWithPrice(WatchlistItem item,
                                                   Map<String, StockRealtime> realtimeBySymbol) {
        // Normalize symbol to match stock_realtime table format
        // stock_realtime stores symbols as 6-digit (e.g., "601012")
        // watchlist_item may have market prefix (e.g., "SH601012" or just "601012")
        String normalizedSymbol = SymbolUtils.normalize(item.getSymbol());
        log.debug("watchlist_lookup_realtime_price normalizedSymbol={} originalSymbol={}",
                normalizedSymbol, item.getSymbol());
        Optional<StockRealtime> realtimeOpt =
            Optional.ofNullable(realtimeBySymbol.get(normalizedSymbol));
        BigDecimal price = realtimeOpt.map(StockRealtime::getPrice).orElse(null);
        BigDecimal change = realtimeOpt.map(StockRealtime::getChangeAmount).orElse(null);
        BigDecimal changePercent = realtimeOpt.map(StockRealtime::getChangePercent).orElse(null);
        return WatchlistItemDto.builder()
            .id(item.getId())
            .market(item.getMarket())
            .symbol(item.getSymbol())
            .name(item.getName())
            .sortOrder(item.getSortOrder())
            .notes(item.getNotes())
            .price(price)
            .change(change)
            .changePercent(changePercent)
            .createdAt(item.getCreatedAt())
            .build();
    }
}
