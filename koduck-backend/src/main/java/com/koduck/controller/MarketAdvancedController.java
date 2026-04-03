package com.koduck.controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.util.UriComponentsBuilder;

import com.koduck.common.constants.ApiMessageConstants;
import com.koduck.common.constants.ApiStatusCodeConstants;
import com.koduck.common.constants.DateTimePatternConstants;
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
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetFlowDto;
import com.koduck.dto.market.SectorNetFlowItemDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.dto.market.TickDto;
import com.koduck.service.MarketSectorNetFlowService;
import com.koduck.service.MarketService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Advanced market endpoints split from {@link MarketController}
 * to keep controller classes focused.
 *
 * @author Koduck Team
 */
@RestController
@RequestMapping("/api/v1/market")
@Tag(name = "市场数据-高级", description = "市场高级数据接口，包括资金流向、大单追踪等")
@Validated
@Slf4j
@RequiredArgsConstructor
public class MarketAdvancedController {

    /** Market timezone (Asia/Shanghai). */
    private static final ZoneId MARKET_ZONE = DateTimePatternConstants.MARKET_ZONE_ID;

    /** Fear greed index API path. */
    private static final String FEAR_GREED_INDEX_PATH = System.getProperty(
            "koduck.market.path.fearGreedIndex", "/market/fear-greed-index");

    /** Market breadth API path. */
    private static final String BREADTH_PATH = System.getProperty(
            "koduck.market.path.breadth", "/market/breadth");

    /** Big orders API path. */
    private static final String BIG_ORDERS_PATH = System.getProperty(
            "koduck.market.path.bigOrders", "/market/big-orders");

    /** Big orders stats API path. */
    private static final String BIG_ORDERS_STATS_PATH = System.getProperty(
            "koduck.market.path.bigOrdersStats", "/market/big-orders/stats");

    /** Response type for map data. */
    private static final ParameterizedTypeReference<
            DataServiceResponse<Map<String, Object>>> DATA_SERVICE_MAP_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    /** Response type for big order list. */
    private static final ParameterizedTypeReference<
            DataServiceResponse<List<BigOrderAlertDto>>> BIG_ORDER_LIST_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    /** Response type for big order stats. */
    private static final ParameterizedTypeReference<
            DataServiceResponse<BigOrderStatsDto>> BIG_ORDER_STATS_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };

    /** Breadth bands values for capital river visualization. */
    private static final List<Integer> BREADTH_BANDS = List.of(
            100, 90, 82, 72, 60, 50, 40, 34, 28, 22, 16);

    /** Tick history limit for summary calculation. */
    private static final int TICK_HISTORY_LIMIT = 300;

    /** Decimal scale for average calculation. */
    private static final int AVG_CALC_SCALE = 4;

    /** Market data service. */
    private final MarketService marketService;

    /** Sector net flow service. */
    private final MarketSectorNetFlowService marketSectorNetFlowService;

    /** Synthetic tick service. */
    private final SyntheticTickService syntheticTickService;

    /** Tick stream service. */
    private final TickStreamService tickStreamService;

    /** Data service properties. */
    private final DataServiceProperties dataServiceProperties;

    /** Data service REST template. */
    @Qualifier("dataServiceRestTemplate")
    private final RestTemplate dataServiceRestTemplate;

    /**
     * Get fear and greed index.
     *
     * @return fear and greed index data
     */
    @Operation(summary = "获取恐惧贪婪指数",
            description = "获取市场恐惧贪婪指数")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "503", description = "数据服务不可用"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/fear-greed-index")
    public ApiResponse<Map<String, Object>> getFearGreedIndex() {
        log.info("GET /api/v1/market/fear-greed-index");
        if (!dataServiceProperties.isEnabled()) {
            return ApiResponse.error(ApiStatusCodeConstants.SERVICE_UNAVAILABLE,
                    ApiMessageConstants.DATA_SERVICE_DISABLED);
        }
        try {
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    dataServiceRestTemplate.exchange(
                            dataServiceProperties.getBaseUrl() + FEAR_GREED_INDEX_PATH,
                            Objects.requireNonNull(HttpMethod.GET),
                            null,
                            Objects.requireNonNull(DATA_SERVICE_MAP_RESPONSE_TYPE));
            DataServiceResponse<Map<String, Object>> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY,
                        ApiMessageConstants.FEAR_GREED_FETCH_FAILED);
            }
            return ApiResponse.success(body.data());
        }
        catch (RestClientException e) {
            log.warn("fear_greed_proxy_failed: {}", e.getMessage());
            return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY,
                    ApiMessageConstants.FEAR_GREED_FETCH_FAILED);
        }
    }

    /**
     * Get sector net flow data.
     *
     * @param market    market code
     * @param indicator indicator type
     * @param limit     number of results to return
     * @param tradeDate trade date
     * @return sector net flow data
     */
    @Operation(summary = "获取板块资金流向",
            description = "获取各板块的资金净流入/流出数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200", description = "获取成功",
                content = @Content(schema = @Schema(
                        implementation = SectorNetFlowDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404", description = "数据不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/sector-net-flow")
    public ApiResponse<SectorNetFlowDto> getSectorNetFlow(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "指标类型", example = "main")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_INDICATOR) String indicator,
            @Parameter(description = "返回数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR)
            @Min(1) @Max(100) Integer limit,
            @Parameter(description = "交易日期", example = "2024-01-15")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tradeDate) {
        log.info("GET /api/v1/market/sector-net-flow: "
                + "market={}, indicator={}, limit={}, tradeDate={}",
                market, indicator, limit, tradeDate);
        SectorNetFlowDto result = tradeDate == null
                ? marketSectorNetFlowService.getLatest(market, indicator, limit)
                : marketSectorNetFlowService.getByTradeDate(
                        market, indicator, tradeDate, limit);
        if (result == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.SECTOR_NET_FLOW_NOT_FOUND);
        }
        return ApiResponse.success(result);
    }

    /**
     * Get capital river visualization data.
     *
     * @param market      market code
     * @param indicator   indicator type
     * @param bubbleCount number of bubbles
     * @param listLimit   list limit
     * @param tradeDate   trade date
     * @return capital river data
     */
    @Operation(summary = "获取资金流向图",
            description = "获取资金流向可视化数据（资本河流图）")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200", description = "获取成功",
                content = @Content(schema = @Schema(
                        implementation = CapitalRiverDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404", description = "数据不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/capital-river")
    public ApiResponse<CapitalRiverDto> getCapitalRiver(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "指标类型", example = "main")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_INDICATOR) String indicator,
            @Parameter(description = "气泡数量", example = "5")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_BUBBLE_COUNT_STR)
            @Min(1) @Max(10) Integer bubbleCount,
            @Parameter(description = "列表数量限制", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR)
            @Min(1) @Max(100) Integer listLimit,
            @Parameter(description = "交易日期", example = "2024-01-15")
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate tradeDate) {
        log.info("GET /api/v1/market/capital-river: market={}, indicator={}, "
                + "bubbleCount={}, listLimit={}, tradeDate={}",
                market, indicator, bubbleCount, listLimit, tradeDate);
        SectorNetFlowDto snapshot = tradeDate == null
                ? marketSectorNetFlowService.getLatest(market, indicator, listLimit)
                : marketSectorNetFlowService.getByTradeDate(
                        market, indicator, tradeDate, listLimit);
        if (snapshot == null) {
            return ApiResponse.error(ApiStatusCodeConstants.NOT_FOUND,
                    ApiMessageConstants.CAPITAL_RIVER_NOT_FOUND);
        }
        List<CapitalRiverTrackItemDto> industry = toTrackItems(snapshot.industry());
        List<CapitalRiverTrackItemDto> concept = toTrackItems(snapshot.concept());
        List<CapitalRiverTrackItemDto> region = toTrackItems(snapshot.region());
        List<CapitalRiverBubbleDto> bubbles = allTrackItems(
                industry, concept, region).stream()
                .sorted(Comparator.comparing(this::absMainForceNet).reversed())
                .limit(Math.max(1, bubbleCount))
                .map(item -> new CapitalRiverBubbleDto(
                        item.sectorName(), item.sectorType(),
                        item.mainForceNet(), item.changePct()))
                .toList();
        CapitalRiverDto payload = new CapitalRiverDto(
                snapshot.market(), snapshot.indicator(), snapshot.tradeDate(),
                null, null, bubbles,
                new CapitalRiverTracksDto(industry, concept, region),
                new CapitalRiverBreadthBandsDto(
                        "Max Gainers (+10%)", "Sector Breadth Distribution",
                        "Max Losers (-10%)",
                        BREADTH_BANDS),
                snapshot.source(), snapshot.quality());
        return ApiResponse.success(payload);
    }

    /**
     * Get market breadth data.
     *
     * @return market breadth data
     */
    @Operation(summary = "获取市场宽度", description = "获取市场宽度数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "503", description = "数据服务不可用"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/breadth")
    public ApiResponse<Map<String, Object>> getMarketBreadth() {
        log.info("GET /api/v1/market/breadth");
        if (!dataServiceProperties.isEnabled()) {
            return ApiResponse.error(ApiStatusCodeConstants.SERVICE_UNAVAILABLE,
                    ApiMessageConstants.DATA_SERVICE_DISABLED);
        }
        try {
            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                    dataServiceRestTemplate.exchange(
                            dataServiceProperties.getBaseUrl() + BREADTH_PATH,
                            Objects.requireNonNull(HttpMethod.GET),
                            null,
                            Objects.requireNonNull(DATA_SERVICE_MAP_RESPONSE_TYPE));
            DataServiceResponse<Map<String, Object>> body = response.getBody();
            if (body == null || !body.isSuccess() || body.data() == null) {
                return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY,
                        ApiMessageConstants.BREADTH_FETCH_FAILED);
            }
            return ApiResponse.success(body.data());
        }
        catch (RestClientException e) {
            log.warn("breadth_proxy_failed: {}", e.getMessage());
            return ApiResponse.error(ApiStatusCodeConstants.BAD_GATEWAY,
                    ApiMessageConstants.BREADTH_FETCH_FAILED);
        }
    }

    /**
     * Get big order alerts.
     *
     * @param limit     number of results to return
     * @param orderType order type filter
     * @param minAmount minimum amount threshold
     * @return list of big order alerts
     */
    @Operation(summary = "获取大单追踪", description = "获取大额交易订单追踪数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = BigOrderAlertDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/big-orders")
    public ApiResponse<List<BigOrderAlertDto>> getBigOrders(
            @Parameter(description = "返回数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_LIST_LIMIT_STR)
            @Min(1) @Max(50) Integer limit,
            @Parameter(description = "订单类型", example = "buy")
            @RequestParam(name = "order_type", required = false) String orderType,
            @Parameter(description = "最小金额", example = "500000")
            @RequestParam(name = "min_amount", defaultValue = "500000")
            @Min(0) Double minAmount) {
        log.info("GET /api/v1/market/big-orders: "
                + "limit={}, orderType={}, minAmount={}",
                limit, orderType, minAmount);
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
            ResponseEntity<DataServiceResponse<List<BigOrderAlertDto>>> response =
                    dataServiceRestTemplate.exchange(
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
        }
        catch (RestClientException e) {
            log.warn("big_orders_proxy_failed: {}", e.getMessage());
            return ApiResponse.success(List.of());
        }
    }

    /**
     * Get big order statistics.
     *
     * @return big order statistics
     */
    @Operation(summary = "获取大单统计", description = "获取大额交易订单统计数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = BigOrderStatsDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/big-orders/stats")
    public ApiResponse<BigOrderStatsDto> getBigOrderStats() {
        log.info("GET /api/v1/market/big-orders/stats");
        if (!dataServiceProperties.isEnabled()) {
            log.warn("big_order_stats_proxy_skipped reason=data_service_disabled");
            return ApiResponse.success(BigOrderStatsDto.empty());
        }
        try {
            ResponseEntity<DataServiceResponse<BigOrderStatsDto>> response =
                    dataServiceRestTemplate.exchange(
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
        }
        catch (RestClientException e) {
            log.warn("big_order_stats_proxy_failed: {}", e.getMessage());
            return ApiResponse.success(BigOrderStatsDto.empty());
        }
    }

    /**
     * Get hot stocks.
     *
     * @param market market code
     * @param limit  number of results to return
     * @return list of hot stocks
     */
    @Operation(summary = "获取热门股票", description = "获取市场热门股票列表")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = SymbolInfoDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/hot")
    public ApiResponse<List<SymbolInfoDto>> getHotStocks(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market,
            @Parameter(description = "返回数量", example = "20")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_PAGE_SIZE_STR)
            @Min(value = 1, message = "每页数量最小为 1")
            @Max(value = 100, message = "每页数量最大为 100") Integer limit) {
        log.info("GET /api/v1/market/hot?market={}&limit={}", market, limit);
        List<SymbolInfoDto> hotStocks = marketService.getHotStocks(market, limit);
        return ApiResponse.success(hotStocks);
    }

    /**
     * Get sector network data.
     *
     * @param market market code
     * @return sector network data
     */
    @Operation(summary = "获取板块关联网络",
            description = "获取板块之间的关联关系网络数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = SectorNetworkDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/sectors/network")
    public ApiResponse<SectorNetworkDto> getSectorNetwork(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET) String market) {
        log.info("GET /api/v1/market/sectors/network?market={}", market);
        SectorNetworkDto network = marketService.getSectorNetwork(market);
        return ApiResponse.success(network);
    }

    /**
     * Get batch prices for multiple symbols.
     *
     * @param symbols list of stock symbols
     * @return list of price quotes
     */
    @Operation(summary = "批量获取股价", description = "批量获取多只股票的价格数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = PriceQuoteDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400",
                    description = "股票代码列表为空或超过50个"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/batch")
    public ApiResponse<List<PriceQuoteDto>> getBatchPrices(
            @Parameter(description = "股票代码列表", example = "[\"600519\", \"000001\"]")
            @RequestParam @NotEmpty(message = "股票代码列表不能为空")
            @jakarta.validation.constraints.Size(max = 50, message = "股票代码最多 50 个")
            List<String> symbols) {
        log.info("GET /api/v1/market/batch: count={}", symbols.size());
        List<PriceQuoteDto> quotes = marketService.getBatchPrices(symbols);
        return ApiResponse.success(quotes);
    }

    /**
     * Get tick data for a symbol.
     *
     * @param market  market code
     * @param symbol  stock symbol
     * @param limit   number of ticks to return
     * @return list of tick data
     */
    @Operation(summary = "获取分笔数据", description = "获取股票的分笔成交数据")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = TickDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/ticks")
    public ApiResponse<List<TickDto>> getTickData(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam String market,
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam String symbol,
            @Parameter(description = "返回数量", example = "100")
            @RequestParam(defaultValue = PaginationConstants.DEFAULT_TICK_LIMIT_STR)
            @Min(1) @Max(500) Integer limit) {
        log.info("GET /api/v1/market/ticks: market={}, symbol={}, limit={}",
                market, symbol, limit);
        syntheticTickService.trackSymbol(symbol);
        List<TickDto> historyTicks = syntheticTickService.getLatestTicks(
                symbol, limit);
        return ApiResponse.success(historyTicks);
    }

    /**
     * Get tick summary for a symbol.
     *
     * @param market  market code
     * @param symbol  stock symbol
     * @return tick summary data
     */
    @Operation(summary = "获取分笔统计", description = "获取股票分笔成交的统计信息")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "获取成功",
                    content = @Content(schema = @Schema(
                            implementation = TickSummaryDto.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/ticks/summary")
    public ApiResponse<TickSummaryDto> getTickSummary(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam String market,
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam String symbol) {
        log.info("GET /api/v1/market/ticks/summary: market={}, symbol={}",
                market, symbol);
        syntheticTickService.trackSymbol(symbol);
        List<TickDto> historyTicks = syntheticTickService.getLatestTicks(
                symbol, TICK_HISTORY_LIMIT);
        if (historyTicks.isEmpty()) {
            return ApiResponse.success(null);
        }
        long totalVolume = historyTicks.stream()
                .mapToLong(TickDto::size).sum();
        BigDecimal totalAmount = historyTicks.stream()
                .mapToDouble(TickDto::amount)
                .mapToObj(BigDecimal::valueOf)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long buyVolume = historyTicks.stream()
                .filter(tick -> "buy".equalsIgnoreCase(tick.type()))
                .mapToLong(TickDto::size).sum();
        long sellVolume = totalVolume - buyVolume;
        int blockOrderCount = (int) historyTicks.stream()
                .filter(tick -> "BLOCK_ORDER".equalsIgnoreCase(tick.flag()))
                .count();
        int totalTrades = historyTicks.size();
        double avgTradeSize = totalTrades > 0
                ? BigDecimal.valueOf(totalVolume)
                        .divide(BigDecimal.valueOf(totalTrades), AVG_CALC_SCALE,
                                RoundingMode.HALF_UP).doubleValue()
                : 0D;
        TickDto latest = historyTicks.get(0);
        TickSummaryDto summary = new TickSummaryDto(
                symbol, market, totalTrades, totalVolume, totalAmount,
                buyVolume, sellVolume, blockOrderCount, avgTradeSize,
                formatTickTimestampIso(latest.epochMillis()));
        return ApiResponse.success(summary);
    }

    /**
     * Subscribe to tick data stream.
     *
     * @param market  market code
     * @param symbol  stock symbol
     * @return SSE emitter for tick stream
     */
    @Operation(summary = "订阅分笔数据流",
            description = "通过SSE协议订阅实时分笔数据流")
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "流式响应开始")
    })
    @GetMapping(value = "/ticks/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamTicks(
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam String market,
            @Parameter(description = "股票代码", example = "600519")
            @RequestParam String symbol) {
        log.info("GET /api/v1/market/ticks/stream: market={}, symbol={}",
                market, symbol);
        syntheticTickService.trackSymbol(symbol);
        return tickStreamService.subscribe(symbol);
    }

    /**
     * Tick summary DTO record.
     *
     * @param symbol          stock symbol
     * @param market          market code
     * @param totalTrades     total number of trades
     * @param totalVolume     total volume
     * @param totalAmount     total amount
     * @param buyVolume       buy volume
     * @param sellVolume      sell volume
     * @param blockOrderCount block order count
     * @param avgTradeSize    average trade size
     * @param lastUpdated     last updated time
     */
    @Schema(description = "分笔数据统计")
    public record TickSummaryDto(
            @Schema(description = "股票代码", example = "600519") String symbol,
            @Schema(description = "市场代码", example = "AShare") String market,
            @Schema(description = "总成交笔数", example = "1000") int totalTrades,
            @Schema(description = "总成交量", example = "1000000") long totalVolume,
            @Schema(description = "总成交金额", example = "16888888.88")
            BigDecimal totalAmount,
            @Schema(description = "买入量", example = "600000") long buyVolume,
            @Schema(description = "卖出量", example = "400000") long sellVolume,
            @Schema(description = "大单数量", example = "50") int blockOrderCount,
            @Schema(description = "平均成交手数", example = "1000.50")
            double avgTradeSize,
            @Schema(description = "最后更新时间", example = "2024-01-15T09:30:00")
            String lastUpdated) {
    }

    private String formatTickTimestampIso(Long epochMillis) {
        if (epochMillis == null) {
            return LocalDateTime.now(MARKET_ZONE).toString();
        }
        return LocalDateTime.ofInstant(
                Instant.ofEpochMilli(epochMillis), MARKET_ZONE).toString();
    }

    private List<CapitalRiverTrackItemDto> toTrackItems(
            List<SectorNetFlowItemDto> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.stream()
                .map(item -> new CapitalRiverTrackItemDto(
                        item.sectorName(), item.sectorType(),
                        item.mainForceNet(), item.changePct()))
                .toList();
    }

    private List<CapitalRiverTrackItemDto> allTrackItems(
            List<CapitalRiverTrackItemDto> industry,
            List<CapitalRiverTrackItemDto> concept,
            List<CapitalRiverTrackItemDto> region) {
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
}
