package com.koduck.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.koduck.common.constants.ApiStatusCodeConstants;
import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.MarketConstants;
import com.koduck.common.constants.PaginationConstants;
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
 * <p>Provides endpoints for retrieving historical K-line (candlestick) data.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/kline")
@RequiredArgsConstructor
@Tag(name = "K线数据", description = "历史K线数据查询接口")
@Validated
@Slf4j
public class KlineController {
    private final KlineService klineService;

    /**
     * Get K-line (candlestick) historical data.
     * Supports both daily (1D, 1W, 1M) and minute-level (1m, 5m, 15m, 30m, 60m) timeframes.
     *
     * @param market the market code (e.g., "AShare")
     * @param symbol the stock symbol (e.g., "600519")
     * @param timeframe the time period for each candle (1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M)
     * @param limit maximum number of records to return
     * @param beforeTime optional timestamp to get data before this time
     * @return list of K-line data
     */
    @Operation(
        summary = "获取K线数据",
        description = "获取指定股票的历史K线数据\n\n" +
                      "支持的时间周期：\n" +
                      "- 分钟级：1m, 5m, 15m, 30m, 60m\n" +
                      "- 日级：1D, 1W, 1M"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = KlineDataDto.class))
        ),
        @ApiResponse(responseCode = "400", description = "请求参数错误"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<List<KlineDataDto>> getKline(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam @NotBlank String market,
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam @NotBlank String symbol,
            @Parameter(description = "时间周期", example = "1D", allowableValues = {"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"})
            @RequestParam(defaultValue = MarketConstants.DEFAULT_TIMEFRAME) String timeframe,
            @Parameter(description = "返回记录数，最大1000", example = "300")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_KLINE_LIMIT_STR) @Min(1) @Max(1000) Integer limit,
            @Parameter(description = "时间戳游标，获取早于该时间的数据", example = "1704067200000")
            @RequestParam(required = false) Long beforeTime) {
        log.debug("GET /api/v1/kline: market={}, symbol={}, timeframe={}, limit={}, beforeTime={}",
                 market, symbol, timeframe, limit, beforeTime);
        List<KlineDataDto> data = klineService.getKlineData(market, symbol, timeframe, limit, beforeTime);
        return ApiResponse.success(data);
    }

    /**
     * Get latest price for a symbol.
     *
     * @param market the market code
     * @param symbol the stock symbol
     * @param timeframe the time period
     * @return latest price response
     */
    @Operation(
        summary = "获取最新价格",
        description = "获取指定股票的最新收盘价"
    )
    @ApiResponses(value = {
        @ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = LatestPriceResponse.class))
        ),
        @ApiResponse(responseCode = "400", description = "请求参数错误"),
        @ApiResponse(responseCode = "404", description = "价格数据不存在"),
        @ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/price")
    public ApiResponse<LatestPriceResponse> getLatestPrice(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam @NotBlank String market,
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam @NotBlank String symbol,
            @Parameter(description = "时间周期", example = "1D", allowableValues = {"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"})
            @RequestParam(defaultValue = MarketConstants.DEFAULT_TIMEFRAME) String timeframe) {
        log.debug("GET /api/v1/kline/price: market={}, symbol={}, timeframe={}", market, symbol, timeframe);
        return klineService.getLatestPrice(market, symbol, timeframe)
            .map(price -> ApiResponse.success(new LatestPriceResponse(symbol, price)))
            .orElse(ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.NO_PRICE_DATA_FOUND));
    }

    /**
     * Response for latest price endpoint.
     *
     * @param symbol the stock symbol
     * @param price the latest price
     */
    @Schema(description = "最新价格响应")
    public record LatestPriceResponse(
        @Schema(description = "股票代码", example = "600519")
        String symbol,
        @Schema(description = "最新价格", example = "1688.88")
        BigDecimal price
    ) {}
}
