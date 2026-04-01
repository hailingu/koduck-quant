package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;
import com.koduck.service.market.support.HKStockMarketCalendar;
import com.koduck.service.market.support.MarketDataMapReader;
import com.koduck.service.market.support.MarketTimeframeParser;
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
    
    private static final Logger LOG = LoggerFactory.getLogger(HKStockProvider.class);
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
            LOG.debug("Data service not available, using mock data for HK stock kline");
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
            
            LOG.debug("Fetching HK stock kline from data service: symbol={}, timeframe={}", 
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
            LOG.error("Failed to fetch HK stock kline from data service: {}", e.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, endTime);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            LOG.debug("Data service not available, using mock data for HK stock tick");
            return generateMockTickData(symbol);
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + HK_STOCK_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();
            
            LOG.debug("Fetching HK stock price from data service: symbol={}", normalizedSymbol);
            
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
            LOG.error("Failed to fetch HK stock price from data service: {}", e.getMessage());
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
        LOG.info("Subscribed to {} HK stocks for real-time data", symbols.size());
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
        LOG.info("Unsubscribed from {} HK stocks", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(HONG_KONG_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        if (HKStockMarketCalendar.isWeekend(dayOfWeek)
                || HKStockMarketCalendar.isPublicHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }

        if (HKStockMarketCalendar.isPreMarket(time)) {
            return MarketStatus.PRE_MARKET;
        }

        if (HKStockMarketCalendar.isMorningSession(time)
                || HKStockMarketCalendar.isAfternoonSession(time)) {
            return MarketStatus.OPEN;
        }

        if (HKStockMarketCalendar.isLunchBreak(time)) {
            return MarketStatus.BREAK;
        }

        if (HKStockMarketCalendar.isClosingAuction(time)) {
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
            LOG.error("Failed to search HK stocks: {}", e.getMessage());
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
        Duration interval = MarketTimeframeParser.parseStandard(timeframe);
        
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
                .timestamp(DataConverter.toInstantFromMillis(MarketDataMapReader.getLong(item, "timestamp")))
                .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "open")))
                .high(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "high")))
                .low(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "low")))
                .close(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "close")))
                .volume(MarketDataMapReader.getLong(item, "volume"))
                .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "amount")))
                .timeframe(timeframe)
                .build());
        }
        
        return klines;
    }
    
    private TickData convertToTickData(Map<String, Object> data, String symbol) {
        return TickData.builder()
            .symbol(symbol)
            .market(MarketType.HK_STOCK.getCode())
                .timestamp(DataConverter.toInstantFromMillis(MarketDataMapReader.getLong(data, "timestamp")))
                .price(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "price")))
                .change(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "change")))
                .changePercent(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "changePercent")))
                .volume(MarketDataMapReader.getLong(data, "volume"))
                .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "amount")))
                .bidPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "bidPrice")))
                .bidVolume(MarketDataMapReader.getLong(data, "bidVolume"))
                .askPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "askPrice")))
                .askVolume(MarketDataMapReader.getLong(data, "askVolume"))
                .dayHigh(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "high")))
                .dayLow(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "low")))
                .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "open")))
                .prevClose(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "prevClose")))
            .build();
    }
    
    private SymbolInfo convertToSymbolInfo(Map<String, Object> data) {
        return new SymbolInfo(
            MarketDataMapReader.getString(data, "symbol"),
            MarketDataMapReader.getString(data, "name"),
            MarketType.HK_STOCK.getCode(),
            MarketDataMapReader.getString(data, "exchange") != null
                ? MarketDataMapReader.getString(data, "exchange")
                : "HKEX",
            "stock"
        );
    }

    
    private static HttpMethod getHttpGet() {
        return Objects.requireNonNull(HttpMethod.GET, "HTTP GET must not be null");
    }
    
}
