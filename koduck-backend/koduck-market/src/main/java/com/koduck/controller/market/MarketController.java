package com.koduck.controller.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.MarketConstants;
import com.koduck.common.constants.PaginationConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.market.dto.DailyBreadthDto;
import com.koduck.market.dto.DailyNetFlowDto;
import com.koduck.market.dto.KlineDataDto;
import com.koduck.market.dto.MarketIndexDto;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.dto.StockIndustryDto;
import com.koduck.market.dto.StockStatsDto;
import com.koduck.market.dto.StockValuationDto;
import com.koduck.market.dto.SymbolInfoDto;
import com.koduck.service.KlineService;
import com.koduck.service.KlineSyncService;
import com.koduck.service.MarketBreadthService;
import com.koduck.service.MarketFlowService;
import com.koduck.service.MarketService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * REST API controller for market data.
 * <p>Provides endpoints for symbol search, stock details, market indices, and batch quotes.</p>
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/market")
@Tag(name = "市场数据", description = "股票搜索、行情报价、市场指数、资金流向等市场相关接口")
@Validated
@Slf4j
@RequiredArgsConstructor
public class MarketController {

    /**
     * Service for market data operations.
     */
    private final MarketService marketService;

    /**
     * Service for market flow operations.
     */
    private final MarketFlowService marketFlowService;

    /**
     * Service for market breadth operations.
     */
    private final MarketBreadthService marketBreadthService;

    /**
     * Service for kline data operations.
     */
    private final KlineService klineService;

    /**
     * Service for kline sync operations.
     */
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
    @Operation(
        summary = "搜索股票",
        description = "根据关键词搜索股票代码和名称，支持拼音首字母搜索\n\n" +
                      "示例：搜索\"茅台\"可找到\"贵州茅台(600519)\""
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "搜索成功",
        content = @Content(schema = @Schema(implementation = SymbolInfoDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "关键词为空或长度超过50字符"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
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
    @Operation(
        summary = "获取股票详情",
        description = "获取单只股票的实时行情报价"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = PriceQuoteDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码为空"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "股票不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/stocks/{symbol}")
    public ApiResponse<PriceQuoteDto> getStockDetail(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol) {
        log.info("GET /api/v1/market/stocks/{}", symbol);
        PriceQuoteDto quote = marketService.getStockDetail(symbol);
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
    @Operation(
        summary = "获取股票日统计",
        description = "获取单只股票的日交易统计数据，包括开盘价、最高价、最低价、成交量等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = StockStatsDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码为空"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "股票统计信息不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/stocks/{symbol}/stats")
    public ApiResponse<StockStatsDto> getStockStats(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol,
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market) {
        log.info("GET /api/v1/market/stocks/{}/stats?market={}", symbol, market);
        StockStatsDto stats = marketService.getStockStats(symbol, market);
        return ApiResponse.success(stats);
    }

    /**
     * Get stock valuation metrics.
     * <p>Retrieves PE, PB, market cap and related valuation fields for a single stock.</p>
     *
     * @param symbol stock symbol (e.g. "002326"), must not be blank
     * @return valuation metrics for the symbol
     */
    @Operation(
        summary = "获取股票估值信息",
        description = "获取单只股票的估值指标，包括市盈率(PE)、市净率(PB)、市值等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = StockValuationDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码为空"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "股票估值信息不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/stocks/{symbol}/valuation")
    public ApiResponse<StockValuationDto> getStockValuation(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol) {
        log.info("GET /api/v1/market/stocks/{}/valuation", symbol);
        StockValuationDto valuation = marketService.getStockValuation(symbol);
        return ApiResponse.success(valuation);
    }

    /**
     * Get stock industry metadata.
     * <p>Retrieves industry, sector, sub-industry and board fields for a stock.</p>
     *
     * @param symbol stock symbol (e.g. "601012"), must not be blank
     * @return industry metadata for the symbol
     */
    @Operation(
        summary = "获取股票行业信息",
        description = "获取单只股票的行业分类信息，包括所属行业、板块、概念等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = StockIndustryDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码为空"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "股票行业信息不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/stocks/{symbol}/industry")
    public ApiResponse<StockIndustryDto> getStockIndustry(
            @Parameter(description = "股票代码", example = "601012")
            @PathVariable @NotBlank(message = "股票代码不能为空")
            String symbol) {
        log.info("GET /api/v1/market/stocks/{}/industry", symbol);
        StockIndustryDto industry = marketService.getStockIndustry(symbol);
        return ApiResponse.success(industry);
    }

    /**
     * Batch get stock industry metadata.
     * <p>Returns a map keyed by symbol to reduce N+1 client requests.</p>
     *
     * @param symbols stock symbols list (up to 200 entries)
     * @return industry metadata map by symbol
     */
    @Operation(
        summary = "批量获取股票行业信息",
        description = "批量获取多只股票的行业分类信息，最多支持200只股票"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = StockIndustryDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码列表为空或超过200个"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @PostMapping("/stocks/industry/batch")
    public ApiResponse<Map<String, StockIndustryDto>> getStockIndustries(
            @Parameter(description = "股票代码列表", example = "[\"600519\", \"000001\", \"300750\"]")
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
    @Operation(
        summary = "获取股票K线数据",
        description = "获取单只股票的历史K线数据\n\n" +
                      "支持的时间周期：1m, 5m, 15m, 30m, 60m, 1D, 1W, 1M"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = KlineDataDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "202",
        description = "已触发异步同步，K线数据准备中",
        content = @Content(schema = @Schema(implementation = KlineDataDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "股票代码为空或参数错误"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/stocks/{symbol}/kline")
    public ResponseEntity<ApiResponse<List<KlineDataDto>>> getStockKline(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable @NotBlank(message = "股票代码不能为空") String symbol,
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "周期别名（兼容参数）", example = "daily")
            @RequestParam(required = false) String period,
            @Parameter(description = "时间周期", example = "1D",
                schema = @Schema(allowableValues = {"1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"}))
            @RequestParam(required = false) String timeframe,
            @Parameter(description = "返回记录数", example = "300")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_KLINE_LIMIT_STR)
            @Min(1) @Max(1000) Integer limit,
            @Parameter(description = "时间戳游标，获取早于该时间的数据", example = "1704067200000")
            @RequestParam(required = false) Long beforeTime) {
        String normalizedTimeframe = klineService.normalizeTimeframe(period, timeframe);
        log.info("GET /api/v1/market/stocks/{}/kline: market={}, period={}, timeframe={}, "
                + "normalizedTimeframe={}, limit={}, beforeTime={}",
                symbol, market, period, timeframe, normalizedTimeframe, limit, beforeTime);
        List<KlineDataDto> data = klineService.getKlineData(market, symbol, normalizedTimeframe,
            limit, beforeTime);
        if (!data.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(data));
        }
        boolean syncTriggered = klineSyncService.requestSyncSymbolKline(market, symbol,
            normalizedTimeframe);
        if (!syncTriggered) {
            return ResponseEntity.ok(ApiResponse.success(data));
        }
        log.info("K-line data sync accepted asynchronously: market={}, symbol={}, timeframe={}",
                market, symbol, normalizedTimeframe);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(ApiMessageConstants.KLINE_SYNC_ACCEPTED, List.of()));
    }

    /**
     * Retrieve market indices.
     * <p>Returns a list of major market indices such as SSE Composite, SZSE Component, and ChiNext.</p>
     *
     * @return list of market index quotes
     */
    @Operation(
        summary = "获取市场指数",
        description = "获取主要市场指数行情，包括上证指数、深证成指、创业板指等"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = MarketIndexDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/indices")
    public ApiResponse<List<MarketIndexDto>> getMarketIndices() {
        log.info("GET /api/v1/market/indices");
        List<MarketIndexDto> indices = marketService.getMarketIndices();
        return ApiResponse.success(indices);
    }

    /**
     * Get daily market net flow.
     * If tradeDate is omitted, returns latest available trading-day data.
     *
     * @param market market code
     * @param flowType flow type
     * @param tradeDate trade date
     * @return daily net flow data
     */
    @Operation(
        summary = "获取每日资金流向",
        description = "获取市场每日资金流向数据，不指定日期则返回最新交易日数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = DailyNetFlowDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "资金流向数据不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/net-flow/daily")
    public ApiResponse<DailyNetFlowDto> getDailyNetFlow(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "资金流向类型", example = "main")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_FLOW_TYPE) String flowType,
            @Parameter(description = "交易日期，格式yyyy-MM-dd", example = "2024-01-15")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/net-flow/daily: market={}, flowType={}, tradeDate={}",
                market, flowType, tradeDate);
        DailyNetFlowDto result = tradeDate == null
                ? marketFlowService.getLatestDailyNetFlow(market, flowType)
                : marketFlowService.getDailyNetFlow(market, flowType, tradeDate);
        return ApiResponse.success(result);
    }

    /**
     * Get daily market net flow history.
     *
     * @param market market code
     * @param flowType flow type
     * @param from start date
     * @param to end date
     * @return list of daily net flow data
     */
    @Operation(
        summary = "获取每日资金流向历史",
        description = "获取指定日期范围内的市场资金流向历史数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = DailyNetFlowDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "日期范围无效"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/net-flow/daily/history")
    public ApiResponse<List<DailyNetFlowDto>> getDailyNetFlowHistory(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "资金流向类型", example = "main")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_FLOW_TYPE) String flowType,
            @Parameter(description = "开始日期", example = "2024-01-01")
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @Parameter(description = "结束日期", example = "2024-01-31")
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {
        log.info("GET /api/v1/market/net-flow/daily/history: market={}, flowType={}, from={}, to={}",
                market, flowType, from, to);
        List<DailyNetFlowDto> result = marketFlowService.getDailyNetFlowHistory(market, flowType,
            from, to);
        return ApiResponse.success(result);
    }

    /**
     * Get daily market breadth (gainers/losers/unchanged counts).
     * If tradeDate is omitted, returns latest available trading-day data.
     *
     * @param market market code
     * @param breadthType breadth type
     * @param tradeDate trade date
     * @return daily breadth data
     */
    @Operation(
        summary = "获取每日市场宽度",
        description = "获取市场每日涨跌统计（上涨家数、下跌家数、平盘家数），不指定日期则返回最新交易日数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = DailyBreadthDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "404",
        description = "市场宽度数据不存在"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/breadth/daily")
    public ApiResponse<DailyBreadthDto> getDailyBreadth(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "统计类型", example = "all")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_BREADTH_TYPE) String breadthType,
            @Parameter(description = "交易日期，格式yyyy-MM-dd", example = "2024-01-15")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/breadth/daily: market={}, breadthType={}, tradeDate={}",
                market, breadthType, tradeDate);
        DailyBreadthDto result = tradeDate == null
                ? marketBreadthService.getLatestDailyBreadth(market, breadthType)
                : marketBreadthService.getDailyBreadth(market, breadthType, tradeDate);
        return ApiResponse.success(result);
    }

    /**
     * Get daily market breadth history.
     *
     * @param market market code
     * @param breadthType breadth type
     * @param from start date
     * @param to end date
     * @return list of daily breadth data
     */
    @Operation(
        summary = "获取每日市场宽度历史",
        description = "获取指定日期范围内的市场宽度历史数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "200",
        description = "获取成功",
        content = @Content(schema = @Schema(implementation = DailyBreadthDto.class))
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "400",
        description = "日期范围无效"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
        responseCode = "500",
        description = "服务器内部错误"
    )
    @GetMapping("/breadth/daily/history")
    public ApiResponse<List<DailyBreadthDto>> getDailyBreadthHistory(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "统计类型", example = "all")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_BREADTH_TYPE) String breadthType,
            @Parameter(description = "开始日期", example = "2024-01-01")
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @Parameter(description = "结束日期", example = "2024-01-31")
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {
        log.info("GET /api/v1/market/breadth/daily/history: market={}, breadthType={}, from={}, to={}",
                market, breadthType, from, to);
        List<DailyBreadthDto> result = marketBreadthService.getDailyBreadthHistory(market,
            breadthType, from, to);
        return ApiResponse.success(result);
    }

}
