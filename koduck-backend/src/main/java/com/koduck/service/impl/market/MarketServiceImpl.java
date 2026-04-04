package com.koduck.service.impl.market;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.CacheConfig;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.SectorNetworkDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.market.StockBasic;
import com.koduck.entity.market.StockRealtime;
import com.koduck.repository.market.StockBasicRepository;
import com.koduck.repository.market.StockRealtimeRepository;
import com.koduck.service.MarketService;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ResourceNotFoundException;
import com.koduck.service.StockCacheService;
import com.koduck.service.support.MarketFallbackSupport;
import com.koduck.service.support.MarketServiceSupport;

import lombok.extern.slf4j.Slf4j;

/**
 * Market data service implementation.
 * Reads data from PostgreSQL database with Redis caching.
 */
@Service
@Slf4j
public class MarketServiceImpl implements MarketService {

    private static final String POSITIVE_LINK_TYPE = "positive";
    private static final String NEGATIVE_LINK_TYPE = "negative";
    
    // Main index symbols
    private static final List<String> MAIN_INDICES = List.of(
            MarketConstants.A_SHARE_INDEX_SYMBOL,  // 上证指数
            "399001",     // 深证成指
            "399006"      // 创业板指
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
            throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
        }

        return withQuoteFallback(symbol, () -> {
            StockRealtime entity = stockRealtimeRepository
                    .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                    .orElse(null);
            if (entity == null) {
                return null;
            }
            log.debug("Found stock: symbol={}, name={}, price={}",
                    entity.getSymbol(), entity.getName(), entity.getPrice());
            return marketServiceSupport.mapToPriceQuoteDto(entity);
        });
    }

    /**
     * Execute quote fetcher with fallback chain:
     * 1. Primary fetcher (database)
     * 2. Kline data fallback
     * 3. Provider data fallback
     * 4. Throw ResourceNotFoundException
     *
     * @param symbol stock symbol
     * @param primaryFetcher primary data fetcher
     * @return price quote
     * @throws ResourceNotFoundException when all fallback sources fail
     */
    private PriceQuoteDto withQuoteFallback(String symbol, Supplier<PriceQuoteDto> primaryFetcher) {
        try {
            PriceQuoteDto result = primaryFetcher.get();
            if (result != null) {
                return result;
            }
        } catch (RuntimeException e) {
            log.error("Error fetching stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
        }

        // Fallback 1: try kline data
        PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
        if (fallbackQuote != null) {
            log.info("Recovered stock detail from kline data: symbol={}", symbol);
            return fallbackQuote;
        }

        // Fallback 2: try provider
        PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
        if (providerQuote != null) {
            log.info("Recovered stock detail from data service: symbol={}", symbol);
            return providerQuote;
        }

        log.warn("Stock not found in any data source: {}", symbol);
        throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
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
            throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
        }

        StockValuationDto valuation = marketFallbackSupport.fetchProviderValuation(symbol);
        if (valuation == null) {
            throw new ResourceNotFoundException(ErrorCode.MARKET_DATA_NOT_FOUND, "stock valuation", symbol);
        }
        return valuation;
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
            throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
        }

        try {
            StockIndustryDto industry = marketFallbackSupport.fetchProviderIndustry(symbol);
            if (industry == null) {
                throw new ResourceNotFoundException(ErrorCode.MARKET_DATA_NOT_FOUND, "stock industry", symbol);
            }
            return industry;
        } catch (RuntimeException e) {
            log.error("Error getting stock industry: symbol={}, error={}", symbol, e.getMessage(), e);
            throw new ResourceNotFoundException(ErrorCode.MARKET_DATA_NOT_FOUND, "stock industry", symbol);
        }
    }

    @Override
    public Map<String, StockIndustryDto> getStockIndustries(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyMap();
        }

        // 过滤掉无效的symbol
        List<String> validSymbols = symbols.stream()
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .toList();

        if (validSymbols.isEmpty()) {
            return Collections.emptyMap();
        }

        try {
            // 使用批量查询替代N+1串行调用
            Map<String, StockIndustryDto> results = marketFallbackSupport.fetchProviderIndustries(validSymbols);

            // 记录实际获取到的数量和缺失的symbol
            if (results.size() < validSymbols.size()) {
                List<String> missingSymbols = validSymbols.stream()
                        .filter(s -> !results.containsKey(s))
                        .toList();
                log.debug("Batch industry query partial miss: got {}/{}, missing: {}",
                        results.size(), validSymbols.size(), missingSymbols);
            } else {
                log.debug("Batch industry query success: got {}/{}", results.size(), validSymbols.size());
            }

            return results;
        } catch (RuntimeException e) {
            log.error("Batch stock industry query failed: symbols={}, error={}", validSymbols, e.getMessage(), e);
            // 降级：返回空map，避免抛出异常影响主流程
            return Collections.emptyMap();
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
            throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
        }

        return withStatsFallback(symbol, market, () -> {
            StockRealtime entity = stockRealtimeRepository
                    .findFirstBySymbolOrderByUpdatedAtDesc(symbol)
                    .orElse(null);
            if (entity != null) {
                return marketServiceSupport.mapToStockStatsDto(entity, market);
            }
            return null;
        });
    }

    /**
     * Execute stats fetcher with fallback chain:
     * 1. Primary fetcher (database)
     * 2. Kline data fallback
     * 3. Provider data fallback (converted to stats)
     * 4. Throw ResourceNotFoundException
     *
     * @param symbol stock symbol
     * @param market market code
     * @param primaryFetcher primary data fetcher
     * @return stock stats
     * @throws ResourceNotFoundException when all fallback sources fail
     */
    private StockStatsDto withStatsFallback(String symbol, String market,
                                           Supplier<StockStatsDto> primaryFetcher) {
        try {
            StockStatsDto result = primaryFetcher.get();
            if (result != null) {
                return result;
            }
        } catch (RuntimeException e) {
            log.error("Error fetching stock stats: symbol={}, error={}", symbol, e.getMessage(), e);
        }

        // Fallback 1: try kline data
        StockStatsDto klineStats = marketFallbackSupport.tryBuildStatsFromKline(symbol, market);
        if (klineStats != null) {
            log.info("Recovered stock stats from kline data: symbol={}", symbol);
            return klineStats;
        }

        // Fallback 2: try provider
        PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
        if (providerQuote != null) {
            log.info("Recovered stock stats from data service: symbol={}", symbol);
            return marketServiceSupport.mapPriceQuoteToStats(providerQuote, market);
        }

        log.warn("Stock stats not found in any data source: symbol={}", symbol);
        throw new ResourceNotFoundException(ErrorCode.MARKET_DATA_NOT_FOUND, "stock stats", symbol);
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
        List<StockRealtime> indices = stockRealtimeRepository.findBySymbolInAndType(MAIN_INDICES, MarketConstants.INDEX_TYPE);
        
        if (!indices.isEmpty()) {
            log.debug("Found {} indices in stock_realtime", indices.size());
            return indices.stream()
                    .map(marketServiceSupport::mapToMarketIndexDto)
                    .toList();
        }
        
        // Fallback: try to get from stock_basic with type='INDEX'
        log.warn("No index data found in stock_realtime with type='INDEX', checking stock_basic");
        List<StockBasic> basicIndices = stockBasicRepository.findBySymbolInAndType(MAIN_INDICES, MarketConstants.INDEX_TYPE);
        
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
