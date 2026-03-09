package com.koduck.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineMinutesService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketService;

import java.math.BigDecimal;
import java.util.List;

/**
 * A-Share market data controller.
 * <p>Provides search endpoints for A-share stocks. Routes requests to MarketService.</p>
 */
@RestController
@RequestMapping("/api/v1/a-share")
@RequiredArgsConstructor
@Tag(name = "A股数据", description = "A股股票搜索接口")
@Validated
@Slf4j
public class AShareController {

    private final MarketService marketService;
    private final KlineService klineService;
    private final KlineMinutesService klineMinutesService;

    /**
     * Search A-share stocks by keyword.
     * <p>This endpoint is used by frontend search components to find stocks by name or symbol.</p>
     *
     * @param keyword search keyword (stock name or symbol), must not be blank
     * @param page    page number (starts at 1, default 1)
     * @param size    page size (default 20, max 100)
     * @return list of matching stock symbols
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

        log.info("GET /api/v1/a-share/search: keyword={}, page={}, size={}", keyword, page, size);

        List<SymbolInfoDto> results = marketService.searchSymbols(keyword, page, size);
        return ApiResponse.success(results);
    }

    /**
     * Get K-line (candlestick) historical data for A-share stocks.
     * <p>Supports both daily (1D, 1W, 1M) and minute-level (1m, 5m, 15m, 30m, 60m) timeframes.</p>
     *
     * @param symbol     Stock symbol (e.g., "002326")
     * @param timeframe  Time interval (1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M)
     * @param limit      Maximum number of records (default 300, max 1000)
     * @param beforeTime Get data before this timestamp (optional)
     * @return List of K-line data
     */
    @GetMapping("/kline")
    public ApiResponse<List<KlineDataDto>> getKline(
            @RequestParam @NotBlank(message = "股票代码不能为空")
            String symbol,
            @RequestParam(defaultValue = "1D") String timeframe,
            @RequestParam(defaultValue = "300") @Min(1) @Max(1000) Integer limit,
            @RequestParam(required = false) Long beforeTime) {

        log.debug("GET /api/v1/a-share/kline: symbol={}, timeframe={}, limit={}, beforeTime={}",
                symbol, timeframe, limit, beforeTime);

        // Route to appropriate service based on timeframe
        List<KlineDataDto> data;
        if (klineMinutesService.isMinuteTimeframe(timeframe)) {
            data = klineMinutesService.getMinuteKline("AShare", symbol, timeframe, limit, beforeTime);
        } else {
            data = klineService.getKlineData("AShare", symbol, timeframe, limit, beforeTime);
        }
        
        return ApiResponse.success(data);
    }

    /**
     * Get latest price for an A-share stock.
     *
     * @param symbol    Stock symbol
     * @param timeframe Time interval (default 1D)
     * @return Latest price response
     */
    @GetMapping("/kline/price")
    public ApiResponse<LatestPriceResponse> getLatestPrice(
            @RequestParam @NotBlank(message = "股票代码不能为空")
            String symbol,
            @RequestParam(defaultValue = "1D") String timeframe) {

        log.debug("GET /api/v1/a-share/kline/price: symbol={}, timeframe={}", symbol, timeframe);

        return klineService.getLatestPrice("AShare", symbol, timeframe)
                .map(price -> ApiResponse.success(new LatestPriceResponse(symbol, price)))
                .orElse(ApiResponse.error(404, "No price data found"));
    }

    /**
     * Response for latest price endpoint.
     */
    public record LatestPriceResponse(String symbol, BigDecimal price) {}
}
