package com.koduck.service.impl;

import com.koduck.config.CacheConfig;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
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
            "000001",  // 上证指数
            "399001",  // 深证成指
            "399006"   // 创业板指
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
    // @Cacheable disabled due to Redis serialization issues with Java Records
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
}
