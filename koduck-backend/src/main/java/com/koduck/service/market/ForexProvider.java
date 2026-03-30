package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.Objects;

/**
 * Forex (Foreign Exchange) market data provider.
 * Fetches forex data from Python Data Service.
 * 
 * Market Characteristics:
 * - 24-hour market (5 days a week)
 * - Trading hours: Sunday 17:00 ET to Friday 17:00 ET
 * - Major pairs: EUR/USD, USD/JPY, GBP/USD, USD/CHF, AUD/USD, USD/CAD
 * - Cross pairs: EUR/GBP, EUR/JPY, GBP/JPY
 * - Asian pairs: USD/CNH, USD/SGD, USD/HKD
 * 
 * Symbol format: BASE/QUOTE (e.g., EUR/USD, USD/CNH)
 */
@Component
public class ForexProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(ForexProvider.class);
    private static final ZoneId NEW_YORK_ZONE = ZoneId.of("America/New_York");
    private static final String FOREX_BASE_PATH = "/forex";
    private static final String PROVIDER_NAME = "akshare-forex";
        private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };
        private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
            new ParameterizedTypeReference<>() {
            };
    
    @Autowired
    private DataServiceProperties properties;
    @Autowired
    @Qualifier("dataServiceRestTemplate")
    private RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    
    // Base rates for major currency pairs (mock data fallback)
    private final Map<String, BigDecimal> baseRates = new HashMap<>();
    
    public ForexProvider() {
        // Initialize base rates for major pairs
        baseRates.put("EUR/USD", new BigDecimal("1.0850"));
        baseRates.put("USD/JPY", new BigDecimal("149.50"));
        baseRates.put("GBP/USD", new BigDecimal("1.2650"));
        baseRates.put("USD/CHF", new BigDecimal("0.8820"));
        baseRates.put("AUD/USD", new BigDecimal("0.6550"));
        baseRates.put("USD/CAD", new BigDecimal("1.3520"));
        baseRates.put("EUR/GBP", new BigDecimal("0.8570"));
        baseRates.put("EUR/JPY", new BigDecimal("162.20"));
        baseRates.put("GBP/JPY", new BigDecimal("189.20"));
        baseRates.put("USD/CNH", new BigDecimal("7.2150"));
        baseRates.put("USD/SGD", new BigDecimal("1.3450"));
        baseRates.put("USD/HKD", new BigDecimal("7.8230"));
        baseRates.put("XAU/USD", new BigDecimal("2150.00")); // Gold
        baseRates.put("XAG/USD", new BigDecimal("24.50"));   // Silver
    }
    
    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.FOREX;
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
            log.debug("Data service not available, using mock data for forex kline");
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FOREX_BASE_PATH + "/kline/{symbol}")
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit);
            
            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }
            
            String url = builder.buildAndExpand(normalizedSymbol).toUriString();
            
            log.debug("Fetching forex kline from data service: symbol={}, timeframe={}", 
                    normalizedSymbol, timeframe);
            
                ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    LIST_MAP_RESPONSE_TYPE
                );
            
            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
            }
            
            return convertToKlineData(data, normalizedSymbol, timeframe);
            
        } catch (RestClientException e) {
            log.error("Failed to fetch forex kline from data service: {}", e.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            log.debug("Data service not available, using mock data for forex tick");
            return generateMockTickData(symbol);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FOREX_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();
            
            log.debug("Fetching forex price from data service: symbol={}", normalizedSymbol);
            
                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    MAP_RESPONSE_TYPE
                );
            
            Map<String, Object> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockTickData(symbol);
            }
            
            return Optional.of(convertToTickData(data, normalizedSymbol));
            
        } catch (RestClientException e) {
            log.error("Failed to fetch forex price from data service: {}", e.getMessage());
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
        log.info("Subscribed to {} forex pairs for real-time data", symbols.size());
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
        log.info("Unsubscribed from {} forex pairs", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(NEW_YORK_ZONE);
        DayOfWeek dayOfWeek = now.getDayOfWeek();
        LocalTime time = now.toLocalTime();
        
        // Forex trades 24 hours from Sunday 17:00 ET to Friday 17:00 ET
        boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY ||
                           (dayOfWeek == DayOfWeek.SUNDAY && time.isBefore(LocalTime.of(17, 0))) ||
                           (dayOfWeek == DayOfWeek.FRIDAY && time.isAfter(LocalTime.of(17, 0)));
        
        if (isWeekend) {
            return MarketStatus.CLOSED;
        }
        
        return MarketStatus.OPEN;
    }
    
    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            return generateMockSearchResults(keyword, limit);
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FOREX_BASE_PATH + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();
            
                ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    LIST_MAP_RESPONSE_TYPE
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
            log.error("Failed to search forex pairs: {}", e.getMessage());
            return generateMockSearchResults(keyword, limit);
        }
    }
    
    // Helper methods
    
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }
        
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        
        // Handle different formats: EURUSD, EUR-USD, EUR_USD -> EUR/USD
        normalized = normalized.replace("-", "/").replace("_", "/");
        
        // If no separator and 6 chars, insert / in middle (e.g., EURUSD -> EUR/USD)
        if (!normalized.contains("/") && normalized.length() == 6 && 
            normalized.matches("[A-Z]{6}")) {
            normalized = normalized.substring(0, 3) + "/" + normalized.substring(3);
        }
        
        // Handle XAUUSD format (Gold)
        if (!normalized.contains("/") && normalized.startsWith("XAU") && 
            normalized.length() == 6) {
            normalized = normalized.substring(0, 3) + "/" + normalized.substring(3);
        }
        
        // Handle XAGUSD format (Silver)
        if (!normalized.contains("/") && normalized.startsWith("XAG") && 
            normalized.length() == 6) {
            normalized = normalized.substring(0, 3) + "/" + normalized.substring(3);
        }
        
        return normalized;
    }
    
    private List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                   Instant startTime, Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, new BigDecimal("1.0000"));
        
        Instant currentTime = endTime != null ? endTime : Instant.now();
        if (endTime == null && startTime != null) {
            currentTime = startTime;
        }
        Duration interval = parseTimeframe(timeframe);
        
        // Adjust volatility based on pair (precious metals more volatile)
        double volatility = normalizedSymbol.startsWith("XAU") || normalizedSymbol.startsWith("XAG")
            ? 0.008 : 0.0015;
        
        BigDecimal currentRate = baseRate;
        for (int i = 0; i < limit; i++) {
            double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * volatility * 2;
            BigDecimal change = currentRate.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentRate.add(change);
            
            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal open = currentRate;
            
            long volume = ThreadLocalRandom.current().nextLong(10_000L, 1_000_000L);
            
            klines.add(KlineData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.FOREX.getCode())
                .timestamp(currentTime)
                .open(open)
                .high(high)
                .low(low)
                .close(close)
                .volume(volume)
                .amount(close.multiply(BigDecimal.valueOf(volume)))
                .timeframe(timeframe)
                .build());
            
            currentRate = close;
            currentTime = currentTime.minus(interval);
        }
        
        Collections.reverse(klines);
        return klines;
    }
    
    private Optional<TickData> generateMockTickData(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, new BigDecimal("1.0000"));
        
        // Adjust volatility based on pair
        double volatility = normalizedSymbol.startsWith("XAU") || normalizedSymbol.startsWith("XAG")
                ? 0.005 : 0.001;
        
        double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * volatility * 2;
        BigDecimal price = baseRate.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(baseRate);
        BigDecimal changePercentValue = change.divide(baseRate, 4, RoundingMode.HALF_UP)
                                              .multiply(BigDecimal.valueOf(100));
        
        long volume = ThreadLocalRandom.current().nextLong(100_000L, 5_000_000L);
        
        // Calculate pip size based on pair
        int pipDigits = 4;
        if (normalizedSymbol.startsWith("XAU")) {
            pipDigits = 2;
        } else if (normalizedSymbol.contains("JPY") || normalizedSymbol.startsWith("XAG")) {
            pipDigits = 3;
        }
        BigDecimal pipSize = BigDecimal.valueOf(Math.pow(10, -pipDigits));
        
        TickData tickData = TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.FOREX.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.subtract(pipSize.multiply(BigDecimal.valueOf(2))))
            .bidVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
            .askPrice(price.add(pipSize.multiply(BigDecimal.valueOf(2))))
            .askVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
            .dayHigh(price.multiply(BigDecimal.valueOf(1.01)))
            .dayLow(price.multiply(BigDecimal.valueOf(0.99)))
            .open(baseRate)
            .prevClose(baseRate)
            .build();
        
        return Optional.of(tickData);
    }
    
    private List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);
        
        Map<String, String> forexPairs = new LinkedHashMap<>();
        // Major pairs
        forexPairs.put("EUR/USD", "Euro / US Dollar");
        forexPairs.put("USD/JPY", "US Dollar / Japanese Yen");
        forexPairs.put("GBP/USD", "British Pound / US Dollar");
        forexPairs.put("USD/CHF", "US Dollar / Swiss Franc");
        forexPairs.put("AUD/USD", "Australian Dollar / US Dollar");
        forexPairs.put("USD/CAD", "US Dollar / Canadian Dollar");
        // Cross pairs
        forexPairs.put("EUR/GBP", "Euro / British Pound");
        forexPairs.put("EUR/JPY", "Euro / Japanese Yen");
        forexPairs.put("GBP/JPY", "British Pound / Japanese Yen");
        // Asian pairs
        forexPairs.put("USD/CNH", "US Dollar / Chinese Yuan (Offshore)");
        forexPairs.put("USD/SGD", "US Dollar / Singapore Dollar");
        forexPairs.put("USD/HKD", "US Dollar / Hong Kong Dollar");
        // Precious metals
        forexPairs.put("XAU/USD", "Gold / US Dollar");
        forexPairs.put("XAG/USD", "Silver / US Dollar");
        
        forexPairs.entrySet().stream()
            .filter(e -> e.getKey().contains(upperKeyword) || 
                        e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
            .limit(limit)
            .forEach(e -> results.add(new SymbolInfo(
                e.getKey(),
                e.getValue(),
                MarketType.FOREX.getCode(),
                "FOREX",
                "forex"
            )));
        
        return results;
    }
    
    private List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol, String timeframe) {
        List<KlineData> klines = new ArrayList<>();
        
        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.FOREX.getCode())
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
            .market(MarketType.FOREX.getCode())
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
            MarketType.FOREX.getCode(),
            "FOREX",
            "forex"
        );
    }
    
    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }
    
    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) return null;
        if (value instanceof Number number) {
            return number.longValue();
        }
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
            case "4h" -> Duration.ofHours(4);
            case "1d", "daily" -> Duration.ofDays(1);
            case "1w", "weekly" -> Duration.ofDays(7);
            case "1mth", "monthly" -> Duration.ofDays(30);
            default -> Duration.ofDays(1);
        };
    }
}
