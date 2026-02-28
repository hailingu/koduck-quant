package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;
import com.koduck.entity.User;
import com.koduck.service.WatchlistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Watchlist (自选股) REST API controller.
 */
@RestController
@RequestMapping("/api/v1/watchlist")
@RequiredArgsConstructor
@Slf4j
public class WatchlistController {
    
    private final WatchlistService watchlistService;
    
    /**
     * Get user's watchlist with real-time prices.
     */
    @GetMapping
    public ApiResponse<List<WatchlistItemDto>> getWatchlist(
            @AuthenticationPrincipal User user) {
        
        log.debug("GET /api/v1/watchlist: user={}", user.getId());
        
        List<WatchlistItemDto> watchlist = watchlistService.getWatchlist(user.getId());
        return ApiResponse.success(watchlist);
    }
    
    /**
     * Add a stock to watchlist.
     */
    @PostMapping
    public ApiResponse<WatchlistItemDto> addToWatchlist(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody AddWatchlistRequest request) {
        
        log.debug("POST /api/v1/watchlist: user={}, market={}, symbol={}", 
                 user.getId(), request.market(), request.symbol());
        
        WatchlistItemDto item = watchlistService.addToWatchlist(user.getId(), request);
        return ApiResponse.success(item);
    }
    
    /**
     * Remove a stock from watchlist.
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> removeFromWatchlist(
            @AuthenticationPrincipal User user,
            @PathVariable Long id) {
        
        log.debug("DELETE /api/v1/watchlist/{}: user={}", id, user.getId());
        
        watchlistService.removeFromWatchlist(user.getId(), id);
        return ApiResponse.success();
    }
    
    /**
     * Update sort order of watchlist items.
     */
    @PutMapping("/sort")
    public ApiResponse<Void> sortWatchlist(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SortWatchlistRequest request) {
        
        log.debug("PUT /api/v1/watchlist/sort: user={}, items={}", user.getId(), request.items().size());
        
        watchlistService.sortWatchlist(user.getId(), request);
        return ApiResponse.success();
    }
    
    /**
     * Update notes for a watchlist item.
     */
    @PutMapping("/{id}/notes")
    public ApiResponse<WatchlistItemDto> updateNotes(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody String notes) {
        
        log.debug("PUT /api/v1/watchlist/{}/notes: user={}", id, user.getId());
        
        WatchlistItemDto item = watchlistService.updateNotes(user.getId(), id, notes);
        return ApiResponse.success(item);
    }
}
