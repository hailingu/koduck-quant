package com.koduck.service.market;

import com.koduck.config.properties.FinnhubProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.service.market.support.USStockMockDataProvider;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * US Stock market data provider using Finnhub API.
 * Supports US equities with pre-market and after-hours trading.
 * 
 * Free tier limits: 60 calls/minute
 * 
 * Trading Hours (Eastern Time):
 * - Pre-market: 04:00 - 09:30
 * - Regular: 09:30 - 16:00
 * - After-hours: 16:00 - 20:00
 * 
 * @see <a href="https://finnhub.io/docs/api">Finnhub API Docs</a>
 */
@Component
public class USStockProvider implements MarketDataProvider {
    
    private static final Logger LOG = LoggerFactory.getLogger(USStockProvider.class);
    private static final ZoneId US_EASTERN = ZoneId.of("America/New_York");
    private static final String PROVIDER_NAME = "finnhub-us-stock";
    private static final String QUERY_PARAM_TOKEN = "token";
    private static final long THIRTY_DAYS_SECONDS = 86_400L * 30L;
    
    private final FinnhubProperties properties;
    private final RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    
    // Fallback to mock data when API is not available
    private final USStockMockDataProvider mockProvider = new USStockMockDataProvider();

    public USStockProvider(
            FinnhubProperties properties,
            @Qualifier("finnhubRestTemplate") RestTemplate restTemplate) {
        this.properties = Objects.requireNonNull(properties, "properties must not be null");
        this.restTemplate = Objects.requireNonNull(restTemplate, "restTemplate must not be null");
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
            return 100;
        } else if (properties.isEnabled()) {
            return 50; // Configured but no API key
        } else {
            return mockProvider.getHealthScore();
        }
    }
    
    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                         Instant startTime, Instant endTime) 
            throws MarketDataException {
        
        if (!properties.isReady()) {
            LOG.debug("Finnhub not configured, using mock data for kline");
            return mockProvider.getKlineData(symbol, timeframe, limit, startTime, endTime);
        }
        
        try {
            String resolution = mapTimeframe(timeframe);
            
            long from = startTime != null ? startTime.getEpochSecond() : 
                       Instant.now().minusSeconds(THIRTY_DAYS_SECONDS).getEpochSecond();
            long to = endTime != null ? endTime.getEpochSecond() : Instant.now().getEpochSecond();
            
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/stock/candle")
                    .queryParam("symbol", symbol.toUpperCase(Locale.ROOT))
                    .queryParam("resolution", resolution)
                    .queryParam("from", from)
                    .queryParam("to", to)
                    .queryParam(QUERY_PARAM_TOKEN, properties.getApiKey())
                    .toUriString();
            
            LOG.debug("Fetching kline from Finnhub: symbol={}, resolution={}", symbol, resolution);
            
            ResponseEntity<CandleResponse> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    CandleResponse.class
            );
            
            CandleResponse body = response.getBody();
                if (body == null || body.getS() == null || !body.getS().equals("ok")) {
                throw new MarketDataException("Invalid response from Finnhub: " + 
                    (body != null ? body.getS() : "null"));
            }
            
            return convertToKlineData(body, symbol.toUpperCase(Locale.ROOT), timeframe, limit);
            
        } catch (RestClientException e) {
            LOG.error("Failed to fetch kline from Finnhub: {}", e.getMessage());
            // Fallback to mock data
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
            
            ResponseEntity<QuoteResponse> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    QuoteResponse.class
            );
            
            QuoteResponse quote = response.getBody();
            if (quote == null) {
                return Optional.empty();
            }
            
            TickData tickData = TickData.builder()
                .symbol(symbol.toUpperCase(Locale.ROOT))
                .market(MarketType.US_STOCK.getCode())
                .timestamp(Instant.ofEpochSecond(quote.getT()))
                .price(BigDecimal.valueOf(quote.getC())) // Current price
                .change(BigDecimal.valueOf(quote.getD())) // Change
                .changePercent(BigDecimal.valueOf(quote.getDp())) // Change percent
                .open(BigDecimal.valueOf(quote.getO()))
                .dayHigh(BigDecimal.valueOf(quote.getH()))
                .dayLow(BigDecimal.valueOf(quote.getL()))
                .prevClose(BigDecimal.valueOf(quote.getPc()))
                .volume(null) // Quote doesn't provide volume
                .build();
            
            return Optional.of(tickData);
            
        } catch (RestClientException e) {
            LOG.error("Failed to fetch quote from Finnhub: {}", e.getMessage());
            // Fallback to mock data
            return mockProvider.getRealTimeTick(symbol);
        }
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        symbols.forEach(sym -> subscribedSymbols.add(sym.toUpperCase(Locale.ROOT)));
        LOG.info("Subscribed to {} US stocks for real-time data", symbols.size());
        
        // Finnhub WebSocket requires separate connection
        // For now, just track subscriptions
        // In production, implement WebSocket connection to wss://ws.finnhub.io
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
        
        // Weekend check
        if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) {
            return MarketStatus.CLOSED;
        }
        
        // Market holidays (simplified)
        if (isMarketHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }
        
        // Trading hours (Eastern Time)
        if (time.isAfter(LocalTime.of(4, 0)) && time.isBefore(LocalTime.of(9, 30))) {
            return MarketStatus.PRE_MARKET;
        } else if ((time.equals(LocalTime.of(9, 30)) || time.isAfter(LocalTime.of(9, 30))) 
                   && time.isBefore(LocalTime.of(16, 0))) {
            return MarketStatus.OPEN;
        } else if ((time.equals(LocalTime.of(16, 0)) || time.isAfter(LocalTime.of(16, 0))) 
                   && time.isBefore(LocalTime.of(20, 0))) {
            return MarketStatus.POST_MARKET;
        } else {
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
            
            ResponseEntity<SearchResponse> response = restTemplate.exchange(
                    url,
                    getHttpGet(),
                    null,
                    SearchResponse.class
            );
            
            SearchResponse body = response.getBody();
            if (body == null || body.result() == null) {
                return Collections.emptyList();
            }
            
            return body.result().stream()
                    .filter(r -> r.type() != null && r.type().equals("Common Stock"))
                    .limit(limit)
                    .map(r -> new SymbolInfo(
                        r.symbol(),
                        r.description(),
                        MarketType.US_STOCK.getCode(),
                        r.exchange() != null ? r.exchange() : "NASDAQ",
                        "stock"
                    ))
                    .toList();
                    
        } catch (RestClientException e) {
            LOG.error("Failed to search symbols from Finnhub: {}", e.getMessage());
            return mockProvider.searchSymbols(keyword, limit);
        }
    }
    
    // Helper methods
    
    private String mapTimeframe(String timeframe) {
        return switch (timeframe.toLowerCase(Locale.ROOT)) {
            case "1m" -> "1";
            case "5m" -> "5";
            case "15m" -> "15";
            case "30m" -> "30";
            case "1h", "60m" -> "60";
            case "1d", "daily" -> "D";
            case "1w", "weekly" -> "W";
            case "1mth", "monthly" -> "M";
            default -> "D";
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
        return month == 1 && (day == 1 || (day == 2 && dow == DayOfWeek.MONDAY));
    }

    private boolean isIndependenceDayHoliday(int month, int day, DayOfWeek dow) {
        return month == 7 && (day == 4
                || (day == 3 && dow == DayOfWeek.FRIDAY)
                || (day == 5 && dow == DayOfWeek.MONDAY));
    }

    private boolean isChristmasHoliday(int month, int day, DayOfWeek dow) {
        return month == 12 && (day == 25
                || (day == 24 && dow == DayOfWeek.FRIDAY)
                || (day == 26 && dow == DayOfWeek.MONDAY));
    }

    
    private static HttpMethod getHttpGet() {
        return Objects.requireNonNull(HttpMethod.GET, "HTTP GET must not be null");
    }
    
    /**
     * Get subscribed symbols
     */
    public Set<String> getSubscribedSymbols() {
        return new HashSet<>(subscribedSymbols);
    }
    
    // Finnhub API Response Classes
    
    @Getter
    @Setter
    static class CandleResponse {
        private String s; // Status: "ok" or "no_data"
        private List<Long> t; // Timestamps
        private List<Double> o; // Open prices
        private List<Double> h; // High prices
        private List<Double> l; // Low prices
        private List<Double> c; // Close prices
        private List<Long> v; // Volumes
    }
    
    @Getter
    @Setter
    static class QuoteResponse {
        private double c;  // Current price
        private double d;  // Change
        private double dp; // Change percent
        private double h;  // High
        private double l;  // Low
        private double o;  // Open
        private double pc; // Previous close
        private long t;    // Timestamp
    }
    
    record SearchResponse(int count, List<SearchResult> result) {
    }

    record SearchResult(String description, String displaySymbol, String symbol, String type, String exchange) {
    }
    
}
