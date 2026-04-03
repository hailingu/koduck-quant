package com.koduck.service.market;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.koduck.config.properties.FinnhubProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.service.market.support.USStockMockDataProvider;

import lombok.Getter;
import lombok.Setter;

/**
 * 使用 Finnhub API 的美股数据提供者。
 * 支持盘前和盘后交易。
 *
 * <p>免费版限制：60 次/分钟</p>
 *
 * <p>交易时间（东部时间）：
 * - 盘前：04:00 - 09:30
 * - 常规：09:30 - 16:00
 * - 盘后：16:00 - 20:00</p>
 *
 * @see <a href="https://finnhub.io/docs/api">Finnhub API Docs</a>
 * @author Koduck Team
 */
@Component
public class USStockProvider implements MarketDataProvider {

    /** Logger. */
    private static final Logger LOG = LoggerFactory.getLogger(USStockProvider.class);
    /** US Eastern time zone. */
    private static final ZoneId US_EASTERN = ZoneId.of("America/New_York");
    /** Provider name. */
    private static final String PROVIDER_NAME = "finnhub-us-stock";
    /** Query param: token. */
    private static final String QUERY_PARAM_TOKEN = "token";
    /** Thirty days in seconds. */
    private static final long THIRTY_DAYS_SECONDS = 86_400L * 30L;
    /** Health score: full. */
    private static final int HEALTH_SCORE_FULL = 100;
    /** Health score: half. */
    private static final int HEALTH_SCORE_HALF = 50;
    /** Pre-market start hour. */
    private static final int PRE_MARKET_START_HOUR = 4;
    /** Pre-market end hour. */
    private static final int PRE_MARKET_END_HOUR = 9;
    /** Pre-market end minute. */
    private static final int PRE_MARKET_END_MINUTE = 30;
    /** Regular start hour. */
    private static final int REGULAR_START_HOUR = 9;
    /** Regular start minute. */
    private static final int REGULAR_START_MINUTE = 30;
    /** Regular end hour. */
    private static final int REGULAR_END_HOUR = 16;
    /** Post-market end hour. */
    private static final int POST_MARKET_END_HOUR = 20;
    /** January. */
    private static final int JANUARY = 1;
    /** July. */
    private static final int JULY = 7;
    /** December. */
    private static final int DECEMBER = 12;
    /** New Year's Day. */
    private static final int NEW_YEAR_DAY = 1;
    /** Alternative New Year's Day. */
    private static final int NEW_YEAR_DAY_ALT = 2;
    /** Independence Day. */
    private static final int INDEPENDENCE_DAY = 4;
    /** Independence Day Eve. */
    private static final int INDEPENDENCE_DAY_EVE = 3;
    /** Day after Independence Day. */
    private static final int INDEPENDENCE_DAY_AFTER = 5;
    /** Christmas Day. */
    private static final int CHRISTMAS_DAY = 25;
    /** Christmas Eve. */
    private static final int CHRISTMAS_EVE = 24;
    /** Day after Christmas. */
    private static final int CHRISTMAS_AFTER = 26;
    /** Timeframe: 1 minute. */
    private static final String TIMEFRAME_1M = "1m";
    /** Timeframe: 5 minutes. */
    private static final String TIMEFRAME_5M = "5m";
    /** Timeframe: 15 minutes. */
    private static final String TIMEFRAME_15M = "15m";
    /** Timeframe: 30 minutes. */
    private static final String TIMEFRAME_30M = "30m";
    /** Timeframe: 1 hour. */
    private static final String TIMEFRAME_1H = "1h";
    /** Timeframe: 60 minutes. */
    private static final String TIMEFRAME_60M = "60m";
    /** Timeframe: 1 day. */
    private static final String TIMEFRAME_1D = "1d";
    /** Timeframe: daily. */
    private static final String TIMEFRAME_DAILY = "daily";
    /** Timeframe: 1 week. */
    private static final String TIMEFRAME_1W = "1w";
    /** Timeframe: weekly. */
    private static final String TIMEFRAME_WEEKLY = "weekly";
    /** Timeframe: 1 month. */
    private static final String TIMEFRAME_1MTH = "1mth";
    /** Timeframe: monthly. */
    private static final String TIMEFRAME_MONTHLY = "monthly";
    /** Resolution: 1. */
    private static final String RESOLUTION_1 = "1";
    /** Resolution: 5. */
    private static final String RESOLUTION_5 = "5";
    /** Resolution: 15. */
    private static final String RESOLUTION_15 = "15";
    /** Resolution: 30. */
    private static final String RESOLUTION_30 = "30";
    /** Resolution: 60. */
    private static final String RESOLUTION_60 = "60";
    /** Resolution: D. */
    private static final String RESOLUTION_D = "D";
    /** Resolution: W. */
    private static final String RESOLUTION_W = "W";
    /** Resolution: M. */
    private static final String RESOLUTION_M = "M";
    /** Response status: ok. */
    private static final String RESPONSE_STATUS_OK = "ok";
    /** Stock type: Common Stock. */
    private static final String STOCK_TYPE_COMMON = "Common Stock";
    /** Default exchange. */
    private static final String DEFAULT_EXCHANGE = "NASDAQ";
    /** Symbol type: stock. */
    private static final String SYMBOL_TYPE_STOCK = "stock";

    /** Finnhub properties. */
    private final FinnhubProperties properties;
    /** REST template. */
    private final RestTemplate restTemplate;
    /** Subscribed symbols. */
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();

    // 当 API 不可用时回退到模拟数据
    /** Mock data provider. */
    private final USStockMockDataProvider mockProvider = new USStockMockDataProvider();

    /**
     * 构造函数。
     *
     * @param properties 配置属性
     * @param restTemplate REST模板
     */
    public USStockProvider(FinnhubProperties properties,
        @Qualifier("finnhubRestTemplate") RestTemplate restTemplate) {
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.restTemplate = Objects.requireNonNull(restTemplate,
            "restTemplate must not be null");
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public MarketType getMarketType() {
        return MarketType.US_STOCK;
    }

    @Override
    public boolean isAvailable() {
        return properties.isReady() || mockProvider.isAvailable();
    }

    @Override
    public int getHealthScore() {
        if (properties.isReady()) {
            return HEALTH_SCORE_FULL;
        }
        else if (properties.isEnabled()) {
            return HEALTH_SCORE_HALF;
        }
        else {
            return mockProvider.getHealthScore();
        }
    }

    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
        Instant startTime, Instant endTime) throws MarketDataException {

        if (!properties.isReady()) {
            LOG.debug("Finnhub not configured, using mock data for kline");
            return mockProvider.getKlineData(symbol, timeframe, limit, startTime, endTime);
        }

        try {
            String resolution = mapTimeframe(timeframe);

            long from = startTime != null ? startTime.getEpochSecond()
                : Instant.now().minusSeconds(THIRTY_DAYS_SECONDS).getEpochSecond();
            long to = endTime != null ? endTime.getEpochSecond() : Instant.now().getEpochSecond();

            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + "/stock/candle")
                .queryParam("symbol", symbol.toUpperCase(Locale.ROOT))
                .queryParam("resolution", resolution)
                .queryParam("from", from)
                .queryParam("to", to)
                .queryParam(QUERY_PARAM_TOKEN, properties.getApiKey())
                .toUriString();

            LOG.debug("Fetching kline from Finnhub: symbol={}, resolution={}",
                symbol, resolution);

            ResponseEntity<CandleResponse> response = restTemplate.exchange(url,
                java.util.Objects.requireNonNull(HttpMethod.GET), null,
                CandleResponse.class);

            CandleResponse body = response.getBody();
            if (body == null || body.getS() == null
                || !body.getS().equals(RESPONSE_STATUS_OK)) {
                throw new MarketDataException("Invalid response from Finnhub: "
                    + (body != null ? body.getS() : "null"));
            }

            return convertToKlineData(body, symbol.toUpperCase(Locale.ROOT), timeframe, limit);

        }
        catch (RestClientException e) {
            LOG.error("Failed to fetch kline from Finnhub: {}", e.getMessage());
            // 回退到模拟数据
            return mockProvider.getKlineData(symbol, timeframe, limit, startTime, endTime);
        }
    }

    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!properties.isReady()) {
            LOG.debug("Finnhub not configured, using mock data for tick");
            return mockProvider.getRealTimeTick(symbol);
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + "/quote")
                .queryParam("symbol", symbol.toUpperCase(Locale.ROOT))
                .queryParam(QUERY_PARAM_TOKEN, properties.getApiKey())
                .toUriString();

            LOG.debug("Fetching quote from Finnhub: symbol={}", symbol);

            ResponseEntity<QuoteResponse> response = restTemplate.exchange(url,
                java.util.Objects.requireNonNull(HttpMethod.GET), null,
                QuoteResponse.class);

            QuoteResponse quote = response.getBody();
            if (quote == null) {
                return Optional.empty();
            }

            TickData tickData = TickData.builder()
                .symbol(symbol.toUpperCase(Locale.ROOT))
                .market(MarketType.US_STOCK.getCode())
                .timestamp(Instant.ofEpochSecond(quote.getT()))
                .price(BigDecimal.valueOf(quote.getC()))
                .change(BigDecimal.valueOf(quote.getD()))
                .changePercent(BigDecimal.valueOf(quote.getDp()))
                .open(BigDecimal.valueOf(quote.getO()))
                .dayHigh(BigDecimal.valueOf(quote.getH()))
                .dayLow(BigDecimal.valueOf(quote.getL()))
                .prevClose(BigDecimal.valueOf(quote.getPc()))
                .volume(null)
                .build();

            return Optional.of(tickData);

        }
        catch (RestClientException e) {
            LOG.error("Failed to fetch quote from Finnhub: {}", e.getMessage());
            // 回退到模拟数据
            return mockProvider.getRealTimeTick(symbol);
        }
    }

    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback)
        throws MarketDataException {

        symbols.forEach(sym -> subscribedSymbols.add(sym.toUpperCase(Locale.ROOT)));
        LOG.info("Subscribed to {} US stocks for real-time data", symbols.size());

        // Finnhub WebSocket 需要单独连接
        // 目前仅跟踪订阅
        // 生产环境中应实现 WebSocket 连接到 wss://ws.finnhub.io
    }

    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(sym.toUpperCase(Locale.ROOT)));
        LOG.info("Unsubscribed from {} US stocks", symbols.size());
    }

    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(US_EASTERN);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        // 周末检查
        if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
            return MarketStatus.CLOSED;
        }

        // 市场假日（简化）
        if (isMarketHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }

        // 交易时间（东部时间）
        LocalTime preMarketStart = LocalTime.of(PRE_MARKET_START_HOUR, 0);
        LocalTime preMarketEnd = LocalTime.of(PRE_MARKET_END_HOUR, PRE_MARKET_END_MINUTE);
        LocalTime regularStart = LocalTime.of(REGULAR_START_HOUR, REGULAR_START_MINUTE);
        LocalTime regularEnd = LocalTime.of(REGULAR_END_HOUR, 0);
        LocalTime postMarketEnd = LocalTime.of(POST_MARKET_END_HOUR, 0);

        if (time.isAfter(preMarketStart) && time.isBefore(preMarketEnd)) {
            return MarketStatus.PRE_MARKET;
        }
        else if ((time.equals(regularStart) || time.isAfter(regularStart))
            && time.isBefore(regularEnd)) {
            return MarketStatus.OPEN;
        }
        else if ((time.equals(regularEnd) || time.isAfter(regularEnd))
            && time.isBefore(postMarketEnd)) {
            return MarketStatus.POST_MARKET;
        }
        else {
            return MarketStatus.CLOSED;
        }
    }

    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!properties.isReady()) {
            return mockProvider.searchSymbols(keyword, limit);
        }

        try {
            String url = UriComponentsBuilder
                .fromUriString(properties.getBaseUrl() + "/search")
                .queryParam("q", keyword)
                .queryParam(QUERY_PARAM_TOKEN, properties.getApiKey())
                .toUriString();

            ResponseEntity<SearchResponse> response = restTemplate.exchange(url,
                java.util.Objects.requireNonNull(HttpMethod.GET), null,
                SearchResponse.class);

            SearchResponse body = response.getBody();
            if (body == null || body.result() == null) {
                return Collections.emptyList();
            }

            return body.result().stream()
                .filter(r -> r.type() != null && r.type().equals(STOCK_TYPE_COMMON))
                .limit(limit)
                .map(r -> new SymbolInfo(r.symbol(), r.description(),
                    MarketType.US_STOCK.getCode(),
                    r.exchange() != null ? r.exchange() : DEFAULT_EXCHANGE, SYMBOL_TYPE_STOCK))
                .toList();

        }
        catch (RestClientException e) {
            LOG.error("Failed to search symbols from Finnhub: {}", e.getMessage());
            return mockProvider.searchSymbols(keyword, limit);
        }
    }

    // Helper methods

    private String mapTimeframe(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case TIMEFRAME_1M -> RESOLUTION_1;
            case TIMEFRAME_5M -> RESOLUTION_5;
            case TIMEFRAME_15M -> RESOLUTION_15;
            case TIMEFRAME_30M -> RESOLUTION_30;
            case TIMEFRAME_1H, TIMEFRAME_60M -> RESOLUTION_60;
            case TIMEFRAME_1D, TIMEFRAME_DAILY -> RESOLUTION_D;
            case TIMEFRAME_1W, TIMEFRAME_WEEKLY -> RESOLUTION_W;
            case TIMEFRAME_1MTH, TIMEFRAME_MONTHLY -> RESOLUTION_M;
            default -> RESOLUTION_D;
        };
    }

    private List<KlineData> convertToKlineData(CandleResponse response, String symbol,
        String timeframe, int limit) {
        List<KlineData> klines = new ArrayList<>();

        if (response.getT() == null || response.getT().isEmpty()) {
            return klines;
        }

        int count = Math.min(response.getT().size(), limit);
        for (int i = 0; i < count; i++) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.US_STOCK.getCode())
                .timestamp(Instant.ofEpochSecond(response.getT().get(i)))
                .open(BigDecimal.valueOf(response.getO().get(i)))
                .high(BigDecimal.valueOf(response.getH().get(i)))
                .low(BigDecimal.valueOf(response.getL().get(i)))
                .close(BigDecimal.valueOf(response.getC().get(i)))
                .volume(response.getV().get(i))
                .amount(BigDecimal.valueOf(response.getC().get(i) * response.getV().get(i)))
                .timeframe(timeframe)
                .build());
        }

        return klines;
    }

    private boolean isMarketHoliday(LocalDate date) {
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();
        DayOfWeek dow = date.getDayOfWeek();

        return isNewYearHoliday(month, day, dow)
            || isIndependenceDayHoliday(month, day, dow)
            || isChristmasHoliday(month, day, dow);
    }

    private boolean isNewYearHoliday(int month, int day, DayOfWeek dow) {
        return month == JANUARY
            && (day == NEW_YEAR_DAY
            || (day == NEW_YEAR_DAY_ALT && dow == DayOfWeek.MONDAY));
    }

    private boolean isIndependenceDayHoliday(int month, int day, DayOfWeek dow) {
        return month == JULY
            && (day == INDEPENDENCE_DAY
            || (day == INDEPENDENCE_DAY_EVE && dow == DayOfWeek.FRIDAY)
            || (day == INDEPENDENCE_DAY_AFTER && dow == DayOfWeek.MONDAY));
    }

    private boolean isChristmasHoliday(int month, int day, DayOfWeek dow) {
        return month == DECEMBER
            && (day == CHRISTMAS_DAY
            || (day == CHRISTMAS_EVE && dow == DayOfWeek.FRIDAY)
            || (day == CHRISTMAS_AFTER && dow == DayOfWeek.MONDAY));
    }



    /**
     * 获取已订阅的股票代码。
     *
     * @return 订阅的股票代码集合
     */
    public Set<String> getSubscribedSymbols() {
        return new java.util.HashSet<>(subscribedSymbols);
    }

    // Finnhub API 响应类

    /**
     * K线数据响应。
     */
    @Getter
    @Setter
    static class CandleResponse {
        /** Status. */
        private String s;
        /** Timestamps. */
        private List<Long> t;
        /** Open prices. */
        private List<Double> o;
        /** High prices. */
        private List<Double> h;
        /** Low prices. */
        private List<Double> l;
        /** Close prices. */
        private List<Double> c;
        /** Volumes. */
        private List<Long> v;
    }

    /**
     * 报价响应。
     */
    @Getter
    @Setter
    static class QuoteResponse {
        /** Current price. */
        private double c;
        /** Change. */
        private double d;
        /** Change percent. */
        private double dp;
        /** High price. */
        private double h;
        /** Low price. */
        private double l;
        /** Open price. */
        private double o;
        /** Previous close. */
        private double pc;
        /** Timestamp. */
        private long t;
    }

    /**
     * 搜索响应。
     *
     * @param count 结果数量
     * @param result 结果列表
     */
    record SearchResponse(int count, List<SearchResult> result) {
    }

    /**
     * 搜索结果。
     *
     * @param description 描述
     * @param displaySymbol 显示代码
     * @param symbol 代码
     * @param type 类型
     * @param exchange 交易所
     */
    record SearchResult(String description, String displaySymbol, String symbol,
        String type, String exchange) {
    }

}
