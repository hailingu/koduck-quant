package com.koduck.service.market;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for USStockProvider
 */
class USStockProviderTest {
    
    private USStockProvider provider;
    
    @BeforeEach
    void setUp() {
        provider = new USStockProvider();
        provider.setAvailable(true);
        provider.setHealthScore(100);
    }
    
    @Test
    void testGetProviderName() {
        assertEquals("us-stock-yahoo", provider.getProviderName());
    }
    
    @Test
    void testGetMarketType() {
        assertEquals(MarketType.US_STOCK, provider.getMarketType());
    }
    
    @Test
    void testIsAvailable() {
        assertTrue(provider.isAvailable());
        
        provider.setAvailable(false);
        assertFalse(provider.isAvailable());
    }
    
    @Test
    void testGetHealthScore() {
        assertEquals(100, provider.getHealthScore());
        
        provider.setHealthScore(50);
        assertEquals(50, provider.getHealthScore());
        
        provider.setAvailable(false);
        assertEquals(0, provider.getHealthScore());
    }
    
    @Test
    void testGetKlineData() throws Exception {
        List<KlineData> klines = provider.getKlineData("AAPL", "1d", 10, null, null);
        
        assertNotNull(klines);
        assertEquals(10, klines.size());
        
        // Check first kline
        KlineData first = klines.get(0);
        assertEquals("AAPL", first.symbol());
        assertEquals(MarketType.US_STOCK.getCode(), first.market());
        assertNotNull(first.open());
        assertNotNull(first.high());
        assertNotNull(first.low());
        assertNotNull(first.close());
        assertNotNull(first.volume());
        assertEquals("1d", first.timeframe());
        
        // Verify OHLC logic
        assertTrue(first.high().compareTo(first.low()) >= 0);
    }
    
    @Test
    void testGetRealTimeTick() throws Exception {
        Optional<TickData> tick = provider.getRealTimeTick("AAPL");
        
        assertTrue(tick.isPresent());
        assertEquals("AAPL", tick.get().symbol());
        assertEquals(MarketType.US_STOCK.getCode(), tick.get().market());
        assertNotNull(tick.get().price());
        assertNotNull(tick.get().timestamp());
    }
    
    @Test
    void testSearchSymbols() {
        List<MarketDataProvider.SymbolInfo> results = provider.searchSymbols("AAPL", 10);
        
        assertNotNull(results);
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(s -> s.symbol().equals("AAPL")));
    }
    
    @Test
    void testSearchSymbolsPartialMatch() {
        List<MarketDataProvider.SymbolInfo> results = provider.searchSymbols("APP", 10);
        
        assertNotNull(results);
        assertFalse(results.isEmpty());
    }
    
    @Test
    void testSubscribeAndUnsubscribe() throws Exception {
        List<String> symbols = List.of("AAPL", "MSFT", "GOOGL");
        
        provider.subscribeRealTime(symbols, tickData -> {});
        assertEquals(3, provider.getSubscribedSymbols().size());
        
        provider.unsubscribeRealTime(List.of("AAPL"));
        assertEquals(2, provider.getSubscribedSymbols().size());
        
        provider.unsubscribeRealTime(List.of("MSFT", "GOOGL"));
        assertTrue(provider.getSubscribedSymbols().isEmpty());
    }
    
    @Test
    void testGetMarketStatus() {
        MarketDataProvider.MarketStatus status = provider.getMarketStatus();
        
        assertNotNull(status);
        // Status depends on current time, so just verify it's one of the valid values
        assertTrue(status == MarketDataProvider.MarketStatus.OPEN ||
                   status == MarketDataProvider.MarketStatus.CLOSED ||
                   status == MarketDataProvider.MarketStatus.PRE_MARKET ||
                   status == MarketDataProvider.MarketStatus.POST_MARKET);
    }
    
    @Test
    void testGetKlineDataWhenUnavailable() {
        provider.setAvailable(false);
        
        assertThrows(MarketDataProvider.MarketDataException.class, () -> {
            provider.getKlineData("AAPL", "1d", 10, null, null);
        });
    }
    
    @Test
    void testGetRealTimeTickWhenUnavailable() {
        provider.setAvailable(false);
        
        assertThrows(MarketDataProvider.MarketDataException.class, () -> {
            provider.getRealTimeTick("AAPL");
        });
    }
    
    @Test
    void testSymbolNormalization() throws Exception {
        // Test lowercase symbol normalization
        List<KlineData> klines = provider.getKlineData("aapl", "1d", 1, null, null);
        assertEquals("AAPL", klines.get(0).symbol());
    }
    
    @Test
    void testDifferentTimeframes() throws Exception {
        String[] timeframes = {"1m", "5m", "15m", "30m", "1h", "1d"};
        
        for (String tf : timeframes) {
            List<KlineData> klines = provider.getKlineData("AAPL", tf, 5, null, null);
            assertEquals(5, klines.size(), "Failed for timeframe: " + tf);
            assertEquals(tf, klines.get(0).timeframe());
        }
    }
}
