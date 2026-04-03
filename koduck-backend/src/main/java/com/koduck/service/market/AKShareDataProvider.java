package com.koduck.service.market;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.dto.market.DataServiceResponse;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.exception.ExternalServiceException;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.service.market.support.AKShareDataMapperSupport;

/**
 * AKShare A股数据提供者实现。
 * 从 Python 数据服务获取市场数据。
 * 实现新的 MarketDataProvider 接口。
 *
 * @author Koduck Team
 */
@Component
public class AKShareDataProvider implements MarketDataProvider {

    /** The logger. */
    private static final Logger LOG = LoggerFactory.getLogger(AKShareDataProvider.class);
    /** Data service disabled message. */
    private static final String DATA_SERVICE_DISABLED_MESSAGE = "Data service is disabled";
    /** A-share base path. */
    private static final String A_SHARE_BASE_PATH = "/a-share";
    /** Key symbol. */
    private static final String KEY_SYMBOL = "symbol";
    /** Key limit. */
    private static final String KEY_LIMIT = "limit";
    /** Response type message. */
    private static final String RESPONSE_TYPE_MESSAGE = "responseType must not be null";
    /** HTTP GET message. */
    private static final String HTTP_GET_MESSAGE = "HTTP GET must not be null";
    /** HTTP POST message. */
    private static final String HTTP_POST_MESSAGE = "HTTP POST must not be null";
    /** Provider name. */
    private static final String PROVIDER_NAME = "akshare-a-share";
    /** Health score when disabled. */
    private static final int HEALTH_SCORE_DISABLED = 0;
    /** Full health score. */
    private static final int HEALTH_SCORE_FULL = 100;
    /** Morning open hour. */
    private static final int OPEN_MORNING_HOUR = 9;
    /** Morning open minute. */
    private static final int OPEN_MORNING_MINUTE = 30;
    /** Morning close hour. */
    private static final int CLOSE_MORNING_HOUR = 11;
    /** Morning close minute. */
    private static final int CLOSE_MORNING_MINUTE = 30;
    /** Afternoon open hour. */
    private static final int OPEN_AFTERNOON_HOUR = 13;
    /** Afternoon close hour. */
    private static final int CLOSE_AFTERNOON_HOUR = 15;
    /** Minutes per hour. */
    private static final int MINUTES_PER_HOUR = 60;
    /** Asia/Shanghai timezone. */
    private static final String TIMEZONE_ASIA_SHANGHAI = "Asia/Shanghai";

    /** List data response type. */
    private static final ParameterizedTypeReference<
        DataServiceResponse<List<Map<String, Object>>>>
        LIST_DATA_RESPONSE_TYPE =
        new ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>() {
        };
    /** Map data response type. */
    private static final ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>
        MAP_DATA_RESPONSE_TYPE =
        new ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>() {
        };

    /** The REST template. */
    private final RestTemplate restTemplate;
    /** The data service properties. */
    private final DataServiceProperties properties;
    /** Subscribed symbols set. */
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    /** Provider availability flag. */
    private volatile boolean available = true;
    /** Provider health score. */
    private volatile int healthScore = HEALTH_SCORE_FULL;

    /**
     * 构造函数。
     *
     * @param restTemplate REST模板
     * @param properties 配置属性
     */
    public AKShareDataProvider(
        @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate,
        DataServiceProperties properties) {
        this.restTemplate = Objects.requireNonNull(restTemplate,
            "restTemplate must not be null");
        this.properties = Objects.requireNonNull(properties,
            "properties must not be null");
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public MarketType getMarketType() {
        return MarketType.A_SHARE;
    }

    @Override
    public boolean isAvailable() {
        return available && properties.isEnabled();
    }

    @Override
    public int getHealthScore() {
        if (!properties.isEnabled()) {
            return HEALTH_SCORE_DISABLED;
        }
        return healthScore;
    }

    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
        Instant startTime, Instant endTime) throws MarketDataException {

        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }

        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/kline")
                .queryParam(KEY_SYMBOL, symbol)
                .queryParam("timeframe", timeframe)
                .queryParam(KEY_LIMIT, limit);

            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }

            String url = builder.toUriString();

            LOG.debug("Getting kline data: symbol={}, timeframe={}, limit={}",
                symbol, timeframe, limit);

            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getListDataResponseType());

            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            return AKShareDataMapperSupport.parseKlineResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            throw new MarketDataException("Failed to get kline data", e);
        }
    }

    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        PriceQuoteDto priceQuote = getPrice(symbol);
        if (priceQuote == null) {
            return Optional.empty();
        }

        TickData tickData = TickData.builder()
            .symbol(priceQuote.symbol())
            .market(MarketType.A_SHARE.getCode())
            .timestamp(priceQuote.timestamp() != null ? priceQuote.timestamp() : Instant.now())
            .price(priceQuote.price())
            .change(priceQuote.change())
            .changePercent(priceQuote.changePercent())
            .volume(priceQuote.volume())
            .amount(priceQuote.amount())
            .bidPrice(priceQuote.bidPrice())
            .bidVolume(priceQuote.bidVolume())
            .askPrice(priceQuote.askPrice())
            .askVolume(priceQuote.askVolume())
            .open(priceQuote.open())
            .dayHigh(priceQuote.high())
            .dayLow(priceQuote.low())
            .prevClose(priceQuote.prevClose())
            .build();

        return Optional.of(tickData);
    }

    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback)
        throws MarketDataException {

        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }

        subscribedSymbols.addAll(symbols);
        LOG.info("Subscribed to {} symbols for real-time data", symbols.size());

        // 生产环境中应建立 WebSocket 连接到数据服务
        // 目前仅跟踪订阅
    }

    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        subscribedSymbols.removeAll(symbols);
        LOG.info("Unsubscribed from {} symbols", symbols.size());
    }

    @Override
    public MarketStatus getMarketStatus() {
        // A股交易时间：9:30-11:30, 13:00-15:00（北京时间）
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(
            java.time.ZoneId.of(TIMEZONE_ASIA_SHANGHAI));
        int hour = now.getHour();
        int minute = now.getMinute();
        java.time.DayOfWeek dayOfWeek = now.getDayOfWeek();

        // 周末
        if (dayOfWeek == java.time.DayOfWeek.SATURDAY
            || dayOfWeek == java.time.DayOfWeek.SUNDAY) {
            return MarketStatus.CLOSED;
        }

        int timeInMinutes = hour * MINUTES_PER_HOUR + minute;
        int openMorning = OPEN_MORNING_HOUR * MINUTES_PER_HOUR + OPEN_MORNING_MINUTE;
        int closeMorning = CLOSE_MORNING_HOUR * MINUTES_PER_HOUR + CLOSE_MORNING_MINUTE;
        int openAfternoon = OPEN_AFTERNOON_HOUR * MINUTES_PER_HOUR;
        int closeAfternoon = CLOSE_AFTERNOON_HOUR * MINUTES_PER_HOUR;

        if (timeInMinutes >= openMorning && timeInMinutes <= closeMorning) {
            return MarketStatus.OPEN;
        }
        else if (timeInMinutes > closeMorning && timeInMinutes < openAfternoon) {
            return MarketStatus.BREAK;
        }
        else if (timeInMinutes >= openAfternoon && timeInMinutes <= closeAfternoon) {
            return MarketStatus.OPEN;
        }
        else {
            return MarketStatus.CLOSED;
        }
    }

    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            LOG.warn(DATA_SERVICE_DISABLED_MESSAGE);
            return Collections.emptyList();
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/search")
                .queryParam("keyword", keyword)
                .queryParam(KEY_LIMIT, limit)
                .toUriString();

            LOG.debug("Searching symbols: keyword={}, limit={}", keyword, limit);

            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getListDataResponseType());

            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            return AKShareDataMapperSupport.parseSymbolInfoResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            LOG.error("Failed to search symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    // 向后兼容的旧方法

    /**
     * 获取价格。
     *
     * @param symbol 股票代码
     * @return 价格报价
     */
    public PriceQuoteDto getPrice(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService",
                "Data service is not available");
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH
                    + "/price/{symbol}")
                .buildAndExpand(symbol)
                .toUriString();

            LOG.debug("Getting price for symbol: {}", symbol);

            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getMapDataResponseType());

            DataServiceResponse<Map<String, Object>> body = response.getBody();
            return AKShareDataMapperSupport.parsePriceQuoteResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                "Failed to get price for " + symbol, e);
        }
    }

    /**
     * 批量获取价格。
     *
     * @param symbols 股票代码列表
     * @return 价格报价列表
     */
    public List<PriceQuoteDto> getBatchPrices(List<String> symbols) {
        if (!isAvailable()) {
            LOG.warn(DATA_SERVICE_DISABLED_MESSAGE);
            return Collections.emptyList();
        }

        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            String url = properties.getBaseUrl() + A_SHARE_BASE_PATH + "/price/batch";

            Map<String, List<String>> request = Map.of("symbols", symbols);

            LOG.debug("Getting batch prices for {} symbols", symbols.size());

            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                restTemplate.exchange(url, getHttpPost(),
                    new org.springframework.http.HttpEntity<>(
                        Objects.requireNonNull(request, "request must not be null")),
                    getListDataResponseType());

            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            if (body == null || body.data() == null) {
                return Collections.emptyList();
            }

            return body.data().stream()
                .map(AKShareDataMapperSupport::mapToPriceQuoteDto)
                .toList();

        }
        catch (RestClientException e) {
            LOG.error("Failed to get batch prices: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 获取热门股票。
     *
     * @param limit 限制数量
     * @return 股票信息列表
     */
    public List<SymbolInfoDto> getHotSymbols(int limit) {
        if (!isAvailable()) {
            LOG.warn(DATA_SERVICE_DISABLED_MESSAGE);
            return Collections.emptyList();
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH + "/hot")
                .queryParam(KEY_LIMIT, limit)
                .toUriString();

            LOG.debug("Getting hot symbols with limit={}", limit);

            ResponseEntity<DataServiceResponse<List<Map<String, Object>>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getListDataResponseType());

            DataServiceResponse<List<Map<String, Object>>> body = response.getBody();
            return AKShareDataMapperSupport.parseSymbolListResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            LOG.error("Failed to get hot symbols: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * 获取股票估值。
     *
     * @param symbol 股票代码
     * @return 股票估值
     */
    public StockValuationDto getStockValuation(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService",
                "Data service is not available");
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + A_SHARE_BASE_PATH
                    + "/valuation/{symbol}")
                .buildAndExpand(symbol)
                .toUriString();

            LOG.debug("Getting valuation for symbol: {}", symbol);

            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getMapDataResponseType());

            DataServiceResponse<Map<String, Object>> body = response.getBody();
            return AKShareDataMapperSupport.parseStockValuationResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                "Failed to get valuation for " + symbol, e);
        }
    }

    /**
     * 获取股票行业信息。
     *
     * @param symbol 股票代码
     * @return 行业信息
     */
    public StockIndustryDto getStockIndustry(String symbol) {
        if (!isAvailable()) {
            throw new ExternalServiceException("DataService",
                "Data service is not available");
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + "/market/stocks/{symbol}/industry")
                .buildAndExpand(symbol)
                .toUriString();

            LOG.debug("Getting industry for symbol: {}", symbol);

            ResponseEntity<DataServiceResponse<Map<String, Object>>> response =
                restTemplate.exchange(url, getHttpGet(), null, getMapDataResponseType());

            DataServiceResponse<Map<String, Object>> body = response.getBody();
            return AKShareDataMapperSupport.parseStockIndustryResponse(
                body == null ? null : body.data());

        }
        catch (RestClientException e) {
            throw new ExternalServiceException("DataService",
                "Failed to get industry for " + symbol, e);
        }
    }


    @NonNull
    private static HttpMethod getHttpGet() {
        return Objects.requireNonNull(HttpMethod.GET, HTTP_GET_MESSAGE);
    }


    @NonNull
    private static HttpMethod getHttpPost() {
        return Objects.requireNonNull(HttpMethod.POST, HTTP_POST_MESSAGE);
    }


    @NonNull
    private static ParameterizedTypeReference<DataServiceResponse<List<Map<String, Object>>>>
        getListDataResponseType() {
        return Objects.requireNonNull(LIST_DATA_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }


    @NonNull
    private static ParameterizedTypeReference<DataServiceResponse<Map<String, Object>>>
        getMapDataResponseType() {
        return Objects.requireNonNull(MAP_DATA_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }
}
