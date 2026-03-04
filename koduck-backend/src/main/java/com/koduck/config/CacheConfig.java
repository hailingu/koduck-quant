package com.koduck.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Objects;

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
    
    public static final String CACHE_KLINE = "kline";
    public static final String CACHE_PRICE = "price";
    public static final String CACHE_MARKET_SEARCH = "marketSearch";
    public static final String CACHE_STOCK_DETAIL = "stockDetail";
    public static final String CACHE_MARKET_INDICES = "marketIndices";
    public static final String CACHE_HOT_STOCKS = "hotStocks";
    
/**
     * Build a {@link GenericJackson2JsonRedisSerializer} with support for Java
     * time types.
     *
     * @return configured serializer instance (never {@code null})
     */
    private GenericJackson2JsonRedisSerializer createJsonSerializer() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        return new GenericJackson2JsonRedisSerializer(objectMapper);
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

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofMinutes(5)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)))
                .disableCachingNullValues();
        
        RedisCacheConfiguration klineConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofMinutes(1)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        RedisCacheConfiguration priceConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofSeconds(30)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        RedisCacheConfiguration marketSearchConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofMinutes(5)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        RedisCacheConfiguration stockDetailConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofSeconds(30)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        RedisCacheConfiguration marketIndicesConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofSeconds(30)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        RedisCacheConfiguration hotStocksConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Objects.requireNonNull(Duration.ofMinutes(1)))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(Objects.requireNonNull(jsonSerializer)));
        
        return RedisCacheManager.builder(Objects.requireNonNull(connectionFactory))
                .cacheDefaults(defaultConfig)
                .withCacheConfiguration(CACHE_KLINE, klineConfig)
                .withCacheConfiguration(CACHE_PRICE, priceConfig)
                .withCacheConfiguration(CACHE_MARKET_SEARCH, marketSearchConfig)
                .withCacheConfiguration(CACHE_STOCK_DETAIL, stockDetailConfig)
                .withCacheConfiguration(CACHE_MARKET_INDICES, marketIndicesConfig)
                .withCacheConfiguration(CACHE_HOT_STOCKS, hotStocksConfig)
                .build();
    }
}
