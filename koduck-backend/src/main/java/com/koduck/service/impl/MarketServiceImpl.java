package com.koduck.service.impl;

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.CacheConfig;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockBasicRepository;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.MarketService;
import com.koduck.service.StockCacheService;
import com.koduck.service.support.MarketFallbackSupport;
import com.koduck.service.support.MarketServiceSupport;
import com.koduck.util.SymbolUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
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

    private static final String DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET;
    private static final String DAILY_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;
    private static final String STOCK_TYPE = "STOCK";
    private static final String POSITIVE_LINK_TYPE = "positive";
    private static final String NEGATIVE_LINK_TYPE = "negative";
    
    // Main index symbols
    private static final List<String> MAIN_INDICES = List.of(
            "000001",  // 
            "399001",  // 
            "399006"   // 
    );
    
    private final StockRealtimeRepository stockRealtimeRepository;
    private final StockBasicRepository stockBasicRepository;
    private final StockCacheService stockCacheService;
    private final MarketServiceSupport marketServiceSupport;
    private final MarketFallbackSupport marketFallbackSupport;
    
    public MarketServiceImpl(
            StockRealtimeRepository stockRealtimeRepository,
            StockBasicRepository stockBasicRepository,
            StockCacheService stockCacheService,
            MarketServiceSupport marketServiceSupport,
            MarketFallbackSupport marketFallbackSupport) {
        this.stockRealtimeRepository = stockRealtimeRepository;
        this.stockBasicRepository = stockBasicRepository;
        this.stockCacheService = stockCacheService;
        this.marketServiceSupport = marketServiceSupport;
        this.marketFallbackSupport = marketFallbackSupport;
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
            log.info("No symbols found in stock_basic, fallback to data service: keyword={}, size={}", keyword, size);
            return searchSymbolsFromProvider(keyword, size);
        }
        
        // Get symbols for batch lookup
        List<String> symbols = basics.stream().map(StockBasic::getSymbol).toList();
        
        // Batch get realtime prices
        Map<String, StockRealtime> realtimeMap = stockRealtimeRepository.findBySymbolIn(symbols)
                .stream()
                .collect(Collectors.toMap(StockRealtime::getSymbol, Function.identity()));
        
        // Combine info and de-duplicate by canonical market+symbol to avoid
        // duplicate rows such as "002885" and "2885".
        Map<String, SymbolInfoDto> deduplicated = new LinkedHashMap<>();
        for (StockBasic basic : basics) {
            SymbolInfoDto dto = marketServiceSupport.mapToSymbolInfoDto(basic, realtimeMap.get(basic.getSymbol()));
            String key = dto.market() + ":" + dto.symbol();
            SymbolInfoDto existing = deduplicated.get(key);
            if (existing == null || marketServiceSupport.shouldReplaceSymbol(existing, dto)) {
                deduplicated.put(key, dto);
            }
        }

        return new ArrayList<>(deduplicated.values());
    }

    private List<SymbolInfoDto> searchSymbolsFromProvider(String keyword, int size) {
        return marketFallbackSupport.searchSymbolsFromProvider(keyword, size);
    }
    
    /**
     * Get realtime quote details for a symbol.
     *
     * @param symbol stock symbol
     * @return quote when found, otherwise {@code null}
     */
    @Override
    public PriceQuoteDto getStockDetail(String symbol) {
        log.debug("Getting stock detail from database: symbol={}", symbol);
        
        if (symbol == null || symbol.isBlank()) {
            log.warn("Invalid symbol: null or blank");
            return null;
        }
        
        try {
            StockRealtime entity = stockRealtimeRepository
                    .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                    .orElse(null);
            if (entity == null) {
                PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
                if (fallbackQuote != null) {
                    log.info("Built stock detail from latest kline data: symbol={}", symbol);
                    return fallbackQuote;
                }

                PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
                if (providerQuote != null) {
                    log.info("Fetched stock detail from data service: symbol={}", symbol);
                    return providerQuote;
                }

                log.warn("Stock not found in realtime or kline data: {}", symbol);
                return null;
            }
            
            log.debug("Found stock: symbol={}, name={}, price={}", 
                    entity.getSymbol(), entity.getName(), entity.getPrice());
            
            return marketServiceSupport.mapToPriceQuoteDto(entity);
        } catch (Exception e) {
            log.error("Error getting stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
            PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
            if (fallbackQuote != null) {
                log.info("Recovered stock detail from latest kline after exception: symbol={}", symbol);
                return fallbackQuote;
            }

            PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
            if (providerQuote != null) {
                log.info("Recovered stock detail from data service after exception: symbol={}", symbol);
                return providerQuote;
            }

            return null;
        }
    }

    /**
     * Get valuation metrics for a symbol from data-service.
     *
     * @param symbol stock symbol
     * @return valuation when found, otherwise {@code null}
     */
    @Override
    public StockValuationDto getStockValuation(String symbol) {
        log.debug("Getting stock valuation from data service: symbol={}", symbol);

        if (symbol == null || symbol.isBlank()) {
            log.warn("Invalid symbol for valuation: null or blank");
            return null;
        }

        try {
            return marketFallbackSupport.fetchProviderValuation(symbol);
        } catch (Exception e) {
            log.error("Error getting stock valuation: symbol={}, error={}", symbol, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Get industry metadata for a symbol from data-service.
     *
     * @param symbol stock symbol
     * @return industry metadata when found, otherwise {@code null}
     */
    @Override
    public StockIndustryDto getStockIndustry(String symbol) {
        log.debug("Getting stock industry from data service: symbol={}", symbol);

        if (symbol == null || symbol.isBlank()) {
            log.warn("Invalid symbol for industry: null or blank");
            return null;
        }

        try {
            return marketFallbackSupport.fetchProviderIndustry(symbol);
        } catch (Exception e) {
            log.error("Error getting stock industry: symbol={}, error={}", symbol, e.getMessage(), e);
            return null;
        }
    }

    @Override
    public Map<String, StockIndustryDto> getStockIndustries(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, StockIndustryDto> results = new LinkedHashMap<>();
        for (String symbol : symbols) {
            if (symbol == null || symbol.isBlank()) {
                continue;
            }

            try {
                StockIndustryDto industry = getStockIndustry(symbol);
                if (industry != null) {
                    results.put(symbol, industry);
                }
            } catch (Exception e) {
                log.warn("Batch stock industry lookup failed for symbol={}: {}", symbol, e.getMessage());
            }
        }

        return results;
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
            .map(marketServiceSupport::mapToPriceQuoteDto)
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
     * Get daily trading statistics for a stock.
     * <p>Returns open/high/low/current prices, change metrics, volume and amount.</p>
     *
     * @param symbol stock symbol
     * @param market market code
     * @return stock stats when found, otherwise {@code null}
     */
    @Override
    @Cacheable(value = "stock:stats", key = "#symbol + '_' + #market", unless = "#result == null")
    public StockStatsDto getStockStats(String symbol, String market) {
        log.debug("Getting stock stats from database: symbol={}, market={}", symbol, market);
        
        if (symbol == null || symbol.isBlank()) {
            log.warn("Invalid symbol for stats: null or blank");
            return null;
        }
        
        try {
            // Try to get from stock_realtime first
            StockRealtime entity = stockRealtimeRepository
                    .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                    .orElse(null);
            
            if (entity != null) {
                return marketServiceSupport.mapToStockStatsDto(entity, market);
            }
            
            // Fallback: try to build from kline data
            StockStatsDto klineStats = marketFallbackSupport.tryBuildStatsFromKline(symbol, market);
            if (klineStats != null) {
                log.info("Built stock stats from kline data: symbol={}", symbol);
                return klineStats;
            }
            
            // Final fallback: try data provider
            PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
            if (providerQuote != null) {
                return marketServiceSupport.mapPriceQuoteToStats(providerQuote, market);
            }
            
            log.warn("Stock stats not found for symbol={}", symbol);
            return null;
            
        } catch (Exception e) {
            log.error("Error getting stock stats: symbol={}, error={}", symbol, e.getMessage(), e);
            
            // Try fallback on exception
            StockStatsDto klineStats = marketFallbackSupport.tryBuildStatsFromKline(symbol, market);
            if (klineStats != null) {
                return klineStats;
            }
            
            PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
            if (providerQuote != null) {
                return marketServiceSupport.mapPriceQuoteToStats(providerQuote, market);
            }
            
            return null;
        }
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
        
        // Get index data from stock_realtime, filtering by type='INDEX'
        // to avoid conflicts with stocks having same symbol codes (e.g., 000001 = 上证指数 vs 平安银行)
        List<StockRealtime> indices = stockRealtimeRepository.findBySymbolInAndType(MAIN_INDICES, "INDEX");
        
        if (!indices.isEmpty()) {
            log.debug("Found {} indices in stock_realtime", indices.size());
            return indices.stream()
                    .map(marketServiceSupport::mapToMarketIndexDto)
                    .toList();
        }
        
        // Fallback: try to get from stock_basic with type='INDEX'
        log.warn("No index data found in stock_realtime with type='INDEX', checking stock_basic");
        List<StockBasic> basicIndices = stockBasicRepository.findBySymbolInAndType(MAIN_INDICES, "INDEX");
        
        if (basicIndices.isEmpty()) {
            log.warn("No index data found in stock_basic with type='INDEX'. " +
                     "Ensure data-service is running and updating indices.");
            return Collections.emptyList();
        }
        
        log.debug("Found {} indices in stock_basic", basicIndices.size());
        // Map from StockBasic to MarketIndexDto (without price data)
        return basicIndices.stream()
            .map(marketServiceSupport::mapBasicToMarketIndexDto)
                .toList();
    }
    
    /**
     * Get hot stocks by trading volume.
     * Returns stocks ordered by trading volume descending.
     *
     * @param market market code (e.g., "AShare")
     * @param limit number of stocks to return
     * @return list of hot stocks
     */
    @Override
    public List<SymbolInfoDto> getHotStocks(String market, int limit) {
        return marketServiceSupport.getHotStocks(market, limit);
    }
    
    // ============ Sector Network Methods ============

    @Override
    public SectorNetworkDto getSectorNetwork(String market) {
        log.debug("Getting sector network data for market: {}", market);
        return marketServiceSupport.generateMockSectorNetwork(POSITIVE_LINK_TYPE, NEGATIVE_LINK_TYPE);
    }
    
}
