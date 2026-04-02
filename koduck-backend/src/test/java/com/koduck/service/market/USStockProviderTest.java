package com.koduck.service.market;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

/**
 * Unit tests for USStockProvider.
 *
 * @author GitHub Copilot
 */
class USStockProviderTest {

    /** Default health score when provider is not configured. */
    private static final int DEFAULT_HEALTH_SCORE = 50;

    /** Full health score when provider is fully configured. */
    private static final int FULL_HEALTH_SCORE = 100;

    /** Default kline data size for tests. */
    private static final int DEFAULT_KLINE_SIZE = 10;

    /** Number of symbols to subscribe for tests. */
    private static final int SUBSCRIBE_SYMBOL_COUNT = 3;

    /** Kline size for timeframe tests. */
    private static final int TIMEFRAME_KLINE_SIZE = 5;

    /** Symbol for testing. */
    private static final String TEST_SYMBOL = "AAPL";

    /** Provider under test. */
    private USStockProvider provider;

    /** Finnhub configuration properties. */
    private FinnhubProperties properties;

    /** REST template for HTTP requests. */
    private RestTemplate restTemplate;

    /**
     * Set up test fixtures.
     */
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
        // When not configured, should return mock provider score
        assertEquals(DEFAULT_HEALTH_SCORE, provider.getHealthScore());

        // When configured but no API key
        properties.setEnabled(true);
        assertEquals(DEFAULT_HEALTH_SCORE, provider.getHealthScore());

        // When fully configured
        properties.setEnabled(true);
        properties.setApiKey("test-api-key");
        assertEquals(FULL_HEALTH_SCORE, provider.getHealthScore());
    }

    @Test
    void testGetKlineData() throws Exception {
        List<KlineData> klines = provider.getKlineData(
            TEST_SYMBOL, "1d", DEFAULT_KLINE_SIZE, null, null);

        assertNotNull(klines);
        assertEquals(DEFAULT_KLINE_SIZE, klines.size());

        // Check first kline
        KlineData first = klines.get(0);
        assertEquals(TEST_SYMBOL, first.symbol());
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
        Optional<TickData> tick = provider.getRealTimeTick(TEST_SYMBOL);

        assertTrue(tick.isPresent());
        assertEquals(TEST_SYMBOL, tick.get().symbol());
        assertEquals(MarketType.US_STOCK.getCode(), tick.get().market());
        assertNotNull(tick.get().price());
        assertNotNull(tick.get().timestamp());
    }

    @Test
    void testSearchSymbols() {
        List<MarketDataProvider.SymbolInfo> results = provider.searchSymbols(
            TEST_SYMBOL, DEFAULT_KLINE_SIZE);

        assertNotNull(results);
        assertFalse(results.isEmpty());
        assertTrue(results.stream().anyMatch(s -> s.symbol().equals(TEST_SYMBOL)));
    }

    @Test
    void testSearchSymbolsPartialMatch() {
        List<MarketDataProvider.SymbolInfo> results = provider.searchSymbols(
            "APP", DEFAULT_KLINE_SIZE);

        assertNotNull(results);
        assertFalse(results.isEmpty());
    }

    @Test
    void testSubscribeAndUnsubscribe() throws Exception {
        List<String> symbols = List.of("AAPL", "MSFT", "GOOGL");

        provider.subscribeRealTime(symbols, tickData -> { });
        assertEquals(SUBSCRIBE_SYMBOL_COUNT, provider.getSubscribedSymbols().size());

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
        assertTrue(status == MarketDataProvider.MarketStatus.OPEN
                || status == MarketDataProvider.MarketStatus.CLOSED
                || status == MarketDataProvider.MarketStatus.PRE_MARKET
                || status == MarketDataProvider.MarketStatus.POST_MARKET);
    }

    @Test
    void testSymbolNormalization() throws Exception {
        // Test lowercase symbol normalization
        List<KlineData> klines = provider.getKlineData("aapl", "1d", 1, null, null);
        assertEquals(TEST_SYMBOL, klines.get(0).symbol());
    }

    @Test
    void testDifferentTimeframes() throws Exception {
        String[] timeframes = {"1m", "5m", "15m", "30m", "1h", "1d"};

        for (String tf : timeframes) {
            List<KlineData> klines = provider.getKlineData(
                TEST_SYMBOL, tf, TIMEFRAME_KLINE_SIZE, null, null);
            assertEquals(TIMEFRAME_KLINE_SIZE, klines.size(),
                "Failed for timeframe: " + tf);
            assertEquals(tf, klines.get(0).timeframe());
        }
    }
}
