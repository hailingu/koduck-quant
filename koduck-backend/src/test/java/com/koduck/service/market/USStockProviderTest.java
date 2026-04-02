package com.koduck.service.market;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import com.koduck.config.properties.FinnhubProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for USStockProvider
 */
class USStockProviderTest {
    
    private USStockProvider provider;
    private FinnhubProperties properties;
    private RestTemplate restTemplate;
    
    @BeforeEach
    void setUp() {
        properties = new FinnhubProperties();
        properties.setEnabled(false); // Use mock data for tests
        restTemplate = new RestTemplate();
        provider = new USStockProvider(properties, restTemplate);
    }
    
    @Test
    void testGetProviderName() {
        assertEquals("finnhub-us-stock", provider.getProviderName());
    }
    
    @Test
    void testGetMarketType() {
        assertEquals(MarketType.US_STOCK, provider.getMarketType());
    }
    
    @Test
    void testIsAvailable() {
        assertTrue(provider.isAvailable());
    }
    
    @Test
    void testGetHealthScore() {
        // When not configured, should return mock provider score (50)
        assertEquals(50, provider.getHealthScore());
        
        // When configured but no API key
        properties.setEnabled(true);
        assertEquals(50, provider.getHealthScore());
        
        // When fully configured
        properties.setEnabled(true);
        properties.setApiKey("test-api-key");
        assertEquals(100, provider.getHealthScore());
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
