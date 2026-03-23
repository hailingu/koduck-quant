package com.koduck.service.impl;

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
import com.koduck.service.KlineService;
import com.koduck.service.MarketService;
import com.koduck.service.StockCacheService;
import com.koduck.service.market.AKShareDataProvider;
import com.koduck.util.SymbolUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneOffset;
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

    private static final String DEFAULT_MARKET = "AShare";
    private static final String DAILY_TIMEFRAME = "1D";
    
    // Main index symbols
    private static final List<String> MAIN_INDICES = List.of(
            "000001",  // 
            "399001",  // 
            "399006"   // 
    );
    
    private final StockRealtimeRepository stockRealtimeRepository;
    private final StockBasicRepository stockBasicRepository;
    private final StockCacheService stockCacheService;
    private final KlineService klineService;
    private final AKShareDataProvider akShareDataProvider;
    
    public MarketServiceImpl(
            StockRealtimeRepository stockRealtimeRepository,
            StockBasicRepository stockBasicRepository,
            StockCacheService stockCacheService,
            KlineService klineService,
            AKShareDataProvider akShareDataProvider) {
        this.stockRealtimeRepository = stockRealtimeRepository;
        this.stockBasicRepository = stockBasicRepository;
        this.stockCacheService = stockCacheService;
        this.klineService = klineService;
        this.akShareDataProvider = akShareDataProvider;
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
        
        // Combine info and de-duplicate by canonical market+symbol to avoid
        // duplicate rows such as "002885" and "2885".
        Map<String, SymbolInfoDto> deduplicated = new LinkedHashMap<>();
        for (StockBasic basic : basics) {
            SymbolInfoDto dto = mapToSymbolInfoDto(basic, realtimeMap.get(basic.getSymbol()));
            String key = dto.market() + ":" + dto.symbol();
            SymbolInfoDto existing = deduplicated.get(key);
            if (existing == null || shouldReplaceSymbol(existing, dto)) {
                deduplicated.put(key, dto);
            }
        }

        return new ArrayList<>(deduplicated.values());
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
                PriceQuoteDto fallbackQuote = tryBuildQuoteFromLatestKline(symbol);
                if (fallbackQuote != null) {
                    log.info("Built stock detail from latest kline data: symbol={}", symbol);
                    return fallbackQuote;
                }

                PriceQuoteDto providerQuote = akShareDataProvider.getPrice(symbol);
                if (providerQuote != null) {
                    log.info("Fetched stock detail from data service: symbol={}", symbol);
                    return providerQuote;
                }

                log.warn("Stock not found in realtime or kline data: {}", symbol);
                return null;
            }
            
            log.debug("Found stock: symbol={}, name={}, price={}", 
                    entity.getSymbol(), entity.getName(), entity.getPrice());
            
            return mapToPriceQuoteDto(entity);
        } catch (Exception e) {
            log.error("Error getting stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
            PriceQuoteDto fallbackQuote = tryBuildQuoteFromLatestKline(symbol);
            if (fallbackQuote != null) {
                log.info("Recovered stock detail from latest kline after exception: symbol={}", symbol);
                return fallbackQuote;
            }

            PriceQuoteDto providerQuote = akShareDataProvider.getPrice(symbol);
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
            return akShareDataProvider.getStockValuation(symbol);
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
            return akShareDataProvider.getStockIndustry(symbol);
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
                return mapToStockStatsDto(entity, market);
            }
            
            // Fallback: try to build from kline data
            StockStatsDto klineStats = tryBuildStatsFromKline(symbol, market);
            if (klineStats != null) {
                log.info("Built stock stats from kline data: symbol={}", symbol);
                return klineStats;
            }
            
            // Final fallback: try data provider
            PriceQuoteDto providerQuote = akShareDataProvider.getPrice(symbol);
            if (providerQuote != null) {
                return mapPriceQuoteToStats(providerQuote, market);
            }
            
            log.warn("Stock stats not found for symbol={}", symbol);
            return null;
            
        } catch (Exception e) {
            log.error("Error getting stock stats: symbol={}, error={}", symbol, e.getMessage(), e);
            
            // Try fallback on exception
            StockStatsDto klineStats = tryBuildStatsFromKline(symbol, market);
            if (klineStats != null) {
                return klineStats;
            }
            
            PriceQuoteDto providerQuote = akShareDataProvider.getPrice(symbol);
            if (providerQuote != null) {
                return mapPriceQuoteToStats(providerQuote, market);
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
        log.debug("Getting hot stocks: market={}, limit={}", market, limit);
        
        try {
            // Get stocks ordered by volume from database
            List<StockRealtime> hotStocks = stockRealtimeRepository.findTopByVolume(limit);
            
            if (hotStocks.isEmpty()) {
                log.warn("No hot stocks found in database");
                return Collections.emptyList();
            }
            
            // Get symbols for batch lookup of basic info
            List<String> symbols = hotStocks.stream()
                    .map(StockRealtime::getSymbol)
                    .toList();
            
            // Get basic info for these stocks
            List<StockBasic> basics = stockBasicRepository.findBySymbolIn(symbols);
            Map<String, StockBasic> basicMap = basics.stream()
                    .collect(Collectors.toMap(StockBasic::getSymbol, Function.identity(), (a, b) -> a));
            
            // Map to DTOs
            return hotStocks.stream()
                    .map(realtime -> mapRealtimeToSymbolInfoDto(realtime, basicMap.get(realtime.getSymbol()), market))
                    .filter(dto -> dto != null)
                    .limit(limit)
                    .toList();
                    
        } catch (Exception e) {
            log.error("Error getting hot stocks: market={}, limit={}, error={}", market, limit, e.getMessage(), e);
            return Collections.emptyList();
        }
    }
    
    private SymbolInfoDto mapRealtimeToSymbolInfoDto(StockRealtime realtime, StockBasic basic, String defaultMarket) {
        if (realtime == null) {
            return null;
        }
        
        String market = defaultMarket;
        String name = realtime.getName();
        
        if (basic != null) {
            if (basic.getMarket() != null && !basic.getMarket().isBlank()) {
                market = basic.getMarket();
            }
            if (basic.getName() != null && !basic.getName().isBlank()) {
                name = basic.getName();
            }
        }
        
        return SymbolInfoDto.builder()
                .symbol(realtime.getSymbol())
                .name(name)
                .market(market)
                .price(realtime.getPrice())
                .changePercent(realtime.getChangePercent())
                .volume(realtime.getVolume())
                .amount(realtime.getAmount())
                .build();
    }
    
    // ============ Mapping Methods ============
    
    private SymbolInfoDto mapToSymbolInfoDto(StockBasic basic, StockRealtime realtime) {
        String normalizedSymbol = SymbolUtils.normalize(basic.getSymbol());

        if (realtime != null) {
            return SymbolInfoDto.builder()
                    .symbol(normalizedSymbol)
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
            .symbol(normalizedSymbol)
                .name(basic.getName())
                .market(basic.getMarket())
                .build();
    }

    private boolean shouldReplaceSymbol(SymbolInfoDto existing, SymbolInfoDto candidate) {
        if (existing.price() == null && candidate.price() != null) {
            return true;
        }
        if (existing.changePercent() == null && candidate.changePercent() != null) {
            return true;
        }
        if (existing.volume() == null && candidate.volume() != null) {
            return true;
        }
        return existing.amount() == null && candidate.amount() != null;
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

    private PriceQuoteDto buildQuoteFromLatestKline(String symbol) {
        StockBasic basic = stockBasicRepository.findBySymbol(symbol).orElse(null);
        if (basic == null) {
            return null;
        }

        String market = basic.getMarket() != null && !basic.getMarket().isBlank()
                ? basic.getMarket()
                : DEFAULT_MARKET;

        PriceQuoteDto quote = buildQuoteFromKline(symbol, basic, market);
        if (quote != null) {
            return quote;
        }

        if (!DEFAULT_MARKET.equals(market)) {
            return buildQuoteFromKline(symbol, basic, DEFAULT_MARKET);
        }

        return null;
    }

    private PriceQuoteDto tryBuildQuoteFromLatestKline(String symbol) {
        try {
            return buildQuoteFromLatestKline(symbol);
        } catch (Exception ex) {
            log.warn("Failed to build quote from kline: symbol={}, error={}", symbol, ex.getMessage());
            return null;
        }
    }

    private PriceQuoteDto buildQuoteFromKline(String symbol, StockBasic basic, String market) {
        List<com.koduck.dto.market.KlineDataDto> recent =
            klineService.getKlineData(market, symbol, DAILY_TIMEFRAME, 2, null);
        recent = normalizeKlineData(recent);
        if (recent.isEmpty()) {
            return null;
        }

        com.koduck.dto.market.KlineDataDto latest = recent.get(recent.size() - 1);
        BigDecimal prevClose = recent.size() >= 2 ? recent.get(recent.size() - 2).close() : null;
        BigDecimal price = latest.close();
        BigDecimal change = calculateChange(price, prevClose);
        BigDecimal changePercent = calculateChangePercent(change, prevClose);

        return PriceQuoteDto.builder()
            .symbol(symbol)
            .name(basic.getName())
            .price(price)
            .open(latest.open())
            .high(latest.high())
            .low(latest.low())
            .prevClose(prevClose)
            .volume(latest.volume())
            .amount(latest.amount())
            .change(change)
            .changePercent(changePercent)
            .timestamp(latest.timestamp() != null ? Instant.ofEpochSecond(latest.timestamp()) : null)
            .build();
    }

    private List<com.koduck.dto.market.KlineDataDto> normalizeKlineData(
            List<com.koduck.dto.market.KlineDataDto> rawData) {
        if (rawData == null || rawData.isEmpty()) {
            return Collections.emptyList();
        }

        List<com.koduck.dto.market.KlineDataDto> normalized = new ArrayList<>();
        for (Object item : rawData) {
            if (item instanceof com.koduck.dto.market.KlineDataDto dto) {
                normalized.add(dto);
                continue;
            }
            if (item instanceof Map<?, ?> map) {
                normalized.add(
                    com.koduck.dto.market.KlineDataDto.builder()
                        .timestamp(toLong(map.get("timestamp")))
                        .open(toBigDecimal(map.get("open")))
                        .high(toBigDecimal(map.get("high")))
                        .low(toBigDecimal(map.get("low")))
                        .close(toBigDecimal(map.get("close")))
                        .volume(toLong(map.get("volume")))
                        .amount(toBigDecimal(map.get("amount")))
                        .build()
                );
            }
        }
        return normalized;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private BigDecimal calculateChange(BigDecimal price, BigDecimal prevClose) {
        if (price == null || prevClose == null) {
            return null;
        }
        return price.subtract(prevClose);
    }

    private BigDecimal calculateChangePercent(BigDecimal change, BigDecimal prevClose) {
        if (change == null || prevClose == null || BigDecimal.ZERO.compareTo(prevClose) == 0) {
            return null;
        }
        return change.multiply(BigDecimal.valueOf(100))
                .divide(prevClose, 4, RoundingMode.HALF_UP);
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
    
    // ============ StockStats Helper Methods ============
    
    private StockStatsDto mapToStockStatsDto(StockRealtime entity, String market) {
        return StockStatsDto.builder()
                .symbol(entity.getSymbol())
                .market(market)
                .open(entity.getOpenPrice())
                .high(entity.getHigh())
                .low(entity.getLow())
                .current(entity.getPrice())
                .prevClose(entity.getPrevClose())
                .change(entity.getChangeAmount())
                .changePercent(entity.getChangePercent())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .timestamp(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
                .build();
    }
    
    private StockStatsDto mapPriceQuoteToStats(PriceQuoteDto quote, String market) {
        return StockStatsDto.builder()
                .symbol(quote.symbol())
                .market(market)
                .open(quote.open())
                .high(quote.high())
                .low(quote.low())
                .current(quote.price())
                .prevClose(quote.prevClose())
                .change(quote.change())
                .changePercent(quote.changePercent())
                .volume(quote.volume())
                .amount(quote.amount())
                .timestamp(quote.timestamp())
                .build();
    }
    
    private StockStatsDto tryBuildStatsFromKline(String symbol, String market) {
        try {
            StockBasic basic = stockBasicRepository.findBySymbol(symbol).orElse(null);
            if (basic == null) {
                return null;
            }
            
            String actualMarket = market != null && !market.isBlank() ? market : 
                    (basic.getMarket() != null && !basic.getMarket().isBlank() ? basic.getMarket() : DEFAULT_MARKET);
            
            List<com.koduck.dto.market.KlineDataDto> recent =
                    klineService.getKlineData(actualMarket, symbol, DAILY_TIMEFRAME, 2, null);
            recent = normalizeKlineData(recent);
            
            if (recent.isEmpty()) {
                return null;
            }
            
            com.koduck.dto.market.KlineDataDto latest = recent.get(recent.size() - 1);
            BigDecimal prevClose = recent.size() >= 2 ? recent.get(recent.size() - 2).close() : null;
            BigDecimal current = latest.close();
            BigDecimal change = calculateChange(current, prevClose);
            BigDecimal changePercent = calculateChangePercent(change, prevClose);
            
            return StockStatsDto.builder()
                    .symbol(symbol)
                    .market(actualMarket)
                    .open(latest.open())
                    .high(latest.high())
                    .low(latest.low())
                    .current(current)
                    .prevClose(prevClose)
                    .change(change)
                    .changePercent(changePercent)
                    .volume(latest.volume())
                    .amount(latest.amount())
                    .timestamp(latest.timestamp() != null ? Instant.ofEpochSecond(latest.timestamp()) : null)
                    .build();
        } catch (Exception ex) {
            log.warn("Failed to build stats from kline: symbol={}, error={}", symbol, ex.getMessage());
            return null;
        }
    }

    // ============ Sector Network Methods ============

    @Override
    public SectorNetworkDto getSectorNetwork(String market) {
        log.debug("Getting sector network data for market: {}", market);
        
        // For now, return mock data
        // In production, this should fetch from industry/sector data tables
        // and calculate correlations based on historical price data
        return generateMockSectorNetwork();
    }
    
    private SectorNetworkDto generateMockSectorNetwork() {
        var nodes = List.of(
            SectorNetworkDto.SectorNode.builder()
                    .id("1").name("新能源").marketCap(new BigDecimal("8500"))
                    .flow(new BigDecimal("67.3")).change(new BigDecimal("3.2")).group(1).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("2").name("锂电池").marketCap(new BigDecimal("4200"))
                    .flow(new BigDecimal("34.2")).change(new BigDecimal("2.8")).group(1).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("3").name("光伏").marketCap(new BigDecimal("3800"))
                    .flow(new BigDecimal("28.5")).change(new BigDecimal("2.1")).group(1).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("4").name("储能").marketCap(new BigDecimal("2900"))
                    .flow(new BigDecimal("15.8")).change(new BigDecimal("1.9")).group(1).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("5").name("银行").marketCap(new BigDecimal("12000"))
                    .flow(new BigDecimal("45.2")).change(new BigDecimal("1.2")).group(2).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("6").name("保险").marketCap(new BigDecimal("5600"))
                    .flow(new BigDecimal("12.3")).change(new BigDecimal("0.8")).group(2).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("7").name("证券").marketCap(new BigDecimal("4800"))
                    .flow(new BigDecimal("-8.5")).change(new BigDecimal("-0.5")).group(2).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("8").name("科技").marketCap(new BigDecimal("9200"))
                    .flow(new BigDecimal("-67.5")).change(new BigDecimal("-2.8")).group(3).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("9").name("半导体").marketCap(new BigDecimal("6500"))
                    .flow(new BigDecimal("-45.2")).change(new BigDecimal("-2.1")).group(3).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("10").name("软件").marketCap(new BigDecimal("3800"))
                    .flow(new BigDecimal("-22.3")).change(new BigDecimal("-1.5")).group(3).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("11").name("医药").marketCap(new BigDecimal("7200"))
                    .flow(new BigDecimal("-12.1")).change(new BigDecimal("-0.8")).group(4).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("12").name("医疗器械").marketCap(new BigDecimal("3400"))
                    .flow(new BigDecimal("8.5")).change(new BigDecimal("0.5")).group(4).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("13").name("消费").marketCap(new BigDecimal("6800"))
                    .flow(new BigDecimal("23.4")).change(new BigDecimal("1.5")).group(5).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("14").name("白酒").marketCap(new BigDecimal("5200"))
                    .flow(new BigDecimal("18.9")).change(new BigDecimal("1.2")).group(5).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("15").name("汽车").marketCap(new BigDecimal("5800"))
                    .flow(new BigDecimal("15.6")).change(new BigDecimal("0.9")).group(6).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("16").name("军工").marketCap(new BigDecimal("4200"))
                    .flow(new BigDecimal("12.8")).change(new BigDecimal("0.7")).group(7).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("17").name("地产").marketCap(new BigDecimal("3600"))
                    .flow(new BigDecimal("-45.6")).change(new BigDecimal("-3.2")).group(8).build(),
            SectorNetworkDto.SectorNode.builder()
                    .id("18").name("建材").marketCap(new BigDecimal("2800"))
                    .flow(new BigDecimal("-18.9")).change(new BigDecimal("-1.8")).group(8).build()
        );
        
        var links = List.of(
            SectorNetworkDto.SectorLink.builder().source("1").target("2").value(new BigDecimal("0.85")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("3").value(new BigDecimal("0.78")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("4").value(new BigDecimal("0.72")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("3").value(new BigDecimal("0.65")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("6").value(new BigDecimal("0.68")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("7").value(new BigDecimal("0.55")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("9").value(new BigDecimal("0.82")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("8").target("10").value(new BigDecimal("0.75")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("9").target("10").value(new BigDecimal("0.70")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("11").target("12").value(new BigDecimal("0.62")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("13").target("14").value(new BigDecimal("0.58")).type("positive").build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("8").value(new BigDecimal("-0.65")).type("negative").build(),
            SectorNetworkDto.SectorLink.builder().source("1").target("5").value(new BigDecimal("-0.45")).type("negative").build(),
            SectorNetworkDto.SectorLink.builder().source("5").target("8").value(new BigDecimal("-0.55")).type("negative").build(),
            SectorNetworkDto.SectorLink.builder().source("2").target("9").value(new BigDecimal("-0.48")).type("negative").build()
        );
        
        return SectorNetworkDto.builder().nodes(nodes).links(links).build();
    }
}
