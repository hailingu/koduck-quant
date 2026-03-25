package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineSyncService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * REST API controller for market data.
 * <p>Provides endpoints for symbol search, stock details, market indices, and batch quotes.</p>
 */
@RestController
@RequestMapping("/api/v1/market")
@RequiredArgsConstructor
@Tag(name = "市场数据", description = "市场配置、股票代码搜索、市场指数等市场相关接口")
@Validated
@Slf4j
public class MarketController {
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter TICK_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final long BLOCK_ORDER_VOLUME_THRESHOLD = 100_000L;
    
    private final MarketService marketService;
    private final KlineService klineService;
    private final KlineSyncService klineSyncService;
    private final SyntheticTickService syntheticTickService;
    private final TickStreamService tickStreamService;
    
    /**
     * Search for symbols.
     * <p>Finds stock symbols or names matching the given keyword.</p>
     *
     * @param keyword search keyword, must not be blank and max length 50
     * @param page    page number (starts at 1, default 1)
     * @param size    page size (default 20, max 100)
     * @return list of matching symbols
     */
    @GetMapping("/search")
    public ApiResponse<List<SymbolInfoDto>> searchSymbols(
            @RequestParam @NotBlank(message = "关键词不能为空") 
            @Size(max = 50, message = "关键词长度不能超过 50") 
            String keyword,
            @RequestParam(defaultValue = "1") 
            @Min(value = 1, message = "页码最小为 1") 
            Integer page,
            @RequestParam(defaultValue = "20") 
            @Min(value = 1, message = "每页数量最小为 1") 
            @Max(value = 100, message = "每页数量最大为 100") 
            Integer size) {
        
        log.info("GET /api/v1/market/search: keyword={}, page={}, size={}", keyword, page, size);
        
        List<SymbolInfoDto> results = marketService.searchSymbols(keyword, page, size);
        return ApiResponse.success(results);
    }
    
    /**
     * Get stock details.
     * <p>Retrieves real-time quote information for a single stock.</p>
     *
     * @param symbol stock symbol (e.g. "002326"), must not be blank
     * @return real-time price quote for the symbol
     */
    @GetMapping("/stocks/{symbol}")
    public ApiResponse<PriceQuoteDto> getStockDetail(
            @PathVariable @NotBlank(message = "股票代码不能为空") 
            String symbol) {
        
        log.info("GET /api/v1/market/stocks/{}", symbol);
        
        PriceQuoteDto quote = marketService.getStockDetail(symbol);
        if (quote == null) {
            return ApiResponse.error(404, "股票代码不存在: " + symbol);
        }
        return ApiResponse.success(quote);
    }

    /**
     * Get stock daily statistics.
     * <p>Retrieves daily trading statistics including open/high/low/current prices,
     * change/changePercent, volume and amount.</p>
     *
     * @param symbol stock symbol (e.g. "600519"), must not be blank
     * @param market market code (e.g. "AShare"), defaults to AShare
     * @return daily statistics for the stock
     */
    @GetMapping("/stocks/{symbol}/stats")
    public ApiResponse<StockStatsDto> getStockStats(
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol,
            @RequestParam(defaultValue = "AShare") String market) {
        
        log.info("GET /api/v1/market/stocks/{}/stats?market={}", symbol, market);
        
        StockStatsDto stats = marketService.getStockStats(symbol, market);
        if (stats == null) {
            return ApiResponse.error(404, "股票统计信息不存在: " + symbol);
        }
        return ApiResponse.success(stats);
    }

    /**
     * Get stock valuation metrics.
     * <p>Retrieves PE, PB, market cap and related valuation fields for a single stock.</p>
     *
     * @param symbol stock symbol (e.g. "002326"), must not be blank
     * @return valuation metrics for the symbol
     */
    @GetMapping("/stocks/{symbol}/valuation")
    public ApiResponse<StockValuationDto> getStockValuation(
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol) {

        log.info("GET /api/v1/market/stocks/{}/valuation", symbol);

        StockValuationDto valuation = marketService.getStockValuation(symbol);
        if (valuation == null) {
            return ApiResponse.error(404, "股票估值不存在: " + symbol);
        }
        return ApiResponse.success(valuation);
    }

    /**
     * Get stock industry metadata.
     * <p>Retrieves industry, sector, sub-industry and board fields for a stock.</p>
     *
     * @param symbol stock symbol (e.g. "601012"), must not be blank
     * @return industry metadata for the symbol
     */
    @GetMapping("/stocks/{symbol}/industry")
    public ApiResponse<StockIndustryDto> getStockIndustry(
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol) {

        log.info("GET /api/v1/market/stocks/{}/industry", symbol);

        StockIndustryDto industry = marketService.getStockIndustry(symbol);
        if (industry == null) {
            return ApiResponse.error(404, "股票行业信息不存在: " + symbol);
        }
        return ApiResponse.success(industry);
    }

    /**
     * Batch get stock industry metadata.
     * <p>Returns a map keyed by symbol to reduce N+1 client requests.</p>
     *
     * @param symbols stock symbols list (up to 200 entries)
     * @return industry metadata map by symbol
     */
    @PostMapping("/stocks/industry/batch")
    public ApiResponse<Map<String, StockIndustryDto>> getStockIndustries(
            @RequestBody @NotEmpty(message = "股票代码列表不能为空")
            @Size(max = 200, message = "股票代码最多 200 个")
            List<@NotBlank(message = "股票代码不能为空") String> symbols) {
        log.info("POST /api/v1/market/stocks/industry/batch: count={}", symbols.size());

        Map<String, StockIndustryDto> result = marketService.getStockIndustries(symbols);
        return ApiResponse.success(result);
    }

    /**
     * Get stock K-line data.
     * <p>Compatibility endpoint for frontend requests under /market/stocks/{symbol}/kline.</p>
     * <p>Reads K-line data from kline_data table only.</p>
     *
     * @param symbol stock symbol
     * @param market market code, defaults to AShare
     * @param period period alias (daily/weekly/monthly) used by legacy callers
     * @param timeframe explicit timeframe (1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M)
     * @param limit max records to return
     * @param beforeTime optional timestamp cursor
     * @return k-line list
     */
    @GetMapping("/stocks/{symbol}/kline")
    public ApiResponse<List<KlineDataDto>> getStockKline(
            @PathVariable @NotBlank(message = "股票代码不能为空") String symbol,
            @RequestParam(defaultValue = "AShare") String market,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String timeframe,
            @RequestParam(defaultValue = "300") @Min(1) @Max(1000) Integer limit,
            @RequestParam(required = false) Long beforeTime) {

        String normalizedTimeframe = normalizeTimeframe(period, timeframe);
        log.info("GET /api/v1/market/stocks/{}/kline: market={}, period={}, timeframe={}, normalizedTimeframe={}, limit={}, beforeTime={}",
                symbol, market, period, timeframe, normalizedTimeframe, limit, beforeTime);

        List<KlineDataDto> data = klineService.getKlineData(market, symbol, normalizedTimeframe, limit, beforeTime);
        if (!data.isEmpty()) {
            return ApiResponse.success(data);
        }

        boolean syncTriggered = klineSyncService.requestSyncSymbolKline(market, symbol, normalizedTimeframe);
        if (!syncTriggered) {
            return ApiResponse.success(data);
        }

        List<KlineDataDto> refreshed = waitForKlineData(market, symbol, normalizedTimeframe, limit, beforeTime);
        return ApiResponse.success(refreshed);
    }
    
    /**
     * Retrieve market indices.
     * <p>Returns a list of major market indices such as SSE Composite, SZSE Component, and ChiNext.</p>
     *
     * @return list of market index quotes
     */
    @GetMapping("/indices")
    public ApiResponse<List<MarketIndexDto>> getMarketIndices() {
        log.info("GET /api/v1/market/indices");
        
        List<MarketIndexDto> indices = marketService.getMarketIndices();
        return ApiResponse.success(indices);
    }
    
    /**
     * Get hot stocks by trading volume.
     * <p>Returns the most actively traded stocks ordered by volume.</p>
     *
     * @param market market code, defaults to AShare
     * @param limit number of stocks to return (default 20, max 100)
     * @return list of hot stocks
     */
    @GetMapping("/hot")
    public ApiResponse<List<SymbolInfoDto>> getHotStocks(
            @RequestParam(defaultValue = "AShare") String market,
            @RequestParam(defaultValue = "20") 
            @Min(value = 1, message = "每页数量最小为 1") 
            @Max(value = 100, message = "每页数量最大为 100") 
            Integer limit) {
        
        log.info("GET /api/v1/market/hot?market={}&limit={}", market, limit);
        
        List<SymbolInfoDto> hotStocks = marketService.getHotStocks(market, limit);
        return ApiResponse.success(hotStocks);
    }

    /**
     * Get sector network data for correlation graph.
     * <p>Returns nodes (sectors) and links (correlations) for force-directed visualization.</p>
     *
     * @param market market code, defaults to AShare
     * @return sector network data with nodes and links
     */
    @GetMapping("/sectors/network")
    public ApiResponse<SectorNetworkDto> getSectorNetwork(
            @RequestParam(defaultValue = "AShare") String market) {
        
        log.info("GET /api/v1/market/sectors/network?market={}", market);
        
        SectorNetworkDto network = marketService.getSectorNetwork(market);
        return ApiResponse.success(network);
    }
    
    /**
     * Batch quote endpoint.
     * <p>Fetches real-time quotes for multiple stocks in a single request.</p>
     *
     * @param symbols list of stock symbols (comma-separated, up to 50 entries)
     * @return list of real-time price quotes
     */
    @GetMapping("/batch")
    public ApiResponse<List<PriceQuoteDto>> getBatchPrices(
            @RequestParam @NotEmpty(message = "股票代码列表不能为空")
            @Size(max = 50, message = "股票代码最多 50 个")
            List<String> symbols) {
        
        log.info("GET /api/v1/market/batch: count={}", symbols.size());
        
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(symbols);
        return ApiResponse.success(quotes);
    }

    /**
     * Get tick-by-tick transaction data from stock_tick_history only.
     * Note: A-share Level-1 only provides 3-5s snapshots
     * Returns empty list if no real tick data available (no fallback to kline)
     */
    @GetMapping("/ticks")
    public ApiResponse<List<TickDto>> getTickData(
            @RequestParam String market,
            @RequestParam String symbol,
            @RequestParam(defaultValue = "50") @Min(1) @Max(500) Integer limit) {
        
        log.info("GET /api/v1/market/ticks: market={}, symbol={}, limit={}", market, symbol, limit);
        syntheticTickService.trackSymbol(symbol);

        // Only fetch from stock_tick_history, no fallback to kline data
        List<TickDto> historyTicks = syntheticTickService.getLatestTicks(symbol, limit);
        return ApiResponse.success(historyTicks);
    }

    /**
     * Get tick summary statistics from stock_tick_history only.
     * Returns null if no real tick data available (no fallback to kline)
     */
    @GetMapping("/ticks/summary")
    public ApiResponse<TickSummaryDto> getTickSummary(
            @RequestParam String market,
            @RequestParam String symbol) {
        
        log.info("GET /api/v1/market/ticks/summary: market={}, symbol={}", market, symbol);
        syntheticTickService.trackSymbol(symbol);

        // Only fetch from stock_tick_history, no fallback to kline data
        List<TickDto> historyTicks = syntheticTickService.getLatestTicks(symbol, 300);
        if (historyTicks.isEmpty()) {
            return ApiResponse.success(null);
        }

        long totalVolume = historyTicks.stream().mapToLong(TickDto::size).sum();
        BigDecimal totalAmount = historyTicks.stream()
                .map(TickDto::amount)
                .map(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long buyVolume = historyTicks.stream()
                .filter(tick -> "buy".equalsIgnoreCase(tick.type()))
                .mapToLong(TickDto::size)
                .sum();
        long sellVolume = totalVolume - buyVolume;
        int blockOrderCount = (int) historyTicks.stream()
                .filter(tick -> "BLOCK_ORDER".equalsIgnoreCase(tick.flag()))
                .count();
        int totalTrades = historyTicks.size();
        double avgTradeSize = totalTrades > 0
                ? BigDecimal.valueOf(totalVolume)
                .divide(BigDecimal.valueOf(totalTrades), 4, RoundingMode.HALF_UP)
                .doubleValue()
                : 0D;

        TickDto latest = historyTicks.get(0);
        TickSummaryDto summary = new TickSummaryDto(
                symbol,
                market,
                totalTrades,
                totalVolume,
                totalAmount,
                buyVolume,
                sellVolume,
                blockOrderCount,
                avgTradeSize,
                formatTickTimestampIso(latest.epochMillis())
        );
        return ApiResponse.success(summary);
    }

    @GetMapping(value = "/ticks/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamTicks(
            @RequestParam String market,
            @RequestParam String symbol) {
        log.info("GET /api/v1/market/ticks/stream: market={}, symbol={}", market, symbol);
        syntheticTickService.trackSymbol(symbol);
        return tickStreamService.subscribe(symbol);
    }

    // Tick DTO records
    public record TickDto(
        String time,
        double price,
        int size,
        double amount,
        String type,
        String flag,
        Long epochMillis
    ) {}
    
    public record TickSummaryDto(
        String symbol,
        String market,
        int totalTrades,
        long totalVolume,
        java.math.BigDecimal totalAmount,
        long buyVolume,
        long sellVolume,
        int blockOrderCount,
        double avgTradeSize,
        String lastUpdated
    ) {}

    private TickDto mapMinuteBarToTick(KlineDataDto bar) {
        long volume = bar.volume() == null ? 0L : bar.volume();
        int size = volume > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) volume;
        double amount = bar.amount() == null ? 0D : bar.amount().doubleValue();
        BigDecimal price = bar.close() == null ? BigDecimal.ZERO : bar.close();
        String type = isBuyMinuteBar(bar) ? "buy" : "sell";
        String flag = volume >= BLOCK_ORDER_VOLUME_THRESHOLD ? "BLOCK_ORDER" : "NORMAL";

        return new TickDto(
                formatTickTime(bar.timestamp()),
                price.doubleValue(),
                size,
                amount,
                type,
                flag,
                bar.timestamp() == null ? null : bar.timestamp() * 1000
        );
    }

    private boolean isBuyMinuteBar(KlineDataDto bar) {
        if (bar.close() == null || bar.open() == null) {
            return true;
        }
        return bar.close().compareTo(bar.open()) >= 0;
    }

    private String formatTickTime(Long epochSeconds) {
        if (epochSeconds == null) {
            return "--:--:--";
        }
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(epochSeconds), MARKET_ZONE)
                .format(TICK_TIME_FORMATTER);
    }

    private String formatTickTimestampIso(Long epochMillis) {
        if (epochMillis == null) {
            return LocalDateTime.now(MARKET_ZONE).toString();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), MARKET_ZONE).toString();
    }

    private List<KlineDataDto> normalizeKlineData(List<?> rawBars) {
        if (rawBars == null || rawBars.isEmpty()) {
            return List.of();
        }
        return rawBars.stream()
                .map(this::coerceKlineDataDto)
                .filter(Objects::nonNull)
                .toList();
    }

    @SuppressWarnings("unchecked")
    private KlineDataDto coerceKlineDataDto(Object raw) {
        if (raw instanceof KlineDataDto dto) {
            return dto;
        }
        if (!(raw instanceof Map<?, ?> map)) {
            return null;
        }

        return new KlineDataDto(
                toLong(map.get("timestamp")),
                toBigDecimal(map.get("open")),
                toBigDecimal(map.get("high")),
                toBigDecimal(map.get("low")),
                toBigDecimal(map.get("close")),
                toLong(map.get("volume")),
                toBigDecimal(map.get("amount"))
        );
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number num) {
            return num.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number num) {
            return BigDecimal.valueOf(num.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<KlineDataDto> waitForKlineData(
            String market,
            String symbol,
            String timeframe,
            Integer limit,
            Long beforeTime) {
        final int maxAttempts = 8;
        final long sleepMillis = 500L;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Thread.sleep(sleepMillis);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for kline sync: market={}, symbol={}, timeframe={}",
                        market, symbol, timeframe, exception);
                break;
            }

            List<KlineDataDto> data = klineService.getKlineData(market, symbol, timeframe, limit, beforeTime);
            if (!data.isEmpty()) {
                log.info("K-line data available after async sync: market={}, symbol={}, timeframe={}, attempt={}",
                        market, symbol, timeframe, attempt);
                return data;
            }
        }

        log.info("K-line data still empty after async sync wait: market={}, symbol={}, timeframe={}",
                market, symbol, timeframe);
        return List.of();
    }

    private String normalizeTimeframe(String period, String timeframe) {
        if (timeframe != null && !timeframe.isBlank()) {
            return timeframe;
        }
        if (period == null || period.isBlank()) {
            return "1D";
        }
        return switch (period.toLowerCase()) {
            case "daily", "day", "1d" -> "1D";
            case "weekly", "week", "1w" -> "1W";
            case "monthly", "month", "1mth", "1mo", "1m" -> "1M";
            default -> period;
        };
    }
}
