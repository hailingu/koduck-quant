package com.koduck.market.provider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.springframework.stereotype.Component;

import com.koduck.market.MarketType;

/**
 * Factory for managing and retrieving market data providers.
 * Implements a fallback strategy when primary provider fails.
 *
 * @author Koduck Team
 */
@Component
public class ProviderFactory {

    /** Providers grouped by market type. */
    private final Map<MarketType, List<MarketDataProvider>> providersByMarket =
            new ConcurrentHashMap<>();

    /** Providers indexed by name. */
    private final Map<String, MarketDataProvider> providersByName =
            new ConcurrentHashMap<>();

    /** Primary provider for each market type. */
    private final Map<MarketType, MarketDataProvider> primaryProviders =
            new ConcurrentHashMap<>();

    /**
     * Register a provider.
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
     * Unregister a provider.
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
                }
                else {
                    primaryProviders.remove(marketType);
                }
            }
        }
    }

    /**
     * Get provider by name.
     *
     * @param providerName the provider name
     * @return Optional of provider
     */
    public Optional<MarketDataProvider> getProvider(String providerName) {
        return Optional.ofNullable(providersByName.get(providerName));
    }

    /**
     * Get primary provider for a market type.
     *
     * @param marketType the market type
     * @return Optional of primary provider
     */
    public Optional<MarketDataProvider> getPrimaryProvider(MarketType marketType) {
        return Optional.ofNullable(primaryProviders.get(marketType));
    }

    /**
     * Get all providers for a market type.
     *
     * @param marketType the market type
     * @return list of providers
     */
    public List<MarketDataProvider> getProviders(MarketType marketType) {
        return providersByMarket.getOrDefault(marketType, Collections.emptyList());
    }

    /**
     * Set primary provider for a market type.
     *
     * @param marketType   the market type
     * @param providerName the provider name
     * @throws IllegalArgumentException if provider not found or wrong market type
     */
    public void setPrimaryProvider(MarketType marketType, String providerName) {
        MarketDataProvider provider = providersByName.get(providerName);
        if (provider == null) {
            throw new IllegalArgumentException("Provider not found: " + providerName);
        }
        if (provider.getMarketType() != marketType) {
            throw new IllegalArgumentException(
                "Provider " + providerName + " is not for market type " + marketType);
        }
        primaryProviders.put(marketType, provider);
    }

    /**
     * Get all registered market types.
     *
     * @return list of market types
     */
    public List<MarketType> getRegisteredMarketTypes() {
        return new ArrayList<>(providersByMarket.keySet());
    }

    /**
     * Get provider health information.
     *
     * @param marketType the market type
     * @return list of provider health info
     */
    public List<ProviderHealthInfo> getProviderHealthInfo(MarketType marketType) {
        List<MarketDataProvider> providers = providersByMarket.get(marketType);
        if (providers == null) {
            return Collections.emptyList();
        }

        MarketDataProvider primary = primaryProviders.get(marketType);
        List<ProviderHealthInfo> healthInfo = new ArrayList<>();

        for (MarketDataProvider provider : providers) {
            healthInfo.add(new ProviderHealthInfo(
                provider.getProviderName(),
                marketType,
                provider.isAvailable(),
                provider.getHealthScore(),
                provider == primary
            ));
        }

        return healthInfo;
    }

    /**
     * Get available provider for a market type.
     *
     * @param marketType the market type
     * @return optional of available provider
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
     * Check if a market type is supported.
     *
     * @param marketType the market type
     * @return true if supported
     */
    public boolean isMarketSupported(MarketType marketType) {
        return providersByMarket.containsKey(marketType);
    }

    /**
     * Get all supported market types.
     *
     * @return set of market types
     */
    public Set<MarketType> getSupportedMarkets() {
        return new HashSet<>(providersByMarket.keySet());
    }

    /**
     * Get provider health summary for all providers.
     *
     * @return map of provider name to health info
     */
    public Map<String, ProviderHealthInfo> getProviderHealthSummary() {
        Map<String, ProviderHealthInfo> healthMap = new ConcurrentHashMap<>();

        for (Map.Entry<String, MarketDataProvider> entry : providersByName.entrySet()) {
            String providerName = entry.getKey();
            MarketDataProvider provider = entry.getValue();
            MarketType marketType = provider.getMarketType();
            MarketDataProvider primary = primaryProviders.get(marketType);

            healthMap.put(providerName, new ProviderHealthInfo(
                providerName,
                marketType,
                provider.isAvailable(),
                provider.getHealthScore(),
                provider == primary
            ));
        }

        return healthMap;
    }

    /**
     * Get all provider names.
     *
     * @return set of provider names
     */
    public Set<String> getProviderNames() {
        return new HashSet<>(providersByName.keySet());
    }

    /**
     * Clear all registrations.
     */
    public void clear() {
        providersByName.clear();
        providersByMarket.clear();
        primaryProviders.clear();
    }

    /**
     * Provider health information.
     *
     * @param providerName the provider name
     * @param marketType   the market type
     * @param available    whether the provider is available
     * @param healthScore  the health score
     * @param isPrimary    whether this is the primary provider
     */
    public record ProviderHealthInfo(
        String providerName,
        MarketType marketType,
        boolean available,
        int healthScore,
        boolean isPrimary
    ) {
    }
}
