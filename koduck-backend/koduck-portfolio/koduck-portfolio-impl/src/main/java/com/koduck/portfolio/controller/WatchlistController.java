package com.koduck.portfolio.controller;

import java.util.List;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.koduck.dto.ApiResponse;
import com.koduck.portfolio.entity.WatchlistItem;
import com.koduck.portfolio.repository.WatchlistRepository;
import com.koduck.security.AuthUserPrincipal;

/**
 * Watchlist API used by frontend pages.
 */
@RestController
@Validated
@RequestMapping("/api/v1/watchlist")
public class WatchlistController {

    private static final String DEFAULT_MARKET = "US";

    private final WatchlistRepository watchlistRepository;

    public WatchlistController(WatchlistRepository watchlistRepository) {
        this.watchlistRepository = watchlistRepository;
    }

    @GetMapping
    public ApiResponse<List<WatchlistItem>> getWatchlist(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal
    ) {
        Long userId = requireUserId(userPrincipal);
        return ApiResponse.success(watchlistRepository.findByUserIdOrderBySortOrderAsc(userId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<WatchlistItem> addToWatchlist(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Valid @RequestBody AddWatchlistRequest request
    ) {
        Long userId = requireUserId(userPrincipal);
        String market = normalizeMarket(request.market());
        String symbol = request.symbol().trim().toUpperCase();

        if (watchlistRepository.existsByUserIdAndMarketAndSymbol(userId, market, symbol)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "stock already exists in watchlist");
        }

        int nextSortOrder = watchlistRepository.findMaxSortOrderByUserId(userId).orElse(0) + 1;
        WatchlistItem item = WatchlistItem.builder()
                .userId(userId)
                .market(market)
                .symbol(symbol)
                .name(request.name().trim())
                .notes(trimToNull(request.notes()))
                .sortOrder(nextSortOrder)
                .build();

        return ApiResponse.success(watchlistRepository.save(item));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ApiResponse<Void> removeFromWatchlist(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        Long userId = requireUserId(userPrincipal);
        ensureOwnedItem(userId, id);
        watchlistRepository.deleteByUserIdAndId(userId, id);
        return ApiResponse.success();
    }

    @PatchMapping("/{id}/sort")
    @Transactional
    public ApiResponse<WatchlistItem> updateSortOrder(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateSortOrderRequest request
    ) {
        Long userId = requireUserId(userPrincipal);
        WatchlistItem item = ensureOwnedItem(userId, id);
        item.setSortOrder(request.sortOrder());
        return ApiResponse.success(watchlistRepository.save(item));
    }

    @PutMapping("/sort")
    @Transactional
    public ApiResponse<Void> sortWatchlist(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @Valid @RequestBody SortWatchlistRequest request
    ) {
        Long userId = requireUserId(userPrincipal);
        for (SortItem sortItem : request.items()) {
            ensureOwnedItem(userId, sortItem.id());
            watchlistRepository.updateSortOrder(sortItem.id(), userId, sortItem.sortOrder());
        }
        return ApiResponse.success();
    }

    @PutMapping("/{id}/notes")
    @Transactional
    public ApiResponse<WatchlistItem> updateNotes(
            @AuthenticationPrincipal AuthUserPrincipal userPrincipal,
            @PathVariable Long id,
            @RequestBody(required = false) String notes
    ) {
        Long userId = requireUserId(userPrincipal);
        WatchlistItem item = ensureOwnedItem(userId, id);
        item.setNotes(trimToNull(notes));
        return ApiResponse.success(watchlistRepository.save(item));
    }

    private Long requireUserId(AuthUserPrincipal userPrincipal) {
        if (userPrincipal == null || userPrincipal.getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "authentication required");
        }
        return userPrincipal.getId();
    }

    private WatchlistItem ensureOwnedItem(Long userId, Long id) {
        WatchlistItem item = watchlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "watchlist item not found"));
        if (!userId.equals(item.getUserId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "watchlist item not found");
        }
        return item;
    }

    private String normalizeMarket(String market) {
        if (market == null || market.isBlank()) {
            return DEFAULT_MARKET;
        }
        return market.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record AddWatchlistRequest(
            String market,
            @NotBlank String symbol,
            @NotBlank String name,
            String notes
    ) { }

    public record UpdateSortOrderRequest(@NotNull Integer sortOrder) { }

    public record SortWatchlistRequest(@NotNull List<@Valid SortItem> items) { }

    public record SortItem(@NotNull Long id, @NotNull Integer sortOrder) { }
}
