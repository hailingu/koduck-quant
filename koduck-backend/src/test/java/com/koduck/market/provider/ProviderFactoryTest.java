package com.koduck.market.provider;

import com.koduck.market.MarketType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ProviderFactory
 */
class ProviderFactoryTest {
    
    private ProviderFactory factory;
    private MarketDataProvider aShareProvider;
    private MarketDataProvider usStockProvider;
    
    @BeforeEach
    void setUp() {
        factory = new ProviderFactory();
        
        // Create mock providers
        aShareProvider = createMockProvider("a-share-mock", MarketType.A_SHARE);
        usStockProvider = createMockProvider("us-stock-mock", MarketType.US_STOCK);
    }
    
    @Test
    void testRegisterAndGetProvider() {
        factory.registerProvider(aShareProvider);
        
        Optional<MarketDataProvider> retrieved = factory.getProvider("a-share-mock");
        assertTrue(retrieved.isPresent());
        assertEquals("a-share-mock", retrieved.get().getProviderName());
    }
    
    @Test
    void testRegisterMultipleProviders() {
        factory.registerProvider(aShareProvider);
        factory.registerProvider(usStockProvider);
        
        Set<String> providerNames = factory.getProviderNames();
        assertEquals(2, providerNames.size());
        assertTrue(providerNames.contains("a-share-mock"));
        assertTrue(providerNames.contains("us-stock-mock"));
    }
    
    @Test
    void testGetPrimaryProvider() {
        factory.registerProvider(aShareProvider);
        
        Optional<MarketDataProvider> primary = factory.getPrimaryProvider(MarketType.A_SHARE);
        assertTrue(primary.isPresent());
        assertEquals(aShareProvider, primary.get());
    }
    
    @Test
    void testGetProvidersByMarket() {
        factory.registerProvider(aShareProvider);
        
        List<MarketDataProvider> providers = factory.getProviders(MarketType.A_SHARE);
        assertEquals(1, providers.size());
        assertEquals(aShareProvider, providers.get(0));
    }
    
    @Test
    void testUnregisterProvider() {
        factory.registerProvider(aShareProvider);
        assertTrue(factory.getProvider("a-share-mock").isPresent());
        
        factory.unregisterProvider("a-share-mock");
        assertFalse(factory.getProvider("a-share-mock").isPresent());
    }
    
    @Test
    void testIsMarketSupported() {
        assertFalse(factory.isMarketSupported(MarketType.A_SHARE));
        
        factory.registerProvider(aShareProvider);
        assertTrue(factory.isMarketSupported(MarketType.A_SHARE));
    }
    
    @Test
    void testGetSupportedMarkets() {
        factory.registerProvider(aShareProvider);
        factory.registerProvider(usStockProvider);
        
        Set<MarketType> markets = factory.getSupportedMarkets();
        assertEquals(2, markets.size());
        assertTrue(markets.contains(MarketType.A_SHARE));
        assertTrue(markets.contains(MarketType.US_STOCK));
    }
    
    @Test
    void testSetPrimaryProvider() {
        MarketDataProvider provider2 = createMockProvider("a-share-mock-2", MarketType.A_SHARE);
        
        factory.registerProvider(aShareProvider);
        factory.registerProvider(provider2);
        
        // Initially first registered is primary
        assertEquals(aShareProvider, factory.getPrimaryProvider(MarketType.A_SHARE).get());
        
        // Change primary
        factory.setPrimaryProvider(MarketType.A_SHARE, "a-share-mock-2");
        assertEquals(provider2, factory.getPrimaryProvider(MarketType.A_SHARE).get());
    }
    
    @Test
    void testSetPrimaryProviderNotFound() {
        assertThrows(IllegalArgumentException.class, () -> {
            factory.setPrimaryProvider(MarketType.A_SHARE, "non-existent");
        });
    }
    
    @Test
    void testSetPrimaryProviderWrongMarket() {
        factory.registerProvider(aShareProvider);
        
        assertThrows(IllegalArgumentException.class, () -> {
            factory.setPrimaryProvider(MarketType.US_STOCK, "a-share-mock");
        });
    }
    
    @Test
    void testGetAvailableProvider() {
        factory.registerProvider(aShareProvider);
        
        Optional<MarketDataProvider> available = factory.getAvailableProvider(MarketType.A_SHARE);
        assertTrue(available.isPresent());
    }
    
    @Test
    void testClear() {
        factory.registerProvider(aShareProvider);
        factory.registerProvider(usStockProvider);
        
        assertFalse(factory.getProviderNames().isEmpty());
        
        factory.clear();
        
        assertTrue(factory.getProviderNames().isEmpty());
        assertTrue(factory.getSupportedMarkets().isEmpty());
    }
    
    @Test
    void testProviderHealthSummary() {
        factory.registerProvider(aShareProvider);
        
        var healthMap = factory.getProviderHealthSummary();
        assertEquals(1, healthMap.size());
        
        var health = healthMap.get("a-share-mock");
        assertNotNull(health);
        assertEquals(MarketType.A_SHARE, health.marketType());
        assertTrue(health.isPrimary());
    }
    
    /**
     * Create a simple mock provider for testing
     */
    private MarketDataProvider createMockProvider(String name, MarketType marketType) {
        return new MarketDataProvider() {
            @Override
            public String getProviderName() {
                return name;
            }
            
            @Override
            public MarketType getMarketType() {
                return marketType;
            }
            
            @Override
            public boolean isAvailable() {
                return true;
            }
            
            @Override
            public java.util.List<com.koduck.market.model.KlineData> getKlineData(
                    String symbol, String timeframe, int limit,
                    java.time.Instant startTime, java.time.Instant endTime) {
                return java.util.Collections.emptyList();
            }
            
            @Override
            public java.util.Optional<com.koduck.market.model.TickData> getRealTimeTick(String symbol) {
                return java.util.Optional.empty();
            }
            
            @Override
            public void subscribeRealTime(java.util.List<String> symbols, RealTimeDataCallback callback) {
            }
            
            @Override
            public void unsubscribeRealTime(java.util.List<String> symbols) {
            }
            
            @Override
            public MarketStatus getMarketStatus() {
                return MarketStatus.OPEN;
            }
            
            @Override
            public java.util.List<SymbolInfo> searchSymbols(String keyword, int limit) {
                return java.util.Collections.emptyList();
            }
        };
    }
}
