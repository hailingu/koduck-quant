package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.security.UserPrincipal;
import com.koduck.service.WatchlistService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Watchlist () REST API controller.
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
@Validated
@Tag(name = "自选股", description = "自选股列表管理接口")
@Slf4j
public class WatchlistController {

    private final AuthenticatedUserResolver authenticatedUserResolver;
    private final WatchlistService watchlistService;

    /**
     * Get user's watchlist with real-time prices.
     */
    @GetMapping
    public ApiResponse<List<WatchlistItemDto>> getWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);

        log.debug("GET /api/v1/watchlist: user={}", userId);

        List<WatchlistItemDto> watchlist = watchlistService.getWatchlist(userId);
        return ApiResponse.success(watchlist);
    }

    /**
     * Add a stock to watchlist.
     */
    @PostMapping
    public ApiResponse<WatchlistItemDto> addToWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddWatchlistRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);

        log.debug("POST /api/v1/watchlist: user={}, market={}, symbol={}",
                 userId, request.market(), request.symbol());

        WatchlistItemDto item = watchlistService.addToWatchlist(userId, request);
        return ApiResponse.success(item);
    }

    /**
     * Remove a stock from watchlist.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> removeFromWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive Long id) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);

        log.debug("DELETE /api/v1/watchlist/{}: user={}", id, userId);

        watchlistService.removeFromWatchlist(userId, id);
        return ApiResponse.successNoContent();
    }

    /**
     * Update sort order of watchlist items.
     */
    @PutMapping("/sort")
    public ApiResponse<Void> sortWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody SortWatchlistRequest request) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);

        log.debug("PUT /api/v1/watchlist/sort: user={}, items={}", userId, request.items().size());

        watchlistService.sortWatchlist(userId, request);
        return ApiResponse.successNoContent();
    }

    /**
     * Update notes for a watchlist item.
     */
    @PutMapping("/{id}/notes")
    public ApiResponse<WatchlistItemDto> updateNotes(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive Long id,
            @RequestBody @NotNull @Size(max = 500, message = "Notes too long") String notes) {
        Long userId = authenticatedUserResolver.requireUserId(userPrincipal);

        log.debug("PUT /api/v1/watchlist/{}/notes: user={}", id, userId);

        WatchlistItemDto item = watchlistService.updateNotes(userId, id, notes);
        return ApiResponse.success(item);
    }
}
