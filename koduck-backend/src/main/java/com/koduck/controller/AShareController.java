package com.koduck.controller;

import com.koduck.common.constants.ApiStatusCodeConstants;
import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.MarketConstants;
import com.koduck.common.constants.PaginationConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.service.KlineService;
import com.koduck.service.MarketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * A-Share market data controller.
 * <p>Provides search endpoints for A-share stocks. Routes requests to MarketService.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/a-share")
@RequiredArgsConstructor
@Tag(name = "A股数据", description = "A股股票搜索、K线查询等A股专用接口")
@Validated
@Slf4j
public class AShareController {
    private final MarketService marketService;
    private final KlineService klineService;

    /**
     * Search A-share stocks by keyword.
     * <p>This endpoint is used by frontend search components to find stocks by name or symbol.</p>
     *
     * @param keyword search keyword (stock name or symbol), must not be blank
     * @param page    page number (starts at 1, default 1)
     * @param size    page size (default 20, max 100)
     * @return list of matching stock symbols
     */
    @Operation(
        summary = "搜索A股",
        description = "根据关键词搜索A股股票代码和名称，支持拼音首字母搜索"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "搜索成功",
            content = @Content(schema = @Schema(implementation = SymbolInfoDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "关键词为空或长度超过50字符"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/search")
    public ApiResponse<List<SymbolInfoDto>> searchSymbols(
            @Parameter(description = "搜索关键词", example = "茅台")
            @RequestParam @NotBlank(message = "关键词不能为空")
            @Size(max = 50, message = "关键词长度不能超过 50")
            String keyword,
            @Parameter(description = "页码，从1开始", example = "1")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_ONE_STR)
            @Min(value = 1, message = "页码最小为 1")
            Integer page,
            @Parameter(description = "每页数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
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
    @Operation(
        summary = "获取A股K线数据",
        description = "获取A股股票的历史K线数据\n\n" +
                      "支持的时间周期：1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = KlineDataDto.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "股票代码为空或参数错误"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/kline")
    public ApiResponse<List<KlineDataDto>> getKline(
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam @NotBlank(message = "股票代码不能为空")
            String symbol,
            @Parameter(description = "时间周期", example = "1D", allowableValues = {"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"})
            @RequestParam(defaultValue = MarketConstants.DEFAULT_TIMEFRAME) String timeframe,
            @Parameter(description = "返回记录数，最大1000", example = "300")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_KLINE_LIMIT_STR) @Min(1) @Max(1000) Integer limit,
            @Parameter(description = "时间戳游标，获取早于该时间的数据", example = "1704067200000")
            @RequestParam(required = false) Long beforeTime) {
        log.debug("GET /api/v1/a-share/kline: symbol={}, timeframe={}, limit={}, beforeTime={}",
                symbol, timeframe, limit, beforeTime);
        List<KlineDataDto> data =
                klineService.getKlineData(MarketConstants.DEFAULT_MARKET, symbol, timeframe, limit, beforeTime);
        return ApiResponse.success(data);
    }

    /**
     * Get latest price for an A-share stock.
     *
     * @param symbol    Stock symbol
     * @param timeframe Time interval (default 1D)
     * @return Latest price response
     */
    @Operation(
        summary = "获取A股最新价格",
        description = "获取A股股票的最新收盘价"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = LatestPriceResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "股票代码为空"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "价格数据不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/kline/price")
    public ApiResponse<LatestPriceResponse> getLatestPrice(
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam @NotBlank(message = "股票代码不能为空")
            String symbol,
            @Parameter(description = "时间周期", example = "1D")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_TIMEFRAME) String timeframe) {
        log.debug("GET /api/v1/a-share/kline/price: symbol={}, timeframe={}", symbol, timeframe);
        return klineService.getLatestPrice(MarketConstants.DEFAULT_MARKET, symbol, timeframe)
                .map(price -> ApiResponse.success(new LatestPriceResponse(symbol, price)))
                .orElse(ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.NO_PRICE_DATA_FOUND));
    }

    /**
     * Response for latest price endpoint.
     *
     * @param symbol the stock symbol
     * @param price  the latest price
     */
    @Schema(description = "最新价格响应")
    public record LatestPriceResponse(
        @Schema(description = "股票代码", example = "600519")
        String symbol,
        @Schema(description = "最新价格", example = "1688.88")
        BigDecimal price
    ) {}
}
