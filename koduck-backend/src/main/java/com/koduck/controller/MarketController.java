package com.koduck.controller;

import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.ApiStatusCodeConstants;
import com.koduck.common.constants.MarketConstants;
import com.koduck.common.constants.PaginationConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineSyncService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketBreadthService;
import com.koduck.service.MarketFlowService;
import com.koduck.service.MarketService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API controller for market data.
 * <p>Provides endpoints for symbol search, stock details, market indices, and batch quotes.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/market")
@Tag(name = "市场数据", description = "市场配置、股票代码搜索、市场指数等市场相关接口")
@Validated
@Slf4j
@RequiredArgsConstructor
public class MarketController {
    private final MarketService marketService;
    private final MarketFlowService marketFlowService;
    private final MarketBreadthService marketBreadthService;
    private final KlineService klineService;
    private final KlineSyncService klineSyncService;

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
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ONE_STR) 
            @Min(value = 1, message = "页码最小为 1") 
            Integer page,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR) 
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
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.STOCK_NOT_FOUND_PREFIX + symbol);
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
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market) {
        log.info("GET /api/v1/market/stocks/{}/stats?market={}", symbol, market);
        StockStatsDto stats = marketService.getStockStats(symbol, market);
        if (stats == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.STOCK_STATS_NOT_FOUND_PREFIX + symbol);
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
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.STOCK_VALUATION_NOT_FOUND_PREFIX + symbol);
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
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.STOCK_INDUSTRY_NOT_FOUND_PREFIX + symbol);
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
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String timeframe,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_KLINE_LIMIT_STR) @Min(1) @Max(1000) Integer limit,
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
     * Get daily market net flow.
     * If tradeDate is omitted, returns latest available trading-day data.
     */
    @GetMapping("/net-flow/daily")
    public ApiResponse<DailyNetFlowDto> getDailyNetFlow(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_FLOW_TYPE) String flowType,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/net-flow/daily: market={}, flowType={}, tradeDate={}",
                market, flowType, tradeDate);
        DailyNetFlowDto result = tradeDate == null
                ? marketFlowService.getLatestDailyNetFlow(market, flowType)
                : marketFlowService.getDailyNetFlow(market, flowType, tradeDate);
        if (result == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.MARKET_NET_FLOW_NOT_FOUND);
        }
        return ApiResponse.success(result);
    }
    /**
     * Get daily market net flow history.
     */
    @GetMapping("/net-flow/daily/history")
    public ApiResponse<List<DailyNetFlowDto>> getDailyNetFlowHistory(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_FLOW_TYPE) String flowType,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {
        log.info("GET /api/v1/market/net-flow/daily/history: market={}, flowType={}, from={}, to={}",
                market, flowType, from, to);
        if (to.isBefore(from)) {
            return ApiResponse.error(ApiStatusCodeConstants.BAD_REQUEST, ApiMessageConstants.INVALID_DATE_RANGE);
        }
        List<DailyNetFlowDto> result = marketFlowService.getDailyNetFlowHistory(market, flowType, from, to);
        return ApiResponse.success(result);
    }
    /**
     * Get daily market breadth (gainers/losers/unchanged counts).
     * If tradeDate is omitted, returns latest available trading-day data.
     */
    @GetMapping("/breadth/daily")
    public ApiResponse<DailyBreadthDto> getDailyBreadth(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_BREADTH_TYPE) String breadthType,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/breadth/daily: market={}, breadthType={}, tradeDate={}",
                market, breadthType, tradeDate);
        DailyBreadthDto result = tradeDate == null
                ? marketBreadthService.getLatestDailyBreadth(market, breadthType)
                : marketBreadthService.getDailyBreadth(market, breadthType, tradeDate);
        if (result == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.MARKET_BREADTH_NOT_FOUND);
        }
        return ApiResponse.success(result);
    }
    /**
     * Get daily market breadth history.
     */
    @GetMapping("/breadth/daily/history")
    public ApiResponse<List<DailyBreadthDto>> getDailyBreadthHistory(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_BREADTH_TYPE) String breadthType,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {
        log.info("GET /api/v1/market/breadth/daily/history: market={}, breadthType={}, from={}, to={}",
                market, breadthType, from, to);
        if (to.isBefore(from)) {
            return ApiResponse.error(ApiStatusCodeConstants.BAD_REQUEST, ApiMessageConstants.INVALID_DATE_RANGE);
        }
        List<DailyBreadthDto> result = marketBreadthService.getDailyBreadthHistory(market, breadthType, from, to);
        return ApiResponse.success(result);
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
            return MarketConstants.DEFAULT_TIMEFRAME;
        }
        return switch (period.toLowerCase(Locale.ROOT)) {
            case "daily", "day", "1d" -> MarketConstants.DEFAULT_TIMEFRAME;
            case "weekly", "week", "1w" -> MarketConstants.WEEKLY_TIMEFRAME;
            case "monthly", "month", "1mth", "1mo", "1m" -> MarketConstants.MONTHLY_TIMEFRAME;
            default -> period;
        };
    }
}
