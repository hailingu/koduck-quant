package com.koduck.market.provider;

import com.koduck.market.MarketType;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Factory for managing and retrieving market data providers.
 * Implements a fallback strategy when primary provider fails.
 */
@Component
public class ProviderFactory {
    
    private final Map<MarketType, List<MarketDataProvider>> providersByMarket = new ConcurrentHashMap<>();
    private final Map<String, MarketDataProvider> providersByName = new ConcurrentHashMap<>();
    private final Map<MarketType, MarketDataProvider> primaryProviders = new ConcurrentHashMap<>();
    
    /**
     * Register a provider
     * 
     * @param provider the provider to register
     */
    public void registerProvider(MarketDataProvider provider) {
        MarketType marketType = provider.getMarketType();
        String providerName = provider.getProviderName();
        
        // Add to name map
        providersByName.put(providerName, provider);
        
        // Add to market map
        providersByMarket.computeIfAbsent(marketType, k -> new CopyOnWriteArrayList<>())
                        .add(provider);
        
        // Set as primary if no primary exists for this market
        primaryProviders.putIfAbsent(marketType, provider);
    }
    
    /**
     * Unregister a provider
     * 
     * @param providerName the name of provider to unregister
     */
    public void unregisterProvider(String providerName) {
        MarketDataProvider provider = providersByName.remove(providerName);
        if (provider != null) {
            MarketType marketType = provider.getMarketType();
            List<MarketDataProvider> providers = providersByMarket.get(marketType);
            if (providers != null) {
                providers.remove(provider);
                if (providers.isEmpty()) {
                    providersByMarket.remove(marketType);
                }
            }
            
            // Update primary if needed
            if (primaryProviders.get(marketType) == provider) {
                List<MarketDataProvider> remaining = providersByMarket.get(marketType);
                if (remaining != null && !remaining.isEmpty()) {
                    primaryProviders.put(marketType, remaining.get(0));
                } else {
                    primaryProviders.remove(marketType);
                }
            }
        }
    }
    
    /**
     * Get provider by name
     * 
     * @param providerName the provider name
     * @return Optional of provider
     */
    public Optional<MarketDataProvider> getProvider(String providerName) {
        return Optional.ofNullable(providersByName.get(providerName));
    }
    
    /**
     * Get primary provider for a market
     * 
     * @param marketType the market type
     * @return Optional of primary provider
     */
    public Optional<MarketDataProvider> getPrimaryProvider(MarketType marketType) {
        return Optional.ofNullable(primaryProviders.get(marketType));
    }
    
    /**
     * Get all providers for a market
     * 
     * @param marketType the market type
     * @return list of providers (may be empty)
     */
    public List<MarketDataProvider> getProviders(MarketType marketType) {
        List<MarketDataProvider> providers = providersByMarket.get(marketType);
        if (providers == null || providers.isEmpty()) {
            return Collections.emptyList();
        }
        return List.copyOf(providers);
    }
    
    /**
     * Get available (healthy) provider for a market with fallback
     * 
     * @param marketType the market type
     * @return Optional of available provider
     */
    public Optional<MarketDataProvider> getAvailableProvider(MarketType marketType) {
        List<MarketDataProvider> providers = providersByMarket.get(marketType);
        if (providers == null || providers.isEmpty()) {
            return Optional.empty();
        }
        
        // Return first available provider
        return providers.stream()
                       .filter(MarketDataProvider::isAvailable)
                       .findFirst();
    }
    
    /**
     * Set primary provider for a market
     * 
     * @param marketType the market type
     * @param providerName the provider name
     * @throws IllegalArgumentException if provider not found
     */
    public void setPrimaryProvider(MarketType marketType, String providerName) {
        MarketDataProvider provider = providersByName.get(providerName);
        if (provider == null) {
            throw new IllegalArgumentException("Provider not found: " + providerName);
        }
        if (provider.getMarketType() != marketType) {
            throw new IllegalArgumentException("Provider does not support market: " + marketType);
        }
        primaryProviders.put(marketType, provider);
    }
    
    /**
     * Get all registered market types
     * 
     * @return set of market types
     */
    public Set<MarketType> getSupportedMarkets() {
        return new HashSet<>(providersByMarket.keySet());
    }
    
    /**
     * Get all provider names
     * 
     * @return set of provider names
     */
    public Set<String> getProviderNames() {
        return new HashSet<>(providersByName.keySet());
    }
    
    /**
     * Get provider health summary
     * 
     * @return map of provider name to health info
     */
    public Map<String, ProviderHealthInfo> getProviderHealthSummary() {
        Map<String, ProviderHealthInfo> healthMap = new HashMap<>();
        
        for (Map.Entry<String, MarketDataProvider> entry : providersByName.entrySet()) {
            MarketDataProvider provider = entry.getValue();
            boolean isPrimary = provider.equals(primaryProviders.get(provider.getMarketType()));
            
            healthMap.put(entry.getKey(), new ProviderHealthInfo(
                provider.getProviderName(),
                provider.getMarketType(),
                provider.isAvailable(),
                provider.getHealthScore(),
                isPrimary
            ));
        }
        
        return healthMap;
    }
    
    /**
     * Check if a market is supported
     * 
     * @param marketType the market type
     * @return true if supported
     */
    public boolean isMarketSupported(MarketType marketType) {
        return providersByMarket.containsKey(marketType);
    }
    
    /**
     * Clear all providers
     */
    public void clear() {
        providersByName.clear();
        providersByMarket.clear();
        primaryProviders.clear();
    }
    
    /**
     * Provider health information
     */
    public record ProviderHealthInfo(
        String providerName,
        MarketType marketType,
        boolean available,
        int healthScore,
        boolean isPrimary
    ) {}
}
