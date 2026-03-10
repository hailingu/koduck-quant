package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineMinutesService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    
    private final MarketService marketService;
    private final KlineService klineService;
    private final KlineMinutesService klineMinutesService;
    
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
     * Get stock K-line data.
     * <p>Compatibility endpoint for frontend requests under /market/stocks/{symbol}/kline.</p>
     * <p>Daily/weekly/monthly data reads from DB first and falls back to data-service when empty.</p>
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

        List<KlineDataDto> data;
        if (klineMinutesService.isMinuteTimeframe(normalizedTimeframe)) {
            data = klineMinutesService.getMinuteKline(market, symbol, normalizedTimeframe, limit, beforeTime);
            return ApiResponse.success(data);
        }

        data = klineService.getKlineData(market, symbol, normalizedTimeframe, limit, beforeTime);
        if (data.isEmpty()) {
            log.info("No DB kline data found, fallback to data-service: market={}, symbol={}, timeframe={}",
                    market, symbol, normalizedTimeframe);
            data = klineMinutesService.getMinuteKline(market, symbol, normalizedTimeframe, limit, beforeTime);
        }
        return ApiResponse.success(data);
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
