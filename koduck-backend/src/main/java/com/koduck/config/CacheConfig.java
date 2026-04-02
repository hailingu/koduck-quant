package com.koduck.config;
import java.time.Duration;
import java.util.Objects;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Configuration for Redis-backed caching.
 * <p>
 * Defines multiple named caches with tailored time-to-live settings
 * and JSON serialization support.  Null-safety guards are applied to
 * durations, serializers, and the connection factory to satisfy
 * {@code @NonNull} contracts and suppress static analysis warnings.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Cache name for K-line data snapshots.
     */
    public static final String CACHE_KLINE = "kline";
    /**
     * Cache name for latest price lookups.
     */
    public static final String CACHE_PRICE = "price";
    /**
     * Cache name for market search results.
     */
    public static final String CACHE_MARKET_SEARCH = "marketSearch";
    /**
     * Cache name for stock detail payloads.
     */
    public static final String CACHE_STOCK_DETAIL = "stockDetail";
    /**
     * Cache name for major market index quotes.
     */
    public static final String CACHE_MARKET_INDICES = "marketIndices";
    /**
     * Cache name for stock industry metadata lookups.
     */
    public static final String CACHE_STOCK_INDUSTRY = "stockIndustry";
    /**
     * Cache name for hot stocks list responses.
     */
    public static final String CACHE_HOT_STOCKS = "hotStocks";
    /**
     * Cache name for portfolio summary.
     */
    public static final String CACHE_PORTFOLIO_SUMMARY = "portfolioSummary";

    /**
     * Default time-to-live for short-lived caches (30 seconds).
     */
    private static final Duration TTL_30_SECONDS = Duration.ofSeconds(30);

    /**
     * Time-to-live representing one minute; used for hot-stock and kline caches.
     */
    private static final Duration TTL_1_MINUTE = Duration.ofMinutes(1);

    /**
     * Time-to-live representing five minutes; used for market search caches.
     */
    private static final Duration TTL_5_MINUTES = Duration.ofMinutes(5);

    /**
     * Time-to-live representing one hour; used for portfolio summary cache.
     */
    private static final Duration TTL_1_HOUR = Duration.ofHours(1);


    /**
     * Construct a JSON serializer that understands Java time types.
     *
     * <p>The serializer is backed by a custom {@link ObjectMapper} which
     * registers the {@link JavaTimeModule} so that {@code java.time} objects
     * are handled correctly when caching.</p>
     *
     * @return a non-null JSON serializer instance
     */
    private static GenericJackson2JsonRedisSerializer createJsonSerializer() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        return new GenericJackson2JsonRedisSerializer(objectMapper);
    }
 
    /**
     * Utility factory for {@link RedisCacheConfiguration}.
     *
     * @param ttl                 desired entry time-to-live (must be non-null)
     * @param jsonSerializer      serializer for cache values (must be non-null)
     * @param disableCachingNullValues when {@code true} calls
     *                                  {@code disableCachingNullValues()} on the
     *                                  configuration
     * @return configured cache configuration instance
     */
    private static RedisCacheConfiguration buildCacheConfiguration(
                        Duration ttl,
                        GenericJackson2JsonRedisSerializer jsonSerializer,
                        boolean disableCachingNullValues) {
                RedisCacheConfiguration configuration = RedisCacheConfiguration.defaultCacheConfig()
                                .entryTtl(Objects.requireNonNull(ttl))
                                .serializeKeysWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(new StringRedisSerializer()))
                                .serializeValuesWith(RedisSerializationContext.SerializationPair
                                                .fromSerializer(Objects.requireNonNull(jsonSerializer)));

                if (disableCachingNullValues) {
                        return configuration.disableCachingNullValues();
                }
                return configuration;
        }

    /**
     * Spring bean that constructs the {@link RedisCacheManager} used by the
     * application for caching.  Several named cache configurations are
     * registered with different TTLs.
     *
     * @param connectionFactory Redis connection factory (injected by Spring,
     *                          must not be {@code null})
     * @return cache manager instance
     */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        GenericJackson2JsonRedisSerializer jsonSerializer = createJsonSerializer();

        RedisCacheConfiguration defaultConfig = buildCacheConfiguration(TTL_5_MINUTES, jsonSerializer, true);
        RedisCacheConfiguration klineConfig = buildCacheConfiguration(TTL_1_MINUTE, jsonSerializer, false);
        RedisCacheConfiguration priceConfig = buildCacheConfiguration(TTL_30_SECONDS, jsonSerializer, false);
        RedisCacheConfiguration marketSearchConfig = buildCacheConfiguration(TTL_5_MINUTES, jsonSerializer, false);
        RedisCacheConfiguration stockDetailConfig = buildCacheConfiguration(TTL_30_SECONDS, jsonSerializer, false);
        RedisCacheConfiguration marketIndicesConfig = buildCacheConfiguration(TTL_30_SECONDS, jsonSerializer, false);
        RedisCacheConfiguration stockIndustryConfig = buildCacheConfiguration(TTL_5_MINUTES, jsonSerializer, false);
        RedisCacheConfiguration hotStocksConfig = buildCacheConfiguration(TTL_1_MINUTE, jsonSerializer, false);
        RedisCacheConfiguration portfolioSummaryConfig = buildCacheConfiguration(TTL_1_HOUR, jsonSerializer, false);

        return RedisCacheManager.builder(Objects.requireNonNull(connectionFactory))
            .cacheDefaults(Objects.requireNonNull(defaultConfig))
            .withCacheConfiguration(CACHE_KLINE, Objects.requireNonNull(klineConfig))
            .withCacheConfiguration(CACHE_PRICE, Objects.requireNonNull(priceConfig))
            .withCacheConfiguration(CACHE_MARKET_SEARCH, Objects.requireNonNull(marketSearchConfig))
            .withCacheConfiguration(CACHE_STOCK_DETAIL, Objects.requireNonNull(stockDetailConfig))
            .withCacheConfiguration(CACHE_MARKET_INDICES, Objects.requireNonNull(marketIndicesConfig))
            .withCacheConfiguration(CACHE_STOCK_INDUSTRY, Objects.requireNonNull(stockIndustryConfig))
            .withCacheConfiguration(CACHE_HOT_STOCKS, Objects.requireNonNull(hotStocksConfig))
            .withCacheConfiguration(CACHE_PORTFOLIO_SUMMARY, Objects.requireNonNull(portfolioSummaryConfig))
                .build();
    }
}
