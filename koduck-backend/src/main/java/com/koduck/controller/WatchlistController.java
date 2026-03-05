package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

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
 * Watchlist (自选股) REST API controller.
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
@Validated
@Tag(name = "自选股", description = "自选股列表管理接口")
@Slf4j
public class WatchlistController {

    private final WatchlistService watchlistService;

    /**
     * Get user's watchlist with real-time prices.
     */
    @GetMapping
    public ApiResponse<List<WatchlistItemDto>> getWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        log.debug("GET /api/v1/watchlist: user={}", userPrincipal.getUser().getId());

        List<WatchlistItemDto> watchlist = watchlistService.getWatchlist(userPrincipal.getUser().getId());
        return ApiResponse.success(watchlist);
    }

    /**
     * Add a stock to watchlist.
     */
    @PostMapping
    public ApiResponse<WatchlistItemDto> addToWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddWatchlistRequest request) {

        log.debug("POST /api/v1/watchlist: user={}, market={}, symbol={}",
                 userPrincipal.getUser().getId(), request.market(), request.symbol());

        WatchlistItemDto item = watchlistService.addToWatchlist(userPrincipal.getUser().getId(), request);
        return ApiResponse.success(item);
    }

    /**
     * Remove a stock from watchlist.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> removeFromWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive Long id) {

        log.debug("DELETE /api/v1/watchlist/{}: user={}", id, userPrincipal.getUser().getId());

        watchlistService.removeFromWatchlist(userPrincipal.getUser().getId(), id);
        return ApiResponse.success();
    }

    /**
     * Update sort order of watchlist items.
     */
    @PutMapping("/sort")
    public ApiResponse<Void> sortWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody SortWatchlistRequest request) {

        log.debug("PUT /api/v1/watchlist/sort: user={}, items={}", userPrincipal.getUser().getId(), request.items().size());

        watchlistService.sortWatchlist(userPrincipal.getUser().getId(), request);
        return ApiResponse.success();
    }

    /**
     * Update notes for a watchlist item.
     */
    @PutMapping("/{id}/notes")
    public ApiResponse<WatchlistItemDto> updateNotes(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable @Positive Long id,
            @RequestBody @NotNull @Size(max = 500, message = "Notes too long") String notes) {

        log.debug("PUT /api/v1/watchlist/{}/notes: user={}", id, userPrincipal.getUser().getId());

        WatchlistItemDto item = watchlistService.updateNotes(userPrincipal.getUser().getId(), id, notes);
        return ApiResponse.success(item);
    }
}
