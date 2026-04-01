package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;
import com.koduck.service.market.support.FuturesMockDataSupport;
import com.koduck.service.market.support.MarketDataMapReader;
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
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
    
    private static final Logger LOG = LoggerFactory.getLogger(FuturesProvider.class);
    private static final ZoneId BEIJING_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String FUTURES_BASE_PATH = "/futures";
    private static final String PROVIDER_NAME = "akshare-futures";
    private static final String HTTP_GET_MESSAGE = "HTTP GET must not be null";
    private static final String RESPONSE_TYPE_MESSAGE = "responseType must not be null";
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
    private final Map<String, BigDecimal> basePrices;
    
    public FuturesProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate) {
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.restTemplate = Objects.requireNonNull(restTemplate, "restTemplate must not be null");
        this.basePrices = FuturesMockDataSupport.defaultBasePrices();
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
            LOG.debug("Data service not available, using mock data for futures kline");
            return FuturesMockDataSupport.generateMockKlineData(
                normalizeSymbol(symbol), timeframe, limit, endTime, basePrices);
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
            
            LOG.debug("Fetching futures kline from data service: symbol={}, timeframe={}", 
                    normalizedSymbol, timeframe);
            
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    getListMapResponseType()
            );
            
            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return FuturesMockDataSupport.generateMockKlineData(
                    normalizedSymbol, timeframe, limit, endTime, basePrices);
            }
            
            return convertToKlineData(data, normalizedSymbol, timeframe);
            
        } catch (RestClientException e) {
            LOG.error("Failed to fetch futures kline from data service: {}", e.getMessage());
            return FuturesMockDataSupport.generateMockKlineData(
                normalizeSymbol(symbol), timeframe, limit, endTime, basePrices);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            LOG.debug("Data service not available, using mock data for futures tick");
            return Optional.of(FuturesMockDataSupport.generateMockTickData(normalizeSymbol(symbol), basePrices));
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + FUTURES_BASE_PATH + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();
            
            LOG.debug("Fetching futures price from data service: symbol={}", normalizedSymbol);
            
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    getMapResponseType()
            );
            
            Map<String, Object> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return Optional.of(FuturesMockDataSupport.generateMockTickData(normalizedSymbol, basePrices));
            }
            
            return Optional.of(convertToTickData(data, normalizedSymbol));
            
        } catch (RestClientException e) {
            LOG.error("Failed to fetch futures price from data service: {}", e.getMessage());
            return Optional.of(FuturesMockDataSupport.generateMockTickData(normalizeSymbol(symbol), basePrices));
        }
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        symbols.forEach(sym -> subscribedSymbols.add(normalizeSymbol(sym)));
        LOG.info("Subscribed to {} futures contracts for real-time data", symbols.size());
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
        LOG.info("Unsubscribed from {} futures contracts", symbols.size());
    }
    
    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(BEIJING_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();
        
        if (FuturesMockDataSupport.isWeekend(dayOfWeek)) {
            return MarketStatus.CLOSED;
        }

        if (FuturesMockDataSupport.isDaySession(time)) {
            return MarketStatus.OPEN;
        }

        if (FuturesMockDataSupport.isNightSession(time)) {
            return MarketStatus.POST_MARKET;
        }

        if (FuturesMockDataSupport.isBreakSession(time)) {
            return MarketStatus.BREAK;
        }

        return MarketStatus.CLOSED;
    }
    
    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            return FuturesMockDataSupport.generateMockSearchResults(keyword, limit);
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
                return FuturesMockDataSupport.generateMockSearchResults(keyword, limit);
            }
            
            return data.stream()
                    .map(this::convertToSymbolInfo)
                    .limit(limit)
                    .toList();
                    
        } catch (RestClientException e) {
            LOG.error("Failed to search futures: {}", e.getMessage());
            return FuturesMockDataSupport.generateMockSearchResults(keyword, limit);
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

    
    private static HttpMethod getHttpGet() {
        return Objects.requireNonNull(HTTP_GET, HTTP_GET_MESSAGE);
    }

    
    private static ParameterizedTypeReference<List<Map<String, Object>>> getListMapResponseType() {
        return Objects.requireNonNull(LIST_MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }

    
    private static ParameterizedTypeReference<Map<String, Object>> getMapResponseType() {
        return Objects.requireNonNull(MAP_RESPONSE_TYPE, RESPONSE_TYPE_MESSAGE);
    }
    
    private List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol, String timeframe) {
        List<KlineData> klines = new ArrayList<>();
        
        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.FUTURES.getCode())
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
            .market(MarketType.FUTURES.getCode())
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
            MarketType.FUTURES.getCode(),
            FuturesMockDataSupport.resolveExchangeOrDefault(MarketDataMapReader.getString(data, "exchange")),
            "futures"
        );
    }
}
