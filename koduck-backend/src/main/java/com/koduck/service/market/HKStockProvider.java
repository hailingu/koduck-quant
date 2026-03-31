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
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Hong Kong Stock market data provider.
 * Fetches HK stock data from Python Data Service.
 * 
 * Trading Hours (Hong Kong Time):
 * - Pre-market: 09:00 - 09:30 (opening auction)
 * - Morning: 09:30 - 12:00
 * - Lunch: 12:00 - 13:00
 * - Afternoon: 13:00 - 16:00
 * - Closing auction: 16:00 - 16:10
 * 
 * Stock codes: 5-digit numbers (e.g., 00700 for Tencent, 09988 for Alibaba Health)
 */
@Component
public class HKStockProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(HKStockProvider.class);
    private static final ZoneId HONG_KONG_ZONE = ZoneId.of("Asia/Hong_Kong");
    private static final String HK_STOCK_BASE_PATH = "/hk-stock";
    private static final String PROVIDER_NAME = "akshare-hk-stock";
    private static final String RESPONSE_TYPE_MESSAGE = "responseType must not be null";
    private static final long KLINE_VOLUME_MIN = 100_000L;
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 10_000_000L;
    private static final long TICK_VOLUME_MIN = 1_000_000L;
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 50_000_000L;
    private static final long ORDER_BOOK_VOLUME_MIN = 100L;
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 10_000L;
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<List<Map<String, Object>>>() {
        };
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<Map<String, Object>>() {
        };
    
    private final DataServiceProperties properties;
    private final RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    
    // Mock data for fallback
    private final Map<String, BigDecimal> basePrices = new HashMap<>();
    
    public HKStockProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate) {
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.restTemplate = Objects.requireNonNull(restTemplate, "restTemplate must not be null");
        // Initialize base prices for popular HK stocks
        basePrices.put("00700", new BigDecimal("380.00")); // Tencent
        basePrices.put("09988", new BigDecimal("75.00"));  // Alibaba Health
        basePrices.put("01898", new BigDecimal("120.00")); // Meituan
        basePrices.put("09618", new BigDecimal("95.00"));  // JD.com
        basePrices.put("01211", new BigDecimal("150.00")); // BYD
        basePrices.put("09888", new BigDecimal("85.00"));  // Baidu
        basePrices.put("01024", new BigDecimal("45.00"));  // Kuaishou
        basePrices.put("02015", new BigDecimal("55.00"));  // Li Auto
        basePrices.put("09868", new BigDecimal("40.00"));  // XPeng
        basePrices.put("06690", new BigDecimal("25.00"));  // Haier
    }
    
    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.HK_STOCK;
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
            log.debug("Data service not available, using mock data for HK stock kline");
            return generateMockKlineData(symbol, timeframe, limit, endTime);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + HK_STOCK_BASE_PATH + "/kline/{symbol}")
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit);
            
            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }
            
            String url = builder.buildAndExpand(normalizedSymbol).toUriString();
            
            log.debug("Fetching HK stock kline from data service: symbol={}, timeframe={}", 
                    normalizedSymbol, timeframe);
            
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    Objects.requireNonNull(LIST_MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE)
            );
            
            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockKlineData(symbol, timeframe, limit, endTime);
            }
            
            return convertToKlineData(data, normalizedSymbol, timeframe);
            
        } catch (RestClientException e) {
            log.error("Failed to fetch HK stock kline from data service: {}", e.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, endTime);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            log.debug("Data service not available, using mock data for HK stock tick");
            return generateMockTickData(symbol);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + HK_STOCK_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();
            
            log.debug("Fetching HK stock price from data service: symbol={}", normalizedSymbol);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    Objects.requireNonNull(MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE)
            );
            
            Map<String, Object> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockTickData(symbol);
            }
            
            return Optional.of(convertToTickData(data, normalizedSymbol));
            
        } catch (RestClientException e) {
            log.error("Failed to fetch HK stock price from data service: {}", e.getMessage());
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
        log.info("Subscribed to {} HK stocks for real-time data", symbols.size());
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
        log.info("Unsubscribed from {} HK stocks", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(HONG_KONG_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        if (isWeekend(dayOfWeek) || isPublicHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }

        if (isPreMarket(time)) {
            return MarketStatus.PRE_MARKET;
        }

        if (isMorningSession(time) || isAfternoonSession(time)) {
            return MarketStatus.OPEN;
        }

        if (isLunchBreak(time)) {
            return MarketStatus.BREAK;
        }

        if (isClosingAuction(time)) {
            return MarketStatus.POST_MARKET;
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
                    .fromUriString(properties.getBaseUrl() + HK_STOCK_BASE_PATH + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();
            
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    Objects.requireNonNull(LIST_MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE)
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
            log.error("Failed to search HK stocks: {}", e.getMessage());
            return generateMockSearchResults(keyword, limit);
        }
    }
    
    // Helper methods
    
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }
        
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        
        // Remove .HK suffix if present
        if (normalized.endsWith(".HK")) {
            normalized = normalized.substring(0, normalized.length() - 3);
        }
        
        // Pad to 5 digits
        if (normalized.matches("\\d+")) {
            normalized = String.format("%05d", Integer.parseInt(normalized));
        }
        
        return normalized;
    }
    
    private List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                   Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("50.00"));
        
        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = parseTimeframe(timeframe);
        
        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (Math.random() - 0.5) * 0.04;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);
            
            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + Math.random() * 0.01));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - Math.random() * 0.01));
            BigDecimal open = currentPrice;
            
            long volume = ThreadLocalRandom.current().nextLong(KLINE_VOLUME_MIN, KLINE_VOLUME_MAX_EXCLUSIVE);
            
            klines.add(KlineData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.HK_STOCK.getCode())
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
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("50.00"));
        
        double changePercent = (Math.random() - 0.5) * 0.02;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, 4, RoundingMode.HALF_UP)
                                              .multiply(BigDecimal.valueOf(100));
        
        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN, TICK_VOLUME_MAX_EXCLUSIVE);
        
        TickData tickData = TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.HK_STOCK.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.multiply(BigDecimal.valueOf(0.999)))
            .bidVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .askPrice(price.multiply(BigDecimal.valueOf(1.001)))
            .askVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
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
        
        Map<String, String> hkStocks = new LinkedHashMap<>();
        hkStocks.put("00700", "Tencent Holdings Ltd.");
        hkStocks.put("09988", "Alibaba Health Information Technology");
        hkStocks.put("01898", "Meituan");
        hkStocks.put("09618", "JD.com Inc.");
        hkStocks.put("01211", "BYD Company Limited");
        hkStocks.put("09888", "Baidu Inc.");
        hkStocks.put("01024", "Kuaishou Technology");
        hkStocks.put("02015", "Li Auto Inc.");
        hkStocks.put("09868", "XPeng Inc.");
        hkStocks.put("06690", "Haier Smart Home Co.");
        
        hkStocks.entrySet().stream()
            .filter(e -> e.getKey().contains(upperKeyword) || 
                        e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
            .limit(limit)
            .forEach(e -> results.add(new SymbolInfo(
                e.getKey(),
                e.getValue(),
                MarketType.HK_STOCK.getCode(),
                "HKEX",
                "stock"
            )));
        
        return results;
    }
    
    private List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol, String timeframe) {
        List<KlineData> klines = new ArrayList<>();
        
        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.HK_STOCK.getCode())
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
            .market(MarketType.HK_STOCK.getCode())
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
            MarketType.HK_STOCK.getCode(),
            getString(data, "exchange") != null ? getString(data, "exchange") : "HKEX",
            "stock"
        );
    }
    
    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException _) {
            return null;
        }
    }

    private static @NonNull HttpMethod getHttpGet() {
        return Objects.requireNonNull(HttpMethod.GET, "HTTP GET must not be null");
    }
    
    private Duration parseTimeframe(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "1m" -> Duration.ofMinutes(1);
            case "5m" -> Duration.ofMinutes(5);
            case "15m" -> Duration.ofMinutes(15);
            case "30m" -> Duration.ofMinutes(30);
            case "1h", "60m" -> Duration.ofHours(1);
            case "1d", "daily" -> Duration.ofDays(1);
            case "1w", "weekly" -> Duration.ofDays(7);
            case "1mth", "monthly" -> Duration.ofDays(30);
            default -> Duration.ofDays(1);
        };
    }

    private boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    private boolean isPreMarket(LocalTime time) {
        return time.isAfter(LocalTime.of(9, 0)) && time.isBefore(LocalTime.of(9, 30));
    }

    private boolean isMorningSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(9, 30)) && time.isBefore(LocalTime.of(12, 0));
    }

    private boolean isLunchBreak(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(12, 0)) && time.isBefore(LocalTime.of(13, 0));
    }

    private boolean isAfternoonSession(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(13, 0)) && time.isBefore(LocalTime.of(16, 0));
    }

    private boolean isClosingAuction(LocalTime time) {
        return isAtOrAfter(time, LocalTime.of(16, 0)) && time.isBefore(LocalTime.of(16, 10));
    }

    private boolean isAtOrAfter(LocalTime time, LocalTime threshold) {
        return time.equals(threshold) || time.isAfter(threshold);
    }
    
    private boolean isPublicHoliday(LocalDate date) {
        // Simplified holiday check for HK
        // In production, should check against HKEX official calendar
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();
        
        // Lunar New Year (approximate - varies by year)
        if (month == 2 && day >= 10 && day <= 13) {
            return true;
        }
        
        // Ching Ming Festival (approximate)
        if (month == 4 && day == 4) {
            return true;
        }
        
        // Labour Day
        if (month == 5 && day == 1) {
            return true;
        }
        
        // Mid-Autumn Festival (approximate)
        if (month == 9 && day >= 17 && day <= 18) {
            return true;
        }
        
        // National Day
        if (month == 10 && day == 1) {
            return true;
        }
        
        // Christmas
        return month == 12 && (day == 25 || day == 26);
    }
}
