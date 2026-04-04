package com.koduck.market.provider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.locks.ReentrantReadWriteLock;

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

    /** Read-write lock to ensure atomicity across multiple maps. */
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    /**
     * Register a provider.
     *
     * @param provider the provider to register
     */
    public void registerProvider(MarketDataProvider provider) {
        lock.writeLock().lock();
        try {
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
        finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Unregister a provider.
     *
     * @param providerName the name of provider to unregister
     */
    public void unregisterProvider(String providerName) {
        lock.writeLock().lock();
        try {
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
        finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Get provider by name.
     *
     * @param providerName the provider name
     * @return Optional of provider
     */
    public Optional<MarketDataProvider> getProvider(String providerName) {
        lock.readLock().lock();
        try {
            return Optional.ofNullable(providersByName.get(providerName));
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get primary provider for a market type.
     *
     * @param marketType the market type
     * @return Optional of primary provider
     */
    public Optional<MarketDataProvider> getPrimaryProvider(MarketType marketType) {
        lock.readLock().lock();
        try {
            return Optional.ofNullable(primaryProviders.get(marketType));
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get all providers for a market type.
     *
     * @param marketType the market type
     * @return list of providers
     */
    public List<MarketDataProvider> getProviders(MarketType marketType) {
        lock.readLock().lock();
        try {
            return providersByMarket.getOrDefault(marketType, Collections.emptyList());
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Set primary provider for a market type.
     *
     * @param marketType   the market type
     * @param providerName the provider name
     * @throws IllegalArgumentException if provider not found or wrong market type
     */
    public void setPrimaryProvider(MarketType marketType, String providerName) {
        lock.writeLock().lock();
        try {
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
        finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Get all registered market types.
     *
     * @return list of market types
     */
    public List<MarketType> getRegisteredMarketTypes() {
        lock.readLock().lock();
        try {
            return new ArrayList<>(providersByMarket.keySet());
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get provider health information.
     *
     * @param marketType the market type
     * @return list of provider health info
     */
    public List<ProviderHealthInfo> getProviderHealthInfo(MarketType marketType) {
        lock.readLock().lock();
        try {
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
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get available provider for a market type.
     *
     * @param marketType the market type
     * @return optional of available provider
     */
    public Optional<MarketDataProvider> getAvailableProvider(MarketType marketType) {
        lock.readLock().lock();
        try {
            List<MarketDataProvider> providers = providersByMarket.get(marketType);
            if (providers == null || providers.isEmpty()) {
                return Optional.empty();
            }

            // Return first available provider
            return providers.stream()
                           .filter(MarketDataProvider::isAvailable)
                           .findFirst();
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Check if a market type is supported.
     *
     * @param marketType the market type
     * @return true if supported
     */
    public boolean isMarketSupported(MarketType marketType) {
        lock.readLock().lock();
        try {
            return providersByMarket.containsKey(marketType);
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get all supported market types.
     *
     * @return set of market types
     */
    public Set<MarketType> getSupportedMarkets() {
        lock.readLock().lock();
        try {
            return new HashSet<>(providersByMarket.keySet());
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get provider health summary for all providers.
     *
     * @return map of provider name to health info
     */
    public Map<String, ProviderHealthInfo> getProviderHealthSummary() {
        lock.readLock().lock();
        try {
            Map<String, ProviderHealthInfo> healthMap = new HashMap<>();

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
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get all provider names.
     *
     * @return set of provider names
     */
    public Set<String> getProviderNames() {
        lock.readLock().lock();
        try {
            return new HashSet<>(providersByName.keySet());
        }
        finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Clear all registrations.
     */
    public void clear() {
        lock.writeLock().lock();
        try {
            providersByName.clear();
            providersByMarket.clear();
            primaryProviders.clear();
        }
        finally {
            lock.writeLock().unlock();
        }
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
