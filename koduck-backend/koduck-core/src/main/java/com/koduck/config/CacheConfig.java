package com.koduck.config;

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

import com.koduck.infrastructure.config.properties.CacheProperties;

/**
 * 基于 Redis 的缓存配置。
 * <p>
 * Defines multiple named caches with tailored time-to-live settings
 * and JSON serialization support.  Null-safety guards are applied to
 * serializers and the connection factory to satisfy
 * {@code @NonNull} contracts and suppress static analysis warnings.
 *
 * @author Koduck
 */
@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * K线数据快照的缓存名称。
     */
    public static final String CACHE_KLINE = "kline";
    /**
     * 最新价格查询的缓存名称。
     */
    public static final String CACHE_PRICE = "price";
    /**
     * 市场搜索结果的缓存名称。
     */
    public static final String CACHE_MARKET_SEARCH = "marketSearch";
    /**
     * 股票详情数据的缓存名称。
     */
    public static final String CACHE_STOCK_DETAIL = "stockDetail";
    /**
     * 主要市场指数行情的缓存名称。
     */
    public static final String CACHE_MARKET_INDICES = "marketIndices";
    /**
     * 股票行业元数据查询的缓存名称。
     */
    public static final String CACHE_STOCK_INDUSTRY = "stockIndustry";
    /**
     * 热门股票列表响应的缓存名称。
     */
    public static final String CACHE_HOT_STOCKS = "hotStocks";

    /**
     * Spring Boot 自动配置注入的全局 ObjectMapper。
     */
    private final ObjectMapper objectMapper;

    /**
     * TTL 配置的缓存属性。
     */
    private final CacheProperties cacheProperties;

    /**
     * 使用注入的依赖构造 {CacheConfig}。
     *
     * @param objectMapper    global Jackson object mapper (must not be {@code null})
     * @param cacheProperties 缓存 TTL 配置属性
     */
    public CacheConfig(ObjectMapper objectMapper, CacheProperties cacheProperties) {
        this.objectMapper = Objects.requireNonNull(objectMapper);
        this.cacheProperties = Objects.requireNonNull(cacheProperties);
    }

    /**
     * 构造一个理解 Java 时间类型的 JSON 序列化器。
     *
     * <p>The serializer is backed by a copy of the global {@link ObjectMapper}
     * which registers the {@link JavaTimeModule} so that {@code java.time} objects
     * are handled correctly when caching.  Copying prevents mutation of the
     * shared Spring-managed instance.</p>
     *
     * @return 非空 JSON 序列化器实例
     */
    private GenericJackson2JsonRedisSerializer createJsonSerializer() {
        ObjectMapper copy = objectMapper.copy().registerModule(new JavaTimeModule());
        return new GenericJackson2JsonRedisSerializer(copy);
    }

    /**
     * {RedisCacheConfiguration} 的实用工厂。
     *
     * @param ttl                 desired entry time-to-live (must be non-null)
     * @param jsonSerializer      serializer for cache values (must be non-null)
     * @param disableCachingNullValues when {@code true} calls
     *                                  {@code disableCachingNullValues()} on the
     *                                  configuration
     * @return 配置的缓存配置实例
     */
    private static RedisCacheConfiguration buildCacheConfiguration(
                    java.time.Duration ttl,
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
     * 构造应用使用的 {RedisCacheManager} 的 Spring Bean，
     * 注册了多个具有不同 TTL 的命名缓存配置，
     * 由 {CacheProperties} 驱动。
     *
     * @param connectionFactory Redis 连接工厂 (injected by Spring,
     *                          must not be {@code null})
     * @return 缓存管理器实例
     */
    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        GenericJackson2JsonRedisSerializer jsonSerializer = createJsonSerializer();

        RedisCacheConfiguration defaultConfig = buildCacheConfiguration(
                cacheProperties.getDefaultTtl(), jsonSerializer, true);
        RedisCacheConfiguration klineConfig = buildCacheConfiguration(
                cacheProperties.getKlineTtl(), jsonSerializer, false);
        RedisCacheConfiguration priceConfig = buildCacheConfiguration(
                cacheProperties.getPriceTtl(), jsonSerializer, false);
        RedisCacheConfiguration marketSearchConfig = buildCacheConfiguration(
                cacheProperties.getMarketSearchTtl(), jsonSerializer, false);
        RedisCacheConfiguration stockDetailConfig = buildCacheConfiguration(
                cacheProperties.getStockDetailTtl(), jsonSerializer, false);
        RedisCacheConfiguration marketIndicesConfig = buildCacheConfiguration(
                cacheProperties.getMarketIndicesTtl(), jsonSerializer, false);
        RedisCacheConfiguration stockIndustryConfig = buildCacheConfiguration(
                cacheProperties.getStockIndustryTtl(), jsonSerializer, false);
        RedisCacheConfiguration hotStocksConfig = buildCacheConfiguration(
                cacheProperties.getHotStocksTtl(), jsonSerializer, false);

        return RedisCacheManager.builder(Objects.requireNonNull(connectionFactory))
            .cacheDefaults(Objects.requireNonNull(defaultConfig))
            .withCacheConfiguration(CACHE_KLINE, Objects.requireNonNull(klineConfig))
            .withCacheConfiguration(CACHE_PRICE, Objects.requireNonNull(priceConfig))
            .withCacheConfiguration(CACHE_MARKET_SEARCH, Objects.requireNonNull(marketSearchConfig))
            .withCacheConfiguration(CACHE_STOCK_DETAIL, Objects.requireNonNull(stockDetailConfig))
            .withCacheConfiguration(CACHE_MARKET_INDICES, Objects.requireNonNull(marketIndicesConfig))
            .withCacheConfiguration(CACHE_STOCK_INDUSTRY, Objects.requireNonNull(stockIndustryConfig))
            .withCacheConfiguration(CACHE_HOT_STOCKS, Objects.requireNonNull(hotStocksConfig))
                .build();
    }
}
