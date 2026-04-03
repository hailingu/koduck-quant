package com.koduck.config;

import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.cache.RedisCacheWriter;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import com.koduck.config.properties.CacheProperties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Unit tests for {@link CacheConfig}.
 *
 * <p>Verifies cache name registration and per-cache TTL settings configured in
 * {@link CacheConfig#cacheManager(RedisConnectionFactory)}.</p>
 *
 * @author Koduck Team
 */
class CacheConfigTest {

    /** TTL for 30 seconds. */
    private static final Duration TTL_30_SECONDS = Duration.ofSeconds(30);

    /** TTL for 1 minute. */
    private static final Duration TTL_1_MINUTE = Duration.ofMinutes(1);

    /** TTL for 5 minutes. */
    private static final Duration TTL_5_MINUTES = Duration.ofMinutes(5);

    /** TTL for 1 hour. */
    private static final Duration TTL_1_HOUR = Duration.ofHours(1);

    /**
     * Extracts the TTL from a cache configuration by invoking the
     * {@link RedisCacheWriter.TtlFunction} with dummy key/value arguments.
     *
     * @param configuration cache configuration to inspect
     * @return the configured time-to-live duration
     */
    private Duration resolveTtl(RedisCacheConfiguration configuration) {
        RedisCacheWriter.TtlFunction ttlFunction = configuration.getTtlFunction();
        return ttlFunction.getTimeToLive("test-key", "test-value");
    }

    /**
     * Ensures that the cache manager produced by {@link CacheConfig} contains
     * entries for all expected caches and that each cache has the correct
     * TTL setting as declared by the configuration constants.
     */
    @Test
    @DisplayName("shouldRegisterExpectedCacheNamesAndTtlSettings")
    void shouldRegisterExpectedCacheNamesAndTtlSettings() {
        CacheProperties cacheProperties = new CacheProperties();
        CacheConfig cacheConfig = new CacheConfig(cacheProperties);
        RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);

        RedisCacheManager cacheManager = cacheConfig.cacheManager(connectionFactory);
        cacheManager.afterPropertiesSet();
        Map<String, RedisCacheConfiguration> configurations = cacheManager.getCacheConfigurations();

        assertThat(configurations)
                .containsKeys(
                        CacheConfig.CACHE_KLINE,
                        CacheConfig.CACHE_PRICE,
                        CacheConfig.CACHE_MARKET_SEARCH,
                        CacheConfig.CACHE_STOCK_DETAIL,
                        CacheConfig.CACHE_MARKET_INDICES,
                        CacheConfig.CACHE_HOT_STOCKS,
                        CacheConfig.CACHE_PORTFOLIO_SUMMARY
            );

        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_KLINE))).isEqualTo(TTL_1_MINUTE);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_PRICE))).isEqualTo(TTL_30_SECONDS);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_MARKET_SEARCH))).isEqualTo(TTL_5_MINUTES);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_STOCK_DETAIL))).isEqualTo(TTL_30_SECONDS);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_MARKET_INDICES))).isEqualTo(TTL_30_SECONDS);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_HOT_STOCKS))).isEqualTo(TTL_1_MINUTE);
        assertThat(resolveTtl(configurations.get(CacheConfig.CACHE_PORTFOLIO_SUMMARY))).isEqualTo(TTL_1_HOUR);
    }
}
