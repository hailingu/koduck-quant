package com.koduck.service.impl;

import com.koduck.config.CacheConfig;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockBasicRepository;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.MarketService;
import com.koduck.service.StockCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Market data service implementation.
 * Reads data from PostgreSQL database with Redis caching.
 */
@Service
@Slf4j
public class MarketServiceImpl implements MarketService {
    
    // Main index symbols
    private static final List<String> MAIN_INDICES = List.of(
            "000001",  // 上证指数
            "399001",  // 深证成指
            "399006"   // 创业板指
    );
    
    private final StockRealtimeRepository stockRealtimeRepository;
    private final StockBasicRepository stockBasicRepository;
    private final StockCacheService stockCacheService;
    
    public MarketServiceImpl(
            StockRealtimeRepository stockRealtimeRepository,
            StockBasicRepository stockBasicRepository,
            StockCacheService stockCacheService) {
        this.stockRealtimeRepository = stockRealtimeRepository;
        this.stockBasicRepository = stockBasicRepository;
        this.stockCacheService = stockCacheService;
    }
    
    /**
     * Search stock symbols by keyword and return enriched realtime fields.
     *
     * @param keyword symbol/name keyword
     * @param page 1-based page number
     * @param size page size
     * @return matching symbols or empty list
     */
    @Override
    @Cacheable(value = CacheConfig.CACHE_MARKET_SEARCH, key = "#keyword + '_' + #page + '_' + #size", 
               unless = "#result == null || #result.isEmpty()")
    public List<SymbolInfoDto> searchSymbols(String keyword, int page, int size) {
        log.debug("Searching symbols from database: keyword={}, page={}, size={}", keyword, page, size);

        if (keyword == null || keyword.isBlank() || page <= 0 || size <= 0) {
            log.warn("Invalid search params: keyword={}, page={}, size={}", keyword, page, size);
            return Collections.emptyList();
        }

        // Search in stock_basic table
        var pageResult = stockBasicRepository.searchByKeyword(keyword, PageRequest.of(page - 1, size));
        List<StockBasic> basics = pageResult.getContent();
        
        if (basics.isEmpty()) {
            return Collections.emptyList();
        }
        
        // Get symbols for batch lookup
        List<String> symbols = basics.stream().map(StockBasic::getSymbol).toList();
        
        // Batch get realtime prices
        Map<String, StockRealtime> realtimeMap = stockRealtimeRepository.findBySymbolIn(symbols)
                .stream()
                .collect(Collectors.toMap(StockRealtime::getSymbol, Function.identity()));
        
        // Combine basic info with realtime data
        return basics.stream()
                .map(basic -> mapToSymbolInfoDto(basic, realtimeMap.get(basic.getSymbol())))
                .toList();
    }
    
    /**
     * Get realtime quote details for a symbol.
     *
     * @param symbol stock symbol
     * @return quote when found, otherwise {@code null}
     */
    @Override
    // @Cacheable disabled due to Redis serialization issues with Java Records
    public PriceQuoteDto getStockDetail(String symbol) {
        log.debug("Getting stock detail from database: symbol={}", symbol);
        
        if (symbol == null || symbol.isBlank()) {
            log.warn("Invalid symbol: null or blank");
            return null;
        }
        
        try {
            StockRealtime entity = stockRealtimeRepository.findBySymbol(symbol).orElse(null);
            if (entity == null) {
                log.warn("Stock not found in database: {}", symbol);
                return null;
            }
            
            log.debug("Found stock: symbol={}, name={}, price={}", 
                    entity.getSymbol(), entity.getName(), entity.getPrice());
            
            return mapToPriceQuoteDto(entity);
        } catch (Exception e) {
            log.error("Error getting stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
            throw e;
        }
    }
    
    /**
     * Fetch realtime quotes for multiple symbols with cache-first strategy.
     *
     * @param symbols input symbols preserving output order
     * @return merged quote list from cache and database
     */
    @Override
    public List<PriceQuoteDto> getBatchPrices(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }
        
        // Try to get from cache first
        List<PriceQuoteDto> cachedQuotes = stockCacheService.getCachedStockTracks(symbols);
        
        // Find symbols not in cache
        List<String> uncachedSymbols = new ArrayList<>();
        if (cachedQuotes != null && !cachedQuotes.isEmpty()) {
            Set<String> cachedSymbolSet = cachedQuotes.stream()
                    .map(PriceQuoteDto::symbol)
                    .collect(Collectors.toSet());
            for (String symbol : symbols) {
                if (!cachedSymbolSet.contains(symbol)) {
                    uncachedSymbols.add(symbol);
                }
            }
            log.debug("Batch prices cache hit: {}/{}", cachedQuotes.size(), symbols.size());
        } else {
            uncachedSymbols = new ArrayList<>(symbols);
        }
        
        // If all from cache, return directly
        if (uncachedSymbols.isEmpty()) {
            return cachedQuotes;
        }
        
        // Get from database for uncached symbols
        log.debug("Getting batch prices from database: count={}", uncachedSymbols.size());
        List<StockRealtime> entities = stockRealtimeRepository.findBySymbolIn(uncachedSymbols);
        
        // Convert to DTOs
        List<PriceQuoteDto> dbQuotes = entities.stream()
                .map(this::mapToPriceQuoteDto)
                .toList();
        
        // Cache the database results
        if (!dbQuotes.isEmpty()) {
            stockCacheService.cacheBatchStockTracks(dbQuotes);
        }
        
        // Merge results (cache first, then db results)
        List<PriceQuoteDto> result = new ArrayList<>();
        if (cachedQuotes != null) {
            result.addAll(cachedQuotes);
        }
        result.addAll(dbQuotes);
        
        // Sort by original order
        Map<String, PriceQuoteDto> quoteMap = result.stream()
                .collect(Collectors.toMap(PriceQuoteDto::symbol, Function.identity()));
        return symbols.stream()
                .filter(quoteMap::containsKey)
                .map(quoteMap::get)
                .toList();
    }
    
    /**
     * Get major market index quotes.
     *
     * @return index list from realtime data with stock-basic fallback
     */
    @Override
    @Cacheable(value = CacheConfig.CACHE_MARKET_INDICES, key = "'main'", unless = "#result == null || #result.isEmpty()")
    public List<MarketIndexDto> getMarketIndices() {
        log.debug("Getting market indices from database");
        
        // Get index data from stock_realtime
        List<StockRealtime> indices = stockRealtimeRepository.findBySymbolIn(MAIN_INDICES);
        
        if (indices.isEmpty()) {
            // Fallback: try to get from stock_basic with realtime data
            log.warn("No index data found in stock_realtime, checking stock_basic");
            List<StockBasic> basics = stockBasicRepository.findBySymbolIn(MAIN_INDICES);
            if (basics.isEmpty()) {
                return Collections.emptyList();
            }
            
            Map<String, StockRealtime> realtimeMap = stockRealtimeRepository.findBySymbolIn(
                            basics.stream().map(StockBasic::getSymbol).toList())
                    .stream()
                    .collect(Collectors.toMap(StockRealtime::getSymbol, Function.identity()));
            
            return basics.stream()
                    .map(basic -> mapToMarketIndexDto(basic, realtimeMap.get(basic.getSymbol())))
                    .toList();
        }
        
        return indices.stream()
                .map(this::mapToMarketIndexDto)
                .toList();
    }
    
    // ============ Mapping Methods ============
    
    private SymbolInfoDto mapToSymbolInfoDto(StockBasic basic, StockRealtime realtime) {
        if (realtime != null) {
            return SymbolInfoDto.builder()
                    .symbol(basic.getSymbol())
                    .name(basic.getName())
                    .market(basic.getMarket())
                    .price(realtime.getPrice())
                    .changePercent(realtime.getChangePercent())
                    .volume(realtime.getVolume())
                    .amount(realtime.getAmount())
                    .build();
        }
        
        // Return basic info only if no realtime data
        return SymbolInfoDto.builder()
                .symbol(basic.getSymbol())
                .name(basic.getName())
                .market(basic.getMarket())
                .build();
    }
    
    private PriceQuoteDto mapToPriceQuoteDto(StockRealtime entity) {
        try {
            return PriceQuoteDto.builder()
                    .symbol(entity.getSymbol())
                    .name(entity.getName())
                    .price(entity.getPrice())
                    .open(entity.getOpenPrice())
                    .high(entity.getHigh())
                    .low(entity.getLow())
                    .prevClose(entity.getPrevClose())
                    .volume(entity.getVolume())
                    .amount(entity.getAmount())
                    .change(entity.getChangeAmount())
                    .changePercent(entity.getChangePercent())
                    .bidPrice(entity.getBidPrice())
                    .bidVolume(entity.getBidVolume())
                    .askPrice(entity.getAskPrice())
                    .askVolume(entity.getAskVolume())
                    .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
                    .build();
        } catch (Exception e) {
            log.error("Failed to map StockRealtime to PriceQuoteDto: symbol={}, error={}", 
                    entity != null ? entity.getSymbol() : "null", e.getMessage(), e);
            throw e;
        }
    }
    
    private MarketIndexDto mapToMarketIndexDto(StockRealtime entity) {
        return MarketIndexDto.builder()
                .symbol(entity.getSymbol())
                .name(entity.getName())
                .price(entity.getPrice())
                .change(entity.getChangeAmount())
                .changePercent(entity.getChangePercent())
                .open(entity.getOpenPrice())
                .high(entity.getHigh())
                .low(entity.getLow())
                .prevClose(entity.getPrevClose())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.ofHours(8)) : null)
                .build();
    }
    
    private MarketIndexDto mapToMarketIndexDto(StockBasic basic, StockRealtime realtime) {
        if (realtime != null) {
            return mapToMarketIndexDto(realtime);
        }
        
        return MarketIndexDto.builder()
                .symbol(basic.getSymbol())
                .name(basic.getName())
                .build();
    }
}
