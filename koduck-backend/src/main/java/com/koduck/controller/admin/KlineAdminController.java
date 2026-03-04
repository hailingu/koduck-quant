package com.koduck.controller.admin;

import com.koduck.dto.ApiResponse;
import com.koduck.service.KlineSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin controller for K-line data management.
 * Requires ADMIN role.
 */
@RestController
@RequestMapping("/api/v1/admin/kline")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class KlineAdminController {
    
    private final KlineSyncService klineSyncService;
    
    /**
     * Manually trigger K-line data sync for a symbol.
     */
    @PostMapping("/sync/{market}/{symbol}")
    public ApiResponse<String> syncSymbol(
            @PathVariable String market,
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1D") String timeframe) {
        
        log.info("Manual sync triggered for {}/{}/{}", market, symbol, timeframe);
        
        klineSyncService.syncSymbolKline(market, symbol, timeframe);
        
        return ApiResponse.success("Sync triggered for " + symbol);
    }
    
    /**
     * Backfill historical data for a symbol.
     */
    @PostMapping("/backfill/{market}/{symbol}")
    public ApiResponse<String> backfillSymbol(
            @PathVariable String market,
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1D") String timeframe,
            @RequestParam(defaultValue = "365") int days) {
        
        log.info("Backfill triggered for {}/{}/{} for {} days", market, symbol, timeframe, days);
        
        klineSyncService.backfillHistoricalData(market, symbol, timeframe, days);
        
        return ApiResponse.success("Backfill triggered for " + symbol);
    }
    
    /**
     * Batch sync multiple symbols.
     */
    @PostMapping("/sync/batch")
    public ApiResponse<String> syncBatch(
            @RequestParam List<String> symbols,
            @RequestParam(defaultValue = "AShare") String market,
            @RequestParam(defaultValue = "1D") String timeframe) {
        
        log.info("Batch sync triggered for {} symbols", symbols.size());
        
        for (String symbol : symbols) {
            klineSyncService.syncSymbolKline(market, symbol, timeframe);
            try {
                Thread.sleep(500); // Rate limiting
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        
        return ApiResponse.success("Batch sync completed for " + symbols.size() + " symbols");
    }
}
