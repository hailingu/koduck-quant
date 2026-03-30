package com.koduck.controller.admin;
import com.koduck.dto.ApiResponse;
import com.koduck.service.KlineSyncService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Objects;
/**
 * Admin controller for K-line data management.
 * Requires ADMIN role.
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/admin/kline")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class KlineAdminController {
    private static final String DEFAULT_TIMEFRAME = "1D";
    private static final String DEFAULT_MARKET = "AShare";
    private static final String DEFAULT_BACKFILL_DAYS = "365";
    private static final String MESSAGE_SYNC_TRIGGERED_PREFIX = "Sync triggered for ";
    private static final String MESSAGE_BACKFILL_TRIGGERED_PREFIX = "Backfill triggered for ";
    private static final String MESSAGE_BATCH_SYNC_TRIGGERED_PREFIX = "Batch sync triggered for ";
    private static final String MESSAGE_BATCH_SYNC_TRIGGERED_SUFFIX = " symbols";
    private static final String ERROR_SYMBOLS_REQUIRED = "symbols must not be empty";
    private static final String ERROR_SYMBOLS_CONTAINS_BLANK = "symbols must not contain blank values";
    private final KlineSyncService klineSyncService;
    /**
     * Manually triggers K-line data synchronization for a symbol.
     *
     * @param market market identifier, for example {@code AShare}
     * @param symbol stock symbol code
     * @param timeframe K-line timeframe, for example {@code 1D}
     * @return API response containing the trigger result message
     */
    @PostMapping("/sync/{market}/{symbol}")
    public ApiResponse<String> syncSymbol(
            @PathVariable @NotBlank String market,
            @PathVariable @NotBlank String symbol,
            @RequestParam(defaultValue = DEFAULT_TIMEFRAME) @NotBlank String timeframe) {
        log.info("Manual sync triggered for {}/{}/{}", market, symbol, timeframe);
        klineSyncService.syncSymbolKline(market, symbol, timeframe);
        return ApiResponse.success(MESSAGE_SYNC_TRIGGERED_PREFIX + symbol);
    }
    /**
     * Triggers historical data backfill for a symbol.
     *
     * @param market market identifier, for example {@code AShare}
     * @param symbol stock symbol code
     * @param timeframe K-line timeframe, for example {@code 1D}
     * @param days number of historical days to backfill
     * @return API response containing the trigger result message
     */
    @PostMapping("/backfill/{market}/{symbol}")
    public ApiResponse<String> backfillSymbol(
            @PathVariable @NotBlank String market,
            @PathVariable @NotBlank String symbol,
            @RequestParam(defaultValue = DEFAULT_TIMEFRAME) @NotBlank String timeframe,
            @RequestParam(defaultValue = DEFAULT_BACKFILL_DAYS) @Min(1) @Max(3650) int days) {
        log.info("Backfill triggered for {}/{}/{} for {} days", market, symbol, timeframe, days);
        klineSyncService.backfillHistoricalData(market, symbol, timeframe, days);
        return ApiResponse.success(MESSAGE_BACKFILL_TRIGGERED_PREFIX + symbol);
    }
    /**
     * Triggers asynchronous batch synchronization for multiple symbols.
     *
     * @param symbols stock symbol list
     * @param market market identifier, for example {@code AShare}
     * @param timeframe K-line timeframe, for example {@code 1D}
     * @return API response containing the trigger result message
     */
    @PostMapping("/sync/batch")
    public ApiResponse<String> syncBatch(
            @RequestParam @NotEmpty List<@NotBlank String> symbols,
            @RequestParam(defaultValue = DEFAULT_MARKET) @NotBlank String market,
            @RequestParam(defaultValue = DEFAULT_TIMEFRAME) @NotBlank String timeframe) {
        Objects.requireNonNull(symbols, ERROR_SYMBOLS_REQUIRED);
        if (symbols.isEmpty()) {
            throw new IllegalArgumentException(ERROR_SYMBOLS_REQUIRED);
        }
        if (symbols.stream().anyMatch(symbol -> symbol == null || symbol.isBlank())) {
            throw new IllegalArgumentException(ERROR_SYMBOLS_CONTAINS_BLANK);
        }
        log.info("Batch sync triggered for {} symbols", symbols.size());
        klineSyncService.syncBatchSymbols(market, symbols, timeframe);
        return ApiResponse.success(
                MESSAGE_BATCH_SYNC_TRIGGERED_PREFIX + symbols.size() + MESSAGE_BATCH_SYNC_TRIGGERED_SUFFIX
        );
    }
}
