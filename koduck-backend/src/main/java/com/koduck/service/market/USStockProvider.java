package com.koduck.service.market;

import com.koduck.config.properties.FinnhubProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
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
    
    private static final Logger log = LoggerFactory.getLogger(USStockProvider.class);
    private static final ZoneId US_EASTERN = ZoneId.of("America/New_York");
    private static final String PROVIDER_NAME = "finnhub-us-stock";
    
    private final FinnhubProperties properties;
    private final RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    
    // Fallback to mock data when API is not available
    private final MockDataProvider mockProvider;
    
    public USStockProvider(FinnhubProperties properties, RestTemplate finnhubRestTemplate) {
        this.properties = properties;
        this.restTemplate = finnhubRestTemplate;
        this.mockProvider = new MockDataProvider();
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
            log.debug("Finnhub not configured, using mock data for kline");
            return mockProvider.getKlineData(symbol, timeframe, limit, startTime, endTime);
        }
        
        try {
            String resolution = mapTimeframe(timeframe);
            
            long from = startTime != null ? startTime.getEpochSecond() : 
                       Instant.now().minusSeconds(86400 * 30).getEpochSecond();
            long to = endTime != null ? endTime.getEpochSecond() : Instant.now().getEpochSecond();
            
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/stock/candle")
                    .queryParam("symbol", symbol.toUpperCase(Locale.ROOT))
                    .queryParam("resolution", resolution)
                    .queryParam("from", from)
                    .queryParam("to", to)
                    .queryParam("token", properties.getApiKey())
                    .toUriString();
            
            log.debug("Fetching kline from Finnhub: symbol={}, resolution={}", symbol, resolution);
            
            ResponseEntity<CandleResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    CandleResponse.class
            );
            
            CandleResponse body = response.getBody();
            if (body == null || body.s == null || !body.s.equals("ok")) {
                throw new MarketDataException("Invalid response from Finnhub: " + 
                    (body != null ? body.s : "null"));
            }
            
            return convertToKlineData(body, symbol.toUpperCase(Locale.ROOT), timeframe, limit);
            
        } catch (RestClientException e) {
            log.error("Failed to fetch kline from Finnhub: {}", e.getMessage());
            // Fallback to mock data
            return mockProvider.getKlineData(symbol, timeframe, limit, startTime, endTime);
        }
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!properties.isReady()) {
            log.debug("Finnhub not configured, using mock data for tick");
            return mockProvider.getRealTimeTick(symbol);
        }
        
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/quote")
                    .queryParam("symbol", symbol.toUpperCase(Locale.ROOT))
                    .queryParam("token", properties.getApiKey())
                    .toUriString();
            
            log.debug("Fetching quote from Finnhub: symbol={}", symbol);
            
            ResponseEntity<QuoteResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
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
                .timestamp(Instant.ofEpochSecond(quote.t))
                .price(BigDecimal.valueOf(quote.c)) // Current price
                .change(BigDecimal.valueOf(quote.d)) // Change
                .changePercent(BigDecimal.valueOf(quote.dp)) // Change percent
                .open(BigDecimal.valueOf(quote.o))
                .dayHigh(BigDecimal.valueOf(quote.h))
                .dayLow(BigDecimal.valueOf(quote.l))
                .prevClose(BigDecimal.valueOf(quote.pc))
                .volume(null) // Quote doesn't provide volume
                .build();
            
            return Optional.of(tickData);
            
        } catch (RestClientException e) {
            log.error("Failed to fetch quote from Finnhub: {}", e.getMessage());
            // Fallback to mock data
            return mockProvider.getRealTimeTick(symbol);
        }
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        symbols.forEach(sym -> subscribedSymbols.add(sym.toUpperCase(Locale.ROOT)));
        log.info("Subscribed to {} US stocks for real-time data", symbols.size());
        
        // Finnhub WebSocket requires separate connection
        // For now, just track subscriptions
        // In production, implement WebSocket connection to wss://ws.finnhub.io
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(sym.toUpperCase(Locale.ROOT)));
        log.info("Unsubscribed from {} US stocks", symbols.size());
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
                    .queryParam("token", properties.getApiKey())
                    .toUriString();
            
            ResponseEntity<SearchResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    SearchResponse.class
            );
            
            SearchResponse body = response.getBody();
            if (body == null || body.result == null) {
                return Collections.emptyList();
            }
            
            return body.result.stream()
                    .filter(r -> r.type != null && r.type.equals("Common Stock"))
                    .limit(limit)
                    .map(r -> new SymbolInfo(
                        r.symbol,
                        r.description,
                        MarketType.US_STOCK.getCode(),
                        r.exchange != null ? r.exchange : "NASDAQ",
                        "stock"
                    ))
                    .toList();
                    
        } catch (RestClientException e) {
            log.error("Failed to search symbols from Finnhub: {}", e.getMessage());
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
        
        if (response.t == null || response.t.isEmpty()) {
            return klines;
        }
        
        int count = Math.min(response.t.size(), limit);
        for (int i = 0; i < count; i++) {
            klines.add(KlineData.builder()
                .symbol(symbol)
                .market(MarketType.US_STOCK.getCode())
                .timestamp(Instant.ofEpochSecond(response.t.get(i)))
                .open(BigDecimal.valueOf(response.o.get(i)))
                .high(BigDecimal.valueOf(response.h.get(i)))
                .low(BigDecimal.valueOf(response.l.get(i)))
                .close(BigDecimal.valueOf(response.c.get(i)))
                .volume(response.v.get(i))
                .amount(BigDecimal.valueOf(response.c.get(i) * response.v.get(i)))
                .timeframe(timeframe)
                .build());
        }
        
        return klines;
    }
    
    private boolean isMarketHoliday(LocalDate date) {
        int month = date.getMonthValue();
        int day = date.getDayOfMonth();
        DayOfWeek dow = date.getDayOfWeek();
        
        // New Year's Day (observed)
        if (month == 1 && (day == 1 || (day == 2 && dow == DayOfWeek.MONDAY))) {
            return true;
        }
        
        // Independence Day
        if (month == 7 && (day == 4 || (day == 3 && dow == DayOfWeek.FRIDAY) || 
            (day == 5 && dow == DayOfWeek.MONDAY))) {
            return true;
        }
        
        // Christmas
        if (month == 12 && (day == 25 || (day == 24 && dow == DayOfWeek.FRIDAY) ||
            (day == 26 && dow == DayOfWeek.MONDAY))) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Get subscribed symbols
     */
    public Set<String> getSubscribedSymbols() {
        return new HashSet<>(subscribedSymbols);
    }
    
    // Finnhub API Response Classes
    
    static class CandleResponse {
        public String s; // Status: "ok" or "no_data"
        public List<Long> t; // Timestamps
        public List<Double> o; // Open prices
        public List<Double> h; // High prices
        public List<Double> l; // Low prices
        public List<Double> c; // Close prices
        public List<Long> v; // Volumes
    }
    
    static class QuoteResponse {
        public double c;  // Current price
        public double d;  // Change
        public double dp; // Change percent
        public double h;  // High
        public double l;  // Low
        public double o;  // Open
        public double pc; // Previous close
        public long t;    // Timestamp
    }
    
    static class SearchResponse {
        public int count;
        public List<SearchResult> result;
    }
    
    static class SearchResult {
        public String description;
        public String displaySymbol;
        public String symbol;
        public String type;
        public String exchange;
    }
    
    /**
     * Mock data provider for fallback when API is not available
     */
    private static class MockDataProvider {
        private final Map<String, BigDecimal> basePrices = new HashMap<>();
        
        MockDataProvider() {
            basePrices.put("AAPL", new BigDecimal("175.50"));
            basePrices.put("MSFT", new BigDecimal("420.00"));
            basePrices.put("GOOGL", new BigDecimal("165.00"));
            basePrices.put("AMZN", new BigDecimal("180.00"));
            basePrices.put("TSLA", new BigDecimal("240.00"));
            basePrices.put("META", new BigDecimal("500.00"));
            basePrices.put("NVDA", new BigDecimal("880.00"));
            basePrices.put("AMD", new BigDecimal("180.00"));
            basePrices.put("INTC", new BigDecimal("45.00"));
            basePrices.put("NFLX", new BigDecimal("600.00"));
        }
        
        boolean isAvailable() {
            return true;
        }
        
        int getHealthScore() {
            return 50;
        }
        
        List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                      Instant startTime, Instant endTime) {
            List<KlineData> klines = new ArrayList<>();
            BigDecimal basePrice = basePrices.getOrDefault(symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));
            
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
                
                long volume = (long) (Math.random() * 9900000 + 100000);
                
                klines.add(KlineData.builder()
                    .symbol(symbol.toUpperCase(Locale.ROOT))
                    .market(MarketType.US_STOCK.getCode())
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
        
        Optional<TickData> getRealTimeTick(String symbol) {
            BigDecimal basePrice = basePrices.getOrDefault(symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));
            
            double changePercent = (Math.random() - 0.5) * 0.02;
            BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
            BigDecimal change = price.subtract(basePrice);
            BigDecimal changePercentValue = change.divide(basePrice, 4, BigDecimal.ROUND_HALF_UP)
                                                  .multiply(BigDecimal.valueOf(100));
            
            long volume = (long) (Math.random() * 49000000 + 1000000);
            
            TickData tickData = TickData.builder()
                .symbol(symbol.toUpperCase(Locale.ROOT))
                .market(MarketType.US_STOCK.getCode())
                .timestamp(Instant.now())
                .price(price)
                .change(change)
                .changePercent(changePercentValue)
                .volume(volume)
                .amount(price.multiply(BigDecimal.valueOf(volume)))
                .bidPrice(price.multiply(BigDecimal.valueOf(0.999)))
                .bidVolume((long) (Math.random() * 9900 + 100))
                .askPrice(price.multiply(BigDecimal.valueOf(1.001)))
                .askVolume((long) (Math.random() * 9900 + 100))
                .dayHigh(price.multiply(BigDecimal.valueOf(1.02)))
                .dayLow(price.multiply(BigDecimal.valueOf(0.98)))
                .open(basePrice)
                .prevClose(basePrice)
                .build();
            
            return Optional.of(tickData);
        }
        
        List<SymbolInfo> searchSymbols(String keyword, int limit) {
            List<SymbolInfo> results = new ArrayList<>();
            String upperKeyword = keyword.toUpperCase(Locale.ROOT);
            
            Map<String, String> usStocks = Map.of(
                "AAPL", "Apple Inc.",
                "MSFT", "Microsoft Corporation",
                "GOOGL", "Alphabet Inc.",
                "AMZN", "Amazon.com Inc.",
                "TSLA", "Tesla Inc.",
                "META", "Meta Platforms Inc.",
                "NVDA", "NVIDIA Corporation",
                "AMD", "Advanced Micro Devices",
                "INTC", "Intel Corporation",
                "NFLX", "Netflix Inc."
            );
            
            usStocks.entrySet().stream()
                .filter(e -> e.getKey().contains(upperKeyword) || 
                            e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
                .limit(limit)
                .forEach(e -> results.add(new SymbolInfo(
                    e.getKey(),
                    e.getValue(),
                    MarketType.US_STOCK.getCode(),
                    "NASDAQ",
                    "stock"
                )));
            
            return results;
        }
        
        Duration parseTimeframe(String timeframe) {
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
    }
}
