package com.koduck.service.market;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * US Stock market data provider.
 * Supports US equities with pre-market and after-hours trading.
 * 
 * Trading Hours (Eastern Time):
 * - Pre-market: 04:00 - 09:30
 * - Regular: 09:30 - 16:00
 * - After-hours: 16:00 - 20:00
 */
@Component
public class USStockProvider implements MarketDataProvider {
    
    private static final Logger log = LoggerFactory.getLogger(USStockProvider.class);
    private static final ZoneId US_EASTERN = ZoneId.of("America/New_York");
    
    private final String providerName = "us-stock-yahoo";
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();
    private volatile boolean available = true;
    private volatile int healthScore = 100;
    
    // Cache for mock data generation (consistent prices per symbol)
    private final Map<String, BigDecimal> basePrices = new ConcurrentHashMap<>();
    
    public USStockProvider() {
        // Initialize base prices for common US stocks
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
    
    @Override
    public String getProviderName() {
        return providerName;
    }
    
    @Override
    public MarketType getMarketType() {
        return MarketType.US_STOCK;
    }
    
    @Override
    public boolean isAvailable() {
        return available;
    }
    
    @Override
    public int getHealthScore() {
        return healthScore;
    }
    
    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                         Instant startTime, Instant endTime) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        log.debug("Getting kline data for US stock: symbol={}, timeframe={}, limit={}", 
                symbol, timeframe, limit);
        
        // Normalize symbol
        String normalizedSymbol = normalizeSymbol(symbol);
        
        // Generate mock kline data
        List<KlineData> klines = new ArrayList<>();
        BigDecimal basePrice = getBasePrice(normalizedSymbol);
        
        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = parseTimeframe(timeframe);
        
        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            // Generate random price movement (-2% to +2%)
            double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.04;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);
            
            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + ThreadLocalRandom.current().nextDouble() * 0.01));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - ThreadLocalRandom.current().nextDouble() * 0.01));
            BigDecimal open = currentPrice;
            
            long volume = ThreadLocalRandom.current().nextLong(100000, 10000000);
            
            klines.add(KlineData.builder()
                .symbol(normalizedSymbol)
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
        
        // Reverse to have oldest first
        Collections.reverse(klines);
        return klines;
    }
    
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = getBasePrice(normalizedSymbol);
        
        // Generate random current price
        double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.02;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, 4, BigDecimal.ROUND_HALF_UP)
                                              .multiply(BigDecimal.valueOf(100));
        
        long volume = ThreadLocalRandom.current().nextLong(1000000, 50000000);
        
        TickData tickData = TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.US_STOCK.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.multiply(BigDecimal.valueOf(0.999)))
            .bidVolume(ThreadLocalRandom.current().nextLong(100, 10000))
            .askPrice(price.multiply(BigDecimal.valueOf(1.001)))
            .askVolume(ThreadLocalRandom.current().nextLong(100, 10000))
            .dayHigh(price.multiply(BigDecimal.valueOf(1.02)))
            .dayLow(price.multiply(BigDecimal.valueOf(0.98)))
            .open(basePrice)
            .prevClose(basePrice)
            .build();
        
        return Optional.of(tickData);
    }
    
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback) 
            throws MarketDataException {
        
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }
        
        symbols.forEach(sym -> subscribedSymbols.add(normalizeSymbol(sym)));
        log.info("Subscribed to {} US stocks for real-time data", symbols.size());
        
        // In production, this would establish WebSocket connection
        // For now, just track subscriptions
    }
    
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        symbols.forEach(sym -> subscribedSymbols.remove(normalizeSymbol(sym)));
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
        
        // Market holidays (simplified - would need a proper calendar)
        if (isMarketHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }
        
        // Trading hours (Eastern Time)
        // Pre-market: 04:00 - 09:30
        // Regular: 09:30 - 16:00
        // After-hours: 16:00 - 20:00
        
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
        // Mock search results for US stocks
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase();
        
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
                        e.getValue().toUpperCase().contains(upperKeyword))
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
    
    /**
     * Get subscribed symbols
     */
    public Set<String> getSubscribedSymbols() {
        return new HashSet<>(subscribedSymbols);
    }
    
    /**
     * Set provider availability
     */
    public void setAvailable(boolean available) {
        this.available = available;
        if (!available) {
            this.healthScore = 0;
        }
    }
    
    /**
     * Set health score
     */
    public void setHealthScore(int score) {
        this.healthScore = Math.max(0, Math.min(100, score));
        this.available = healthScore > 0;
    }
    
    // Helper methods
    
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }
        return symbol.trim().toUpperCase();
    }
    
    private BigDecimal getBasePrice(String symbol) {
        return basePrices.getOrDefault(symbol, new BigDecimal("100.00"));
    }
    
    private Duration parseTimeframe(String timeframe) {
        return switch (timeframe.toLowerCase()) {
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
    
    private boolean isMarketHoliday(LocalDate date) {
        // Simplified holiday check
        // In production, this would check against a proper market calendar
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
}
