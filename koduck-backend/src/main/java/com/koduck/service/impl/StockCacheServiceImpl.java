package com.koduck.service.impl;

import com.koduck.config.RedisKeyConstants;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.service.StockCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Stock data caching service implementation using Redis.
 * Provides high-performance caching for stock real-time data.
 */
@Service
@Slf4j
public class StockCacheServiceImpl implements StockCacheService {
    private static final String KEY_NULL_MESSAGE = "key must not be null";
    private static final String KEY_SYMBOL = "symbol";
    private static final String KEY_NAME = "name";
    private static final String KEY_TYPE = "type";
    private static final String KEY_PRICE = "price";
    private static final String KEY_CHANGE_PERCENT = "changePercent";
    private final RedisTemplate<String, Object> redisTemplate;

    public StockCacheServiceImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
    }

    // ==================== Stock Tracking () ====================

    @Override
    public void cacheStockTrack(String symbol, PriceQuoteDto quote) {
        if (symbol == null || quote == null) {
            return;
        }
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            redisTemplate.opsForValue().set(
                    requireNonNullString(key, KEY_NULL_MESSAGE),
                    requireNonNullObject(quote, "quote must not be null"),
                    RedisKeyConstants.TTL_STOCK_TRACK,
                    TimeUnit.SECONDS);
            log.debug("Cached stock track: symbol={}", symbol);
        } catch (Exception e) {
            log.warn("Failed to cache stock track: symbol={}, error={}", symbol, e.getMessage());
        }
    }

    @Override
    public PriceQuoteDto getCachedStockTrack(String symbol) {
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            Object cached = redisTemplate.opsForValue().get(requireNonNullObject(key, KEY_NULL_MESSAGE));
            if (cached instanceof PriceQuoteDto priceQuoteDto) {
                log.debug("Cache hit: stock track {}", symbol);
                return priceQuoteDto;
            }
            // Handle JSON deserialized object
            if (cached != null) {
                log.debug("Cache hit (converted): stock track {}", symbol);
                return convertToPriceQuoteDto(cached);
            }
        } catch (Exception e) {
            log.warn("Failed to get cached stock track: symbol={}, error={}", symbol, e.getMessage());
        }
        return null;
    }

    @Override
    public List<PriceQuoteDto> getCachedStockTracks(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return List.of();
        }

        List<PriceQuoteDto> results = new ArrayList<>();
        for (String symbol : symbols) {
            PriceQuoteDto cached = getCachedStockTrack(symbol);
            if (cached != null) {
                results.add(cached);
            }
        }
        return results;
    }

    @Override
    public void cacheHotStocks(String type, List<String> symbols) {
        String key = RedisKeyConstants.hotStocksKey(type);
        try {
            String nonNullKey = requireNonNullString(key, KEY_NULL_MESSAGE);
            redisTemplate.delete(nonNullKey);
            if (symbols != null && !symbols.isEmpty()) {
                Object[] symbolArray = requireNonNullObjectArray(symbols.toArray(), "symbolArray must not be null");
                redisTemplate.opsForList().rightPushAll(nonNullKey, symbolArray);
                redisTemplate.expire(nonNullKey, RedisKeyConstants.TTL_HOT_STOCKS, TimeUnit.SECONDS);
            }
            log.debug("Cached hot stocks: type={}, count={}", type, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache hot stocks: type={}, error={}", type, e.getMessage());
        }
    }

    @Override
    public List<String> getCachedHotStocks(String type) {
        String key = RedisKeyConstants.hotStocksKey(type);
        try {
            List<Object> cached = redisTemplate.opsForList().range(
                    requireNonNullString(key, KEY_NULL_MESSAGE), 0, -1);
            if (cached != null && !cached.isEmpty()) {
                log.debug("Cache hit: hot stocks type={}", type);
                return cached.stream()
                        .map(Object::toString)
                        .toList();
            }
        } catch (Exception e) {
            log.warn("Failed to get cached hot stocks: type={}, error={}", type, e.getMessage());
        }
        return List.of();
    }

    // ==================== Batch Operations ====================

    @Override
    public void cacheBatchStockTracks(List<PriceQuoteDto> quotes) {
        if (quotes == null || quotes.isEmpty()) {
            return;
        }

        for (PriceQuoteDto quote : quotes) {
            if (quote != null && quote.symbol() != null) {
                cacheStockTrack(quote.symbol(), quote);
            }
        }
        log.debug("Cached batch stock tracks: count={}", quotes.size());
    }

    @Override
    public boolean isStockTrackCached(String symbol) {
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            Boolean exists = redisTemplate.hasKey(requireNonNullString(key, KEY_NULL_MESSAGE));
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.warn("Failed to check stock track cache: symbol={}, error={}", symbol, e.getMessage());
            return false;
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Convert cached object to PriceQuoteDto.
     * Handles various deserialization scenarios.
     */
    private PriceQuoteDto convertToPriceQuoteDto(Object cached) {
        if (cached instanceof PriceQuoteDto priceQuoteDto) {
            return priceQuoteDto;
        }

        // Handle LinkedHashMap (Jackson JSON deserialization)
        if (cached instanceof Map<?, ?> rawMap) {
            Map<String, Object> map = toStringKeyMap(rawMap);
            try {
                return buildPriceQuoteFromMap(map);
            } catch (Exception e) {
                log.warn("Failed to convert cached object: error={}", e.getMessage());
            }
        }
        
        return null;
    }

    private PriceQuoteDto buildPriceQuoteFromMap(Map<String, Object> map) {
        PriceQuoteDto.Builder builder = PriceQuoteDto.builder();
        setStringIfPresent(map, KEY_SYMBOL, builder::symbol);
        setStringIfPresent(map, KEY_NAME, builder::name);
        setStringIfPresent(map, KEY_TYPE, builder::type);
        setBigDecimalIfPresent(map, KEY_PRICE, builder::price);
        setBigDecimalIfPresent(map, KEY_CHANGE_PERCENT, builder::changePercent);
        return builder.build();
    }

    private void setStringIfPresent(Map<String, Object> map, String key, Consumer<String> setter) {
        Object value = map.get(key);
        if (value != null) {
            setter.accept(value.toString());
        }
    }

    private void setBigDecimalIfPresent(Map<String, Object> map,
                                        String key,
                                        Consumer<BigDecimal> setter) {
        Object value = map.get(key);
        if (value != null) {
            setter.accept(new BigDecimal(value.toString()));
        }
    }

    private Map<String, Object> toStringKeyMap(Map<?, ?> rawMap) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
            if (entry.getKey() instanceof String key) {
                normalized.put(key, entry.getValue());
            }
        }
        return normalized;
    }

    private static @NonNull String requireNonNullString(String value, String message) {
        return Objects.requireNonNull(value, message);
    }

    private static @NonNull Object requireNonNullObject(Object value, String message) {
        return Objects.requireNonNull(value, message);
    }

    private static @NonNull Object[] requireNonNullObjectArray(Object[] value, String message) {
        return Objects.requireNonNull(value, message);
    }
}
