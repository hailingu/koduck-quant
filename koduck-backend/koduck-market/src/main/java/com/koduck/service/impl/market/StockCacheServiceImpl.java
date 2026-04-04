package com.koduck.service.impl.market;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

import org.springframework.stereotype.Service;

import com.koduck.common.constants.MapKeyConstants;
import com.koduck.common.constants.RedisKeyConstants;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.service.StockCacheService;
import com.koduck.service.cache.CacheLayer;

import lombok.extern.slf4j.Slf4j;

/**
 * Stock data caching service implementation using Redis.
 * Provides high-performance caching for stock real-time data.
 *
 * @author Koduck Team
 */
@Service
@Slf4j
public class StockCacheServiceImpl implements StockCacheService {

    /** Error message for null key validation. */
    private static final String KEY_NULL_MESSAGE = "key must not be null";

    /** Key for symbol field in map. */
    private static final String KEY_SYMBOL = MapKeyConstants.KEY_SYMBOL;

    /** Key for name field in map. */
    private static final String KEY_NAME = MapKeyConstants.KEY_NAME;

    /** Key for type field in map. */
    private static final String KEY_TYPE = "type";

    /** Key for price field in map. */
    private static final String KEY_PRICE = "price";

    /** Key for changePercent field in map. */
    private static final String KEY_CHANGE_PERCENT = "changePercent";

    /** The cache layer for data storage. */
    private final CacheLayer cacheLayer;

    /**
     * Constructs a new StockCacheServiceImpl.
     *
     * @param cacheLayer the cache layer for data storage
     */
    public StockCacheServiceImpl(CacheLayer cacheLayer) {
        this.cacheLayer = Objects.requireNonNull(cacheLayer, "cacheLayer must not be null");
    }

    // ==================== Stock Tracking () ====================

    @Override
    public void cacheStockTrack(String symbol, PriceQuoteDto quote) {
        if (symbol == null || quote == null) {
            return;
        }
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            cacheLayer.setValue(
                    requireNonNullString(key, KEY_NULL_MESSAGE),
                    requireNonNullObject(quote, "quote must not be null"),
                    RedisKeyConstants.TTL_STOCK_TRACK
            );
            log.debug("Cached stock track: symbol={}", symbol);
        }
        catch (RuntimeException e) {
            log.warn("Failed to cache stock track: symbol={}, error={}", symbol, e.getMessage());
        }
    }

    @Override
    public PriceQuoteDto getCachedStockTrack(String symbol) {
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            Object cached = cacheLayer.getValue(requireNonNullString(key, KEY_NULL_MESSAGE));
            if (cached instanceof PriceQuoteDto priceQuoteDto) {
                log.debug("Cache hit: stock track {}", symbol);
                return priceQuoteDto;
            }
            // Handle JSON deserialized object
            if (cached != null) {
                log.debug("Cache hit (converted): stock track {}", symbol);
                return convertToPriceQuoteDto(cached);
            }
        }
        catch (RuntimeException e) {
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
            cacheLayer.replaceList(nonNullKey, symbols, RedisKeyConstants.TTL_HOT_STOCKS);
            log.debug("Cached hot stocks: type={}, count={}", type, symbols != null ? symbols.size() : 0);
        }
        catch (RuntimeException e) {
            log.warn("Failed to cache hot stocks: type={}, error={}", type, e.getMessage());
        }
    }

    @Override
    public List<String> getCachedHotStocks(String type) {
        String key = RedisKeyConstants.hotStocksKey(type);
        try {
            List<Object> cached = cacheLayer.getListRange(requireNonNullString(key, KEY_NULL_MESSAGE), 0, -1);
            if (cached != null && !cached.isEmpty()) {
                log.debug("Cache hit: hot stocks type={}", type);
                return cached.stream()
                        .map(Object::toString)
                        .toList();
            }
        }
        catch (RuntimeException e) {
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
            return cacheLayer.hasKey(requireNonNullString(key, KEY_NULL_MESSAGE));
        }
        catch (RuntimeException e) {
            log.warn("Failed to check stock track cache: symbol={}, error={}", symbol, e.getMessage());
            return false;
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Convert cached object to PriceQuoteDto.
     * Handles various deserialization scenarios.
     *
     * @param cached the cached object
     * @return the converted PriceQuoteDto, or null if conversion fails
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
            }
            catch (RuntimeException e) {
                log.warn("Failed to convert cached object: error={}", e.getMessage());
            }
        }

        return null;
    }

    /**
     * Build PriceQuoteDto from a map.
     *
     * @param map the map containing the data
     * @return the built PriceQuoteDto
     */
    private PriceQuoteDto buildPriceQuoteFromMap(Map<String, Object> map) {
        PriceQuoteDto.Builder builder = PriceQuoteDto.builder();
        setStringIfPresent(map, KEY_SYMBOL, builder::symbol);
        setStringIfPresent(map, KEY_NAME, builder::name);
        setStringIfPresent(map, KEY_TYPE, builder::type);
        setBigDecimalIfPresent(map, KEY_PRICE, builder::price);
        setBigDecimalIfPresent(map, KEY_CHANGE_PERCENT, builder::changePercent);
        return builder.build();
    }

    /**
     * Set string value if present in map.
     *
     * @param map the map to get value from
     * @param key the key to look up
     * @param setter the setter to apply
     */
    private void setStringIfPresent(Map<String, Object> map, String key, Consumer<String> setter) {
        Object value = map.get(key);
        if (value != null) {
            setter.accept(value.toString());
        }
    }

    /**
     * Set BigDecimal value if present in map.
     *
     * @param map the map to get value from
     * @param key the key to look up
     * @param setter the setter to apply
     */
    private void setBigDecimalIfPresent(Map<String, Object> map,
                                        String key,
                                        Consumer<BigDecimal> setter) {
        Object value = map.get(key);
        if (value != null) {
            setter.accept(new BigDecimal(value.toString()));
        }
    }

    /**
     * Convert a raw map to a string-keyed map.
     *
     * @param rawMap the raw map with unknown key types
     * @return a map with string keys
     */
    private Map<String, Object> toStringKeyMap(Map<?, ?> rawMap) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
            if (entry.getKey() instanceof String key) {
                normalized.put(key, entry.getValue());
            }
        }
        return normalized;
    }

    /**
     * Require non-null string value.
     *
     * @param value the value to check
     * @param message the error message
     * @return the non-null value
     */
    private static String requireNonNullString(String value, String message) {
        return Objects.requireNonNull(value, message);
    }

    /**
     * Require non-null object value.
     *
     * @param value the value to check
     * @param message the error message
     * @return the non-null value
     */
    private static Object requireNonNullObject(Object value, String message) {
        return Objects.requireNonNull(value, message);
    }
}
