package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Futures market data provider.
 * Fetches futures data from Python Data Service.
 * 
 * Market Characteristics:
 * - Commodity Futures: Gold, Silver, Copper, Crude Oil, etc.
 * - Financial Futures: Index futures, Bond futures
 * - Trading hours vary by exchange and product
 * - Contract codes include delivery month (e.g., AU2412 = Gold Dec 2024)
 * 
 * Chinese Futures (主要上海、大连、郑州、中金所):
 * - 上期所 (SHFE): Gold (AU), Silver (AG), Copper (CU), etc.
 * - 大商所 (DCE): Iron Ore (I), Soybean (A), etc.
 * - 郑商所 (ZCE): PTA, etc.
 * - 中金所 (CFFEX): CSI300 (IF), SSE50 (IH), etc.
 * 
 * Symbol format varies:
 * - Chinese: AU2412, AG2406, CU2403
 * - International: GC (Gold), CL (Crude Oil), ES (E-mini S&P 500)
 */
@Component
public class FuturesProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(FuturesProvider.class);
    private static final ZoneId BEIJING_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String FUTURES_BASE_PATH = "/futures";
    private static final String PROVIDER_NAME = "akshare-futures";
    private static final String HTTP_GET_MESSAGE = "HTTP GET must not be null";
    private static final String RESPONSE_TYPE_MESSAGE = "responseType must not be null";
    private static final String DEFAULT_EXCHANGE = "SHFE";
    private static final long KLINE_VOLUME_MIN = 1_000L;
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 100_000L;
    private static final long TICK_VOLUME_MIN = 10_000L;
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 500_000L;
    private static final long ORDER_BOOK_VOLUME_MIN = 10L;
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 1_000L;
    private static final HttpMethod HTTP_GET = HttpMethod.GET;
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<List<Map<String, Object>>>() {
        };
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<Map<String, Object>>() {
        };
    
    private final DataServiceProperties properties;
    private final RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    
    // Base prices for popular futures (mock data fallback)
    private final Map<String, BigDecimal> basePrices = new HashMap<>();
    
    public FuturesProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate) {
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.restTemplate = Objects.requireNonNull(restTemplate, "restTemplate must not be null");
        // SHFE (上海期货交易所)
        basePrices.put("AU2412", new BigDecimal("480.00"));  // Gold (CNY/g)
        basePrices.put("AG2412", new BigDecimal("5800.00")); // Silver (CNY/kg)
        basePrices.put("CU2412", new BigDecimal("68000.00")); // Copper (CNY/ton)
        basePrices.put("AL2412", new BigDecimal("19200.00")); // Aluminum (CNY/ton)
        basePrices.put("ZN2412", new BigDecimal("23500.00")); // Zinc (CNY/ton)
        basePrices.put("NI2412", new BigDecimal("128000.00")); // Nickel (CNY/ton)
        basePrices.put("RB2412", new BigDecimal("3500.00"));  // Rebar (CNY/ton)
        basePrices.put("HC2412", new BigDecimal("3650.00"));  // Hot-rolled coil (CNY/ton)
        
        // DCE (大连商品交易所)
        basePrices.put("I2501", new BigDecimal("780.00"));   // Iron Ore (CNY/ton)
        basePrices.put("A2501", new BigDecimal("4200.00"));  // Soybean No.1 (CNY/ton)
        basePrices.put("M2501", new BigDecimal("3200.00"));  // Soybean Meal (CNY/ton)
        basePrices.put("Y2501", new BigDecimal("7500.00"));  // Soybean Oil (CNY/ton)
        basePrices.put("P2501", new BigDecimal("7200.00"));  // Palm Oil (CNY/ton)
        
        // CFFEX (中国金融期货交易所)
        basePrices.put("IF2412", new BigDecimal("3800.00"));  // CSI300 Index
        basePrices.put("IH2412", new BigDecimal("2550.00"));  // SSE50 Index
        basePrices.put("IC2412", new BigDecimal("5600.00"));  // CSI500 Index
        basePrices.put("IM2412", new BigDecimal("6200.00"));  // CSI1000 Index
        basePrices.put("T2412", new BigDecimal("104.50"));    // 10-Year Treasury Bond
        basePrices.put("TF2412", new BigDecimal("103.20"));   // 5-Year Treasury Bond
        
        // International (CME, etc.)
        basePrices.put("GC", new BigDecimal("2150.00"));      // COMEX Gold (USD/oz)
        basePrices.put("SI", new BigDecimal("24.50"));        // COMEX Silver (USD/oz)
        basePrices.put("CL", new BigDecimal("78.50"));        // WTI Crude Oil (USD/bbl)
        basePrices.put("ES", new BigDecimal("5800.00"));      // E-mini S&P 500
        basePrices.put("NQ", new BigDecimal("20500.00"));     // E-mini Nasdaq-100
    }
    
    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.FUTURES;
    }
    
    @Override
    public boolean isAvailable() {
        return properties.isEnabled();
    }
    
    @Override
    public int getHealthScore() {
        if (!properties.isEnabled()) {
            return 0;
        }
        return 100;
    }
    
    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                         Instant startTime, Instant endTime) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            log.debug("Data service not available, using mock data for futures kline");
            return generateMockKlineData(symbol, timeframe, limit, endTime);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FUTURES_BASE_PATH + "/kline/{symbol}")
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit);
            
            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }
            
            String url = builder.buildAndExpand(normalizedSymbol).toUriString();
            
            log.debug("Fetching futures kline from data service: symbol={}, timeframe={}", 
                    normalizedSymbol, timeframe);
            
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    getListMapResponseType()
            );
            
            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockKlineData(symbol, timeframe, limit, endTime);
            }
            
            return convertToKlineData(data, normalizedSymbol, timeframe);
            
        } catch (RestClientException e) {
            log.error("Failed to fetch futures kline from data service: {}", e.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, endTime);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            log.debug("Data service not available, using mock data for futures tick");
            return generateMockTickData(symbol);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FUTURES_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();
            
            log.debug("Fetching futures price from data service: symbol={}", normalizedSymbol);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    getMapResponseType()
            );
            
            Map<String, Object> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockTickData(symbol);
            }
            
            return Optional.of(convertToTickData(data, normalizedSymbol));
            
        } catch (RestClientException e) {
            log.error("Failed to fetch futures price from data service: {}", e.getMessage());
            return generateMockTickData(symbol);
        }
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        symbols.forEach(sym -> subscribedSymbols.add(normalizeSymbol(sym)));
        log.info("Subscribed to {} futures contracts for real-time data", symbols.size());
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
        log.info("Unsubscribed from {} futures contracts", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(BEIJING_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();
        
        if (isWeekend(dayOfWeek)) {
            return MarketStatus.CLOSED;
        }

        if (isDaySession(time)) {
            return MarketStatus.OPEN;
        }

        if (isNightSession(time)) {
            return MarketStatus.POST_MARKET;
        }

        if (isBreakSession(time)) {
            return MarketStatus.BREAK;
        }

        return MarketStatus.CLOSED;
    }
    
    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            return generateMockSearchResults(keyword, limit);
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FUTURES_BASE_PATH + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();
            
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    getListMapResponseType()
            );
            
            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockSearchResults(keyword, limit);
            }
            
            return data.stream()
                    .map(this::convertToSymbolInfo)
                    .limit(limit)
                    .toList();
                    
        } catch (RestClientException e) {
            log.error("Failed to search futures: {}", e.getMessage());
            return generateMockSearchResults(keyword, limit);
        }
    }
    
    // Helper methods
    
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }
        
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        
        // Remove any exchange suffix if present
        if (normalized.contains(".")) {
            normalized = normalized.substring(0, normalized.indexOf("."));
        }
        
        return normalized;
    }

    private static @NonNull HttpMethod getHttpGet() {
        return Objects.requireNonNull(HTTP_GET, HTTP_GET_MESSAGE);
    }

    private static @NonNull ParameterizedTypeReference<List<Map<String, Object>>> getListMapResponseType() {
        return Objects.requireNonNull(LIST_MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }

    private static @NonNull ParameterizedTypeReference<Map<String, Object>> getMapResponseType() {
        return Objects.requireNonNull(MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }
    
    private List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                   Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("5000.00"));
        
        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = parseTimeframe(timeframe);
        
        // Futures typically have higher volatility
        double volatility = normalizedSymbol.startsWith("AU") || normalizedSymbol.equals("GC") 
                           ? 0.008 : 0.015;
        
        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (Math.random() - 0.5) * volatility * 2;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);
            
            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + Math.random() * volatility));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - Math.random() * volatility));
            BigDecimal open = currentPrice;
            
            long volume = ThreadLocalRandom.current()
                    .nextLong(KLINE_VOLUME_MIN, KLINE_VOLUME_MAX_EXCLUSIVE);
            
            klines.add(KlineData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.FUTURES.getCode())
                .timestamp(currentTime)
                .open(open)
                .high(high)
                .low(low)
                .close(close)
                .volume(volume)
                .amount(close.multiply(BigDecimal.valueOf(volume)))
                .timeframe(timeframe)
                .build());
            
            currentPrice = close;
            currentTime = currentTime.minus(interval);
        }
        
        Collections.reverse(klines);
        return klines;
    }
    
    private Optional<TickData> generateMockTickData(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("5000.00"));
        
        double volatility = 0.01;
        double changePercent = (Math.random() - 0.5) * volatility * 2;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, 4, RoundingMode.HALF_UP)
                                              .multiply(BigDecimal.valueOf(100));
        
        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN, TICK_VOLUME_MAX_EXCLUSIVE);
        
        // Tick size varies by product
        BigDecimal tickSize = normalizedSymbol.startsWith("AU") || normalizedSymbol.equals("GC")
                      ? new BigDecimal("0.02")
                      : new BigDecimal("1");
        
        TickData tickData = TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.FUTURES.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.subtract(tickSize))
            .bidVolume(ThreadLocalRandom.current()
                    .nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .askPrice(price.add(tickSize))
            .askVolume(ThreadLocalRandom.current()
                    .nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .dayHigh(price.multiply(BigDecimal.valueOf(1.02)))
            .dayLow(price.multiply(BigDecimal.valueOf(0.98)))
            .open(basePrice)
            .prevClose(basePrice)
            .build();
        
        return Optional.of(tickData);
    }
    
    private List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);
        
        // SHFE (上海期货交易所)
        Map<String, String> shfeFutures = new LinkedHashMap<>();
        shfeFutures.put("AU2412", "上海黄金期货 (Gold)");
        shfeFutures.put("AG2412", "上海白银期货 (Silver)");
        shfeFutures.put("CU2412", "上海铜期货 (Copper)");
        shfeFutures.put("AL2412", "上海铝期货 (Aluminum)");
        shfeFutures.put("ZN2412", "上海锌期货 (Zinc)");
        shfeFutures.put("NI2412", "上海镍期货 (Nickel)");
        shfeFutures.put("RB2412", "螺纹钢期货 (Rebar)");
        shfeFutures.put("HC2412", "热轧卷板期货 (HRC)");
        
        // DCE (大连商品交易所)
        Map<String, String> dceFutures = new LinkedHashMap<>();
        dceFutures.put("I2501", "铁矿石期货 (Iron Ore)");
        dceFutures.put("A2501", "豆一期货 (Soybean No.1)");
        dceFutures.put("M2501", "豆粕期货 (Soybean Meal)");
        dceFutures.put("Y2501", "豆油期货 (Soybean Oil)");
        dceFutures.put("P2501", "棕榈油期货 (Palm Oil)");
        
        // CFFEX (中国金融期货交易所)
        Map<String, String> cffexFutures = new LinkedHashMap<>();
        cffexFutures.put("IF2412", "沪深300指数期货 (CSI300)");
        cffexFutures.put("IH2412", "上证50指数期货 (SSE50)");
        cffexFutures.put("IC2412", "中证500指数期货 (CSI500)");
        cffexFutures.put("IM2412", "中证1000指数期货 (CSI1000)");
        cffexFutures.put("T2412", "10年期国债期货 (10Y Treasury)");
        cffexFutures.put("TF2412", "5年期国债期货 (5Y Treasury)");
        
        // Combine all futures
        Map<String, String> allFutures = new LinkedHashMap<>();
        allFutures.putAll(shfeFutures);
        allFutures.putAll(dceFutures);
        allFutures.putAll(cffexFutures);
        
        allFutures.entrySet().stream()
            .filter(e -> e.getKey().contains(upperKeyword) || 
                        e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
            .limit(limit)
            .forEach(e -> {
                String exchange = resolveExchange(e.getKey(), shfeFutures, dceFutures);
                results.add(new SymbolInfo(
                    e.getKey(),
                    e.getValue(),
                    MarketType.FUTURES.getCode(),
                    exchange,
                    "futures"
                ));
            });
        
        return results;
    }
    
    private List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol, String timeframe) {
        List<KlineData> klines = new ArrayList<>();
        
        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.FUTURES.getCode())
                .timestamp(DataConverter.toInstantFromMillis(getLong(item, "timestamp")))
                .open(DataConverter.toBigDecimal(getString(item, "open")))
                .high(DataConverter.toBigDecimal(getString(item, "high")))
                .low(DataConverter.toBigDecimal(getString(item, "low")))
                .close(DataConverter.toBigDecimal(getString(item, "close")))
                .volume(getLong(item, "volume"))
                .amount(DataConverter.toBigDecimal(getString(item, "amount")))
                .timeframe(timeframe)
                .build());
        }
        
        return klines;
    }
    
    private TickData convertToTickData(Map<String, Object> data, String symbol) {
        return TickData.builder()
            .symbol(symbol)
            .market(MarketType.FUTURES.getCode())
            .timestamp(DataConverter.toInstantFromMillis(getLong(data, "timestamp")))
            .price(DataConverter.toBigDecimal(getString(data, "price")))
            .change(DataConverter.toBigDecimal(getString(data, "change")))
            .changePercent(DataConverter.toBigDecimal(getString(data, "changePercent")))
            .volume(getLong(data, "volume"))
            .amount(DataConverter.toBigDecimal(getString(data, "amount")))
            .bidPrice(DataConverter.toBigDecimal(getString(data, "bidPrice")))
            .bidVolume(getLong(data, "bidVolume"))
            .askPrice(DataConverter.toBigDecimal(getString(data, "askPrice")))
            .askVolume(getLong(data, "askVolume"))
            .dayHigh(DataConverter.toBigDecimal(getString(data, "high")))
            .dayLow(DataConverter.toBigDecimal(getString(data, "low")))
            .open(DataConverter.toBigDecimal(getString(data, "open")))
            .prevClose(DataConverter.toBigDecimal(getString(data, "prevClose")))
            .build();
    }
    
    private SymbolInfo convertToSymbolInfo(Map<String, Object> data) {
        return new SymbolInfo(
            getString(data, "symbol"),
            getString(data, "name"),
            MarketType.FUTURES.getCode(),
            resolveExchange(getString(data, "exchange")),
            "futures"
        );
    }
    
    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException _) {
            return null;
        }
    }

    private boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    private boolean isDaySession(LocalTime time) {
        return (time.isAfter(LocalTime.of(9, 0)) && time.isBefore(LocalTime.of(10, 15)))
                || (time.isAfter(LocalTime.of(10, 30)) && time.isBefore(LocalTime.of(11, 30)))
                || (time.isAfter(LocalTime.of(13, 30)) && time.isBefore(LocalTime.of(15, 0)));
    }

    private boolean isNightSession(LocalTime time) {
        return time.isAfter(LocalTime.of(21, 0)) || time.isBefore(LocalTime.of(2, 30));
    }

    private boolean isBreakSession(LocalTime time) {
        return (time.equals(LocalTime.of(10, 15))
                || (time.isAfter(LocalTime.of(10, 15)) && time.isBefore(LocalTime.of(10, 30))))
                || (time.equals(LocalTime.of(11, 30))
                || (time.isAfter(LocalTime.of(11, 30)) && time.isBefore(LocalTime.of(13, 30))))
                || (time.equals(LocalTime.of(15, 0))
                || (time.isAfter(LocalTime.of(15, 0)) && time.isBefore(LocalTime.of(21, 0))));
    }

    private String resolveExchange(String symbol, Map<String, String> shfeFutures,
                                   Map<String, String> dceFutures) {
        if (shfeFutures.containsKey(symbol)) {
            return DEFAULT_EXCHANGE;
        }
        if (dceFutures.containsKey(symbol)) {
            return "DCE";
        }
        return "CFFEX";
    }

    private String resolveExchange(String exchange) {
        if (exchange == null || exchange.isBlank()) {
            return DEFAULT_EXCHANGE;
        }
        return exchange;
    }
    
    private Duration parseTimeframe(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "1m" -> Duration.ofMinutes(1);
            case "5m" -> Duration.ofMinutes(5);
            case "15m" -> Duration.ofMinutes(15);
            case "30m" -> Duration.ofMinutes(30);
            case "1h", "60m" -> Duration.ofHours(1);
            case "2h" -> Duration.ofHours(2);
            case "4h" -> Duration.ofHours(4);
            case "1d", "daily" -> Duration.ofDays(1);
            case "1w", "weekly" -> Duration.ofDays(7);
            case "1mth", "monthly" -> Duration.ofDays(30);
            default -> Duration.ofDays(1);
        };
    }
}
