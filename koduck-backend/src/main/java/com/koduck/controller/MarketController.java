package com.koduck.controller;

import com.koduck.common.constants.ApiStatusCodeConstants;
import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.MarketConstants;
import com.koduck.common.constants.PaginationConstants;
import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.BigOrderAlertDto;
import com.koduck.dto.market.BigOrderStatsDto;
import com.koduck.dto.market.CapitalRiverBreadthBandsDto;
import com.koduck.dto.market.CapitalRiverBubbleDto;
import com.koduck.dto.market.CapitalRiverDto;
import com.koduck.dto.market.CapitalRiverTrackItemDto;
import com.koduck.dto.market.CapitalRiverTracksDto;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.SectorNetFlowDto;
import com.koduck.dto.market.SectorNetFlowItemDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.dto.market.TickDto;
import com.koduck.service.KlineSyncService;
import com.koduck.service.KlineService;
import com.koduck.service.MarketBreadthService;
import com.koduck.service.MarketFlowService;
import com.koduck.service.MarketService;
import com.koduck.service.MarketSectorNetFlowService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String FEAR_GREED_INDEX_PATH =
        System.getProperty("koduck.market.path.fearGreedIndex", "/market/fear-greed-index");
    private static final String BREADTH_PATH =
        System.getProperty("koduck.market.path.breadth", "/market/breadth");
    private static final String BIG_ORDERS_PATH =
        System.getProperty("koduck.market.path.bigOrders", "/market/big-orders");
    private static final String BIG_ORDERS_STATS_PATH =
        System.getProperty("koduck.market.path.bigOrdersStats", "/market/big-orders/stats");
    private static final ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>
        DATA_SERVICE_MAP_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };
    private static final ParameterizedTypeReference<DataServiceResponse<List<BigOrderAlertDto>>>
        BIG_ORDER_LIST_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };
    private static final ParameterizedTypeReference<DataServiceResponse<BigOrderStatsDto>>
        BIG_ORDER_STATS_RESPONSE_TYPE = new ParameterizedTypeReference<>() {
        };

    private final MarketService marketService;
    private final MarketFlowService marketFlowService;
    private final MarketBreadthService marketBreadthService;
    private final MarketSectorNetFlowService marketSectorNetFlowService;
    private final KlineService klineService;
    private final KlineSyncService klineSyncService;
    private final TickStreamService tickStreamService;
    private final SyntheticTickService syntheticTickService;
    private final DataServiceProperties dataServiceProperties;

    @Qualifier("dataServiceRestTemplate")
    private final RestTemplate dataServiceRestTemplate;

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
    /**
     * Get fear-greed index (proxy from data-service dashboard router).
     */
    @GetMapping("/fear-greed-index")
    public ApiResponse<Map<String, Object>> getFearGreedIndex() {
        log.info("GET /api/v1/market/fear-greed-index");
        if (!dataServiceProperties.isEnabled()) {
            return ApiResponse.error(ApiStatusCodeConstants.SERVICE_UNAVAILABLE, ApiMessageConstants.DATA_SERVICE_DISABLED);
        }
        try {
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response = dataServiceRestTemplate.exchange(
                    dataServiceProperties.getBaseUrl() + FEAR_GREED_INDEX_PATH,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    Objects.requireNonNull(DATA_SERVICE_MAP_RESPONSE_TYPE));
            DataServiceResponse<Map<String, Object>> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY, ApiMessageConstants.FEAR_GREED_FETCH_FAILED);
            }
            return ApiResponse.success(body.data());
        } catch (RestClientException e) {
            log.warn("fear_greed_proxy_failed: {}", e.getMessage());
            return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY, ApiMessageConstants.FEAR_GREED_FETCH_FAILED);
        }
    }
    /**
     * Get sector net-flow snapshot from local DB.
     */
    @GetMapping("/sector-net-flow")
    public ApiResponse<SectorNetFlowDto> getSectorNetFlow(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_INDICATOR) String indicator,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR) @Min(1) @Max(100) Integer limit,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/sector-net-flow: market={}, indicator={}, limit={}, tradeDate={}",
                market, indicator, limit, tradeDate);
        SectorNetFlowDto result = tradeDate == null
                ? marketSectorNetFlowService.getLatest(market, indicator, limit)
                : marketSectorNetFlowService.getByTradeDate(market, indicator, tradeDate, limit);
        if (result == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.SECTOR_NET_FLOW_NOT_FOUND);
        }
        return ApiResponse.success(result);
    }
    /**
     * Get capital-river payload (DB-backed).
     * <p>Uses sector-net-flow snapshot and keeps inflow/outflow as null
     * because separated real inflow/outflow values are not available yet.</p>
     */
    @GetMapping("/capital-river")
    public ApiResponse<CapitalRiverDto> getCapitalRiver(
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = MarketConstants.DEFAULT_INDICATOR) String indicator,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_BUBBLE_COUNT_STR) @Min(1) @Max(10) Integer bubbleCount,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR) @Min(1) @Max(100) Integer listLimit,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate tradeDate) {
        log.info("GET /api/v1/market/capital-river: market={}, indicator={}, bubbleCount={}, listLimit={}, tradeDate={}",
                market, indicator, bubbleCount, listLimit, tradeDate);
        SectorNetFlowDto snapshot = tradeDate == null
                ? marketSectorNetFlowService.getLatest(market, indicator, listLimit)
                : marketSectorNetFlowService.getByTradeDate(market, indicator, tradeDate, listLimit);
        if (snapshot == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND, ApiMessageConstants.CAPITAL_RIVER_NOT_FOUND);
        }
        List<CapitalRiverTrackItemDto> industry = toTrackItems(snapshot.industry());
        List<CapitalRiverTrackItemDto> concept = toTrackItems(snapshot.concept());
        List<CapitalRiverTrackItemDto> region = toTrackItems(snapshot.region());
        List<CapitalRiverBubbleDto> bubbles = allTrackItems(industry, concept, region).stream()
                .sorted(Comparator.comparing(this::absMainForceNet).reversed())
                .limit(Math.max(1, bubbleCount))
                .map(item -> new CapitalRiverBubbleDto(
                        item.sectorName(),
                        item.sectorType(),
                        item.mainForceNet(),
                        item.changePct()
                ))
                .toList();
        CapitalRiverDto payload = new CapitalRiverDto(
                snapshot.market(),
                snapshot.indicator(),
                snapshot.tradeDate(),
                null,
                null,
                bubbles,
                new CapitalRiverTracksDto(industry, concept, region),
                new CapitalRiverBreadthBandsDto(
                        "Max Gainers (+10%)",
                        "Sector Breadth Distribution",
                        "Max Losers (-10%)",
                        List.of(100, 90, 82, 72, 60, 50, 40, 34, 28, 22, 16)
                ),
                snapshot.source(),
                snapshot.quality()
        );
        return ApiResponse.success(payload);
    }
    /**
     * Get market breadth (proxy from data-service dashboard router).
     */
    @GetMapping("/breadth")
    public ApiResponse<Map<String, Object>> getMarketBreadth() {
        log.info("GET /api/v1/market/breadth");
        if (!dataServiceProperties.isEnabled()) {
            return ApiResponse.error(ApiStatusCodeConstants.SERVICE_UNAVAILABLE, ApiMessageConstants.DATA_SERVICE_DISABLED);
        }
        try {
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response = dataServiceRestTemplate.exchange(
                    dataServiceProperties.getBaseUrl() + BREADTH_PATH,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    Objects.requireNonNull(DATA_SERVICE_MAP_RESPONSE_TYPE));
            DataServiceResponse<Map<String, Object>> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY, ApiMessageConstants.BREADTH_FETCH_FAILED);
            }
            return ApiResponse.success(body.data());
        } catch (RestClientException e) {
            log.warn("breadth_proxy_failed: {}", e.getMessage());
            return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY, ApiMessageConstants.BREADTH_FETCH_FAILED);
        }
    }
    /**
     * Get big-order alerts (proxy from data-service).
     */
    @GetMapping("/big-orders")
    public ApiResponse<List<BigOrderAlertDto>> getBigOrders(
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR) @Min(1) @Max(50) Integer limit,
            @RequestParam(name = "order_type", required = false) String orderType,
            @RequestParam(name = "min_amount", defaultValue = "500000") @Min(0) Double minAmount) {
        log.info("GET /api/v1/market/big-orders: limit={}, orderType={}, minAmount={}", limit, orderType, minAmount);
        if (!dataServiceProperties.isEnabled()) {
            log.warn("big_orders_proxy_skipped reason=data_service_disabled");
            return ApiResponse.success(List.of());
        }
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(dataServiceProperties.getBaseUrl() + BIG_ORDERS_PATH)
                    .queryParam("limit", limit)
                    .queryParam("min_amount", minAmount);
            if (orderType != null && !orderType.isBlank()) {
                builder.queryParam("order_type", orderType);
            }
            ResponseEntity<DataServiceResponse<List<BigOrderAlertDto>>> response = dataServiceRestTemplate.exchange(
                    builder.toUriString(),
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    Objects.requireNonNull(BIG_ORDER_LIST_RESPONSE_TYPE));
            DataServiceResponse<List<BigOrderAlertDto>> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                log.warn("big_orders_proxy_empty code={} message={}",
                        body == null ? null : body.code(),
                        body == null ? null : body.message());
                return ApiResponse.success(List.of());
            }
            return ApiResponse.success(body.data());
        } catch (RestClientException e) {
            log.warn("big_orders_proxy_failed: {}", e.getMessage());
            return ApiResponse.success(List.of());
        }
    }
    /**
     * Get big-order statistics (proxy from data-service).
     */
    @GetMapping("/big-orders/stats")
    public ApiResponse<BigOrderStatsDto> getBigOrderStats() {
        log.info("GET /api/v1/market/big-orders/stats");
        if (!dataServiceProperties.isEnabled()) {
            log.warn("big_order_stats_proxy_skipped reason=data_service_disabled");
            return ApiResponse.success(BigOrderStatsDto.empty());
        }
        try {
            ResponseEntity<DataServiceResponse<BigOrderStatsDto>> response = dataServiceRestTemplate.exchange(
                    dataServiceProperties.getBaseUrl() + BIG_ORDERS_STATS_PATH,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    Objects.requireNonNull(BIG_ORDER_STATS_RESPONSE_TYPE));
            DataServiceResponse<BigOrderStatsDto> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                log.warn("big_order_stats_proxy_empty code={} message={}",
                        body == null ? null : body.code(),
                        body == null ? null : body.message());
                return ApiResponse.success(BigOrderStatsDto.empty());
            }
            return ApiResponse.success(body.data());
        } catch (RestClientException e) {
            log.warn("big_order_stats_proxy_failed: {}", e.getMessage());
            return ApiResponse.success(BigOrderStatsDto.empty());
        }
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
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR) 
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
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market) {
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
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_TICK_LIMIT_STR) @Min(1) @Max(500) Integer limit) {
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
            .mapToDouble(TickDto::amount)
            .mapToObj(BigDecimal::valueOf)
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

    /**
     * Tick summary payload aggregated from recent ticks.
     */
    public record TickSummaryDto(
        String symbol,
        String market,
        int totalTrades,
        long totalVolume,
        BigDecimal totalAmount,
        long buyVolume,
        long sellVolume,
        int blockOrderCount,
        double avgTradeSize,
        String lastUpdated
    ) {}
    private String formatTickTimestampIso(Long epochMillis) {
        if (epochMillis == null) {
            return LocalDateTime.now(MARKET_ZONE).toString();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), MARKET_ZONE).toString();
    }
    private List<CapitalRiverTrackItemDto> toTrackItems(List<SectorNetFlowItemDto> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.stream()
                .map(item -> new CapitalRiverTrackItemDto(
                        item.sectorName(),
                        item.sectorType(),
                        item.mainForceNet(),
                        item.changePct()
                ))
                .toList();
    }
    private List<CapitalRiverTrackItemDto> allTrackItems(
            List<CapitalRiverTrackItemDto> industry,
            List<CapitalRiverTrackItemDto> concept,
            List<CapitalRiverTrackItemDto> region
    ) {
        List<CapitalRiverTrackItemDto> all = new ArrayList<>();
        all.addAll(industry);
        all.addAll(concept);
        all.addAll(region);
        return all;
    }
    private BigDecimal absMainForceNet(CapitalRiverTrackItemDto item) {
        BigDecimal net = item.mainForceNet();
        return net == null ? BigDecimal.ZERO : net.abs();
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
