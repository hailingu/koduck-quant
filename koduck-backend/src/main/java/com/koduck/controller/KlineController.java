package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.service.KlineService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * K-line data REST API controller.
 */
@RestController
@RequestMapping("/api/v1/kline")
@RequiredArgsConstructor
@Validated
@Slf4j
public class KlineController {
    
    private final KlineService klineService;
    
    /**
     * Get K-line (candlestick) historical data.
     */
    @GetMapping
    public ApiResponse<List<KlineDataDto>> getKline(
            @RequestParam @NotBlank String market,
            @RequestParam @NotBlank String symbol,
            @RequestParam(defaultValue = "1D") String timeframe,
            @RequestParam(defaultValue = "300") @Min(1) @Max(1000) Integer limit,
            @RequestParam(required = false) Long beforeTime) {
        
        log.debug("GET /api/v1/kline: market={}, symbol={}, timeframe={}, limit={}, beforeTime={}",
                 market, symbol, timeframe, limit, beforeTime);
        
        List<KlineDataDto> data = klineService.getKlineData(market, symbol, timeframe, limit, beforeTime);
        return ApiResponse.success(data);
    }
    
    /**
     * Get latest price for a symbol.
     */
    @GetMapping("/price")
    public ApiResponse<LatestPriceResponse> getLatestPrice(
            @RequestParam @NotBlank String market,
            @RequestParam @NotBlank String symbol,
            @RequestParam(defaultValue = "1D") String timeframe) {
        
        log.debug("GET /api/v1/kline/price: market={}, symbol={}, timeframe={}", market, symbol, timeframe);
        
        return klineService.getLatestPrice(market, symbol, timeframe)
            .map(price -> ApiResponse.success(new LatestPriceResponse(symbol, price)))
            .orElse(ApiResponse.error(404, "No price data found"));
    }
    
    /**
     * Response for latest price endpoint.
     */
    public record LatestPriceResponse(String symbol, BigDecimal price) {}
}
