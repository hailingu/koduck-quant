package com.koduck.service.impl;

import com.koduck.config.RedisKeyConstants;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.service.StockCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Stock data caching service implementation using Redis.
 * Provides high-performance caching for stock real-time data.
 */
@Service
@Slf4j
public class StockCacheServiceImpl implements StockCacheService {

    private final RedisTemplate<String, Object> redisTemplate;

    public StockCacheServiceImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // ==================== Stock Tracking () ====================

    @Override
    public void cacheStockTrack(String symbol, PriceQuoteDto quote) {
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            redisTemplate.opsForValue().set(key, quote, RedisKeyConstants.TTL_STOCK_TRACK, TimeUnit.SECONDS);
            log.debug("Cached stock track: symbol={}", symbol);
        } catch (Exception e) {
            log.warn("Failed to cache stock track: symbol={}, error={}", symbol, e.getMessage());
        }
    }

    @Override
    public PriceQuoteDto getCachedStockTrack(String symbol) {
        String key = RedisKeyConstants.stockTrackKey(symbol);
        try {
            Object cached = redisTemplate.opsForValue().get(key);
            if (cached instanceof PriceQuoteDto) {
                log.debug("Cache hit: stock track {}", symbol);
                return (PriceQuoteDto) cached;
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

    // ==================== Hot Stocks ====================

    @Override
    public void cacheHotStocks(String type, List<String> symbols) {
        String key = RedisKeyConstants.hotStocksKey(type);
        try {
            redisTemplate.delete(key);
            if (symbols != null && !symbols.isEmpty()) {
                redisTemplate.opsForList().rightPushAll(key, symbols.toArray());
                redisTemplate.expire(key, RedisKeyConstants.TTL_HOT_STOCKS, TimeUnit.SECONDS);
            }
            log.debug("Cached hot stocks: type={}, count={}", type, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache hot stocks: type={}, error={}", type, e.getMessage());
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<String> getCachedHotStocks(String type) {
        String key = RedisKeyConstants.hotStocksKey(type);
        try {
            List<Object> cached = redisTemplate.opsForList().range(key, 0, -1);
            if (cached != null && !cached.isEmpty()) {
                log.debug("Cache hit: hot stocks type={}", type);
                return cached.stream()
                        .map(Object::toString)
                        .toList();
            }
        } catch (Exception e) {
            log.warn("Failed to get cached hot stocks: type={}, error={}", type, e.getMessage());
        }
        return null;
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
            Boolean exists = redisTemplate.hasKey(key);
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
    @SuppressWarnings("unchecked")
    private PriceQuoteDto convertToPriceQuoteDto(Object cached) {
        if (cached instanceof PriceQuoteDto) {
            return (PriceQuoteDto) cached;
        }

        // Handle LinkedHashMap (Jackson JSON deserialization)
        if (cached instanceof java.util.Map) {
            java.util.Map<String, Object> map = (java.util.Map<String, Object>) cached;
            try {
                PriceQuoteDto.Builder builder = PriceQuoteDto.builder();
                
                if (map.containsKey("symbol")) builder.symbol(map.get("symbol").toString());
                if (map.containsKey("name")) builder.name(map.get("name").toString());
                if (map.containsKey("price")) builder.price(new java.math.BigDecimal(map.get("price").toString()));
                if (map.containsKey("changePercent")) {
                    Object changePercent = map.get("changePercent");
                    if (changePercent != null) {
                        builder.changePercent(new java.math.BigDecimal(changePercent.toString()));
                    }
                }
                
                return builder.build();
            } catch (Exception e) {
                log.warn("Failed to convert cached object: error={}", e.getMessage());
            }
        }
        
        return null;
    }
}
