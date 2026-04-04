package com.koduck.service.impl.market;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
import com.koduck.service.support.market.MarketDtoMapper;
import com.koduck.service.support.market.MockSectorNetworkGenerator;

import lombok.extern.slf4j.Slf4j;

/**
 * 市场数据服务实现类。
 * 从PostgreSQL数据库读取数据，使用Redis缓存。
 */
@Service
@Slf4j
public class MarketServiceImpl implements MarketService {

    private static final String POSITIVE_LINK_TYPE = "positive";
    private static final String NEGATIVE_LINK_TYPE = "negative";
    
    // 主要指数代码
    private static final List<String> MAIN_INDICES = List.of(
            MarketConstants.A_SHARE_INDEX_SYMBOL,  // 上证指数
            "399001",     // 深证成指
            "399006"      // 创业板指
    );
    
    private final StockRealtimeRepository stockRealtimeRepository;
    private final StockBasicRepository stockBasicRepository;
    private final StockCacheService stockCacheService;
    private final MarketDtoMapper marketDtoMapper;
    private final MockSectorNetworkGenerator mockSectorNetworkGenerator;
    private final MarketFallbackSupport marketFallbackSupport;

    public MarketServiceImpl(
            StockRealtimeRepository stockRealtimeRepository,
            StockBasicRepository stockBasicRepository,
            StockCacheService stockCacheService,
            MarketDtoMapper marketDtoMapper,
            MockSectorNetworkGenerator mockSectorNetworkGenerator,
            MarketFallbackSupport marketFallbackSupport) {
        this.stockRealtimeRepository = stockRealtimeRepository;
        this.stockBasicRepository = stockBasicRepository;
        this.stockCacheService = stockCacheService;
        this.marketDtoMapper = marketDtoMapper;
        this.mockSectorNetworkGenerator = mockSectorNetworkGenerator;
        this.marketFallbackSupport = marketFallbackSupport;
    }
    
    /**
     * 根据关键词搜索股票代码，并返回丰富的实时字段。
     *
     * @param keyword 代码/名称关键词
     * @param page    1开始的页码
     * @param size    每页大小
     * @return 匹配的代码列表或空列表
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

        // 在stock_basic表中搜索
        var pageResult = stockBasicRepository.searchByKeyword(keyword, PageRequest.of(page - 1, size));
        List<StockBasic> basics = pageResult.getContent();
        
        if (basics.isEmpty()) {
            log.info("No symbols found in stock_basic, fallback to data service: keyword={}, size={}", keyword, size);
            return searchSymbolsFromProvider(keyword, size);
        }
        
        // 获取代码用于批量查询
        List<String> symbols = basics.stream().map(StockBasic::getSymbol).toList();
        
        // 批量获取实时价格
        Map<String, StockRealtime> realtimeMap = stockRealtimeRepository.findBySymbolIn(symbols)
                .stream()
                .collect(Collectors.toMap(StockRealtime::getSymbol, Function.identity()));
        
        // 合并信息并按规范市场+代码去重，避免
        // 重复行如 "002885" 和 "2885"。
        Map<String, SymbolInfoDto> deduplicated = new LinkedHashMap<>();
        for (StockBasic basic : basics) {
            SymbolInfoDto dto = marketDtoMapper.mapToSymbolInfoDto(basic, realtimeMap.get(basic.getSymbol()));
            String key = dto.market() + ":" + dto.symbol();
            SymbolInfoDto existing = deduplicated.get(key);
            if (existing == null || marketDtoMapper.shouldReplaceSymbol(existing, dto)) {
                deduplicated.put(key, dto);
            }
        }

        return new ArrayList<>(deduplicated.values());
    }

    private List<SymbolInfoDto> searchSymbolsFromProvider(String keyword, int size) {
        return marketFallbackSupport.searchSymbolsFromProvider(keyword, size);
    }
    
    /**
     * 获取股票的实时行情详情。
     *
     * @param symbol 股票代码
     * @return 找到时的行情，否则返回{@code null}
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
            return marketDtoMapper.mapToPriceQuoteDto(entity);
        });
    }

    /**
     * 执行行情获取，带降级链：
     * 1. 主获取器（数据库）
     * 2. K线数据降级
     * 3. 提供商数据降级
     * 4. 抛出ResourceNotFoundException
     *
     * @param symbol         股票代码
     * @param primaryFetcher 主数据获取器
     * @return 行情报价
     * @throws ResourceNotFoundException 当所有降级源都失败时抛出
     */
    private PriceQuoteDto withQuoteFallback(String symbol, Supplier<PriceQuoteDto> primaryFetcher) {
        try {
            PriceQuoteDto result = primaryFetcher.get();
            if (result != null) {
                return result;
            }
        }
        catch (RuntimeException e) {
            log.error("Error fetching stock detail: symbol={}, error={}", symbol, e.getMessage(), e);
        }

        // 降级1：尝试K线数据
        PriceQuoteDto fallbackQuote = marketFallbackSupport.tryBuildQuoteFromLatestKline(symbol);
        if (fallbackQuote != null) {
            log.info("Recovered stock detail from kline data: symbol={}", symbol);
            return fallbackQuote;
        }

        // 降级2：尝试提供商
        PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
        if (providerQuote != null) {
            log.info("Recovered stock detail from data service: symbol={}", symbol);
            return providerQuote;
        }

        log.warn("Stock not found in any data source: {}", symbol);
        throw new ResourceNotFoundException(ErrorCode.MARKET_SYMBOL_NOT_FOUND, "stock", symbol);
    }

    /**
     * 从数据服务获取股票的估值指标。
     *
     * @param symbol 股票代码
     * @return 找到时的估值，否则返回{@code null}
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
     * 从数据服务获取股票的行业元数据。
     *
     * @param symbol 股票代码
     * @return 找到时的行业元数据，否则返回{@code null}
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
        }
        catch (RuntimeException e) {
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
            }
            else {
                log.debug("Batch industry query success: got {}/{}", results.size(), validSymbols.size());
            }

            return results;
        }
        catch (RuntimeException e) {
            log.error("Batch stock industry query failed: symbols={}, error={}", validSymbols, e.getMessage(), e);
            // 降级：返回空map，避免抛出异常影响主流程
            return Collections.emptyMap();
        }
    }
    
    /**
     * 使用缓存优先策略批量获取实时行情。
     *
     * @param symbols 保持输出顺序的输入代码
     * @return 从缓存和数据库合并的行情列表
     */
    @Override
    public List<PriceQuoteDto> getBatchPrices(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyList();
        }
        
        // 优先从缓存获取
        List<PriceQuoteDto> cachedQuotes = stockCacheService.getCachedStockTracks(symbols);
        
        // 找出不在缓存中的代码
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
        }
        else {
            uncachedSymbols = new ArrayList<>(symbols);
        }
        
        // 如果全部来自缓存，直接返回
        if (uncachedSymbols.isEmpty()) {
            return cachedQuotes;
        }
        
        // 从数据库获取未缓存的代码
        log.debug("Getting batch prices from database: count={}", uncachedSymbols.size());
        List<StockRealtime> entities = stockRealtimeRepository.findBySymbolIn(uncachedSymbols);
        
        // 转换为DTO
        List<PriceQuoteDto> dbQuotes = entities.stream()
            .map(marketDtoMapper::mapToPriceQuoteDto)
                .toList();
        
        // 缓存数据库结果
        if (!dbQuotes.isEmpty()) {
            stockCacheService.cacheBatchStockTracks(dbQuotes);
        }
        
        // 合并结果（缓存优先，然后数据库结果）
        List<PriceQuoteDto> result = new ArrayList<>();
        if (cachedQuotes != null) {
            result.addAll(cachedQuotes);
        }
        result.addAll(dbQuotes);
        
        // 按原始顺序排序
        Map<String, PriceQuoteDto> quoteMap = result.stream()
                .collect(Collectors.toMap(PriceQuoteDto::symbol, Function.identity()));
        return symbols.stream()
                .filter(quoteMap::containsKey)
                .map(quoteMap::get)
                .toList();
    }

    /**
     * 获取股票的每日交易统计信息。
     * <p>返回开盘/最高/最低/当前价格、变动指标、成交量和成交额。</p>
     *
     * @param symbol 股票代码
     * @param market 市场代码
     * @return 找到时的股票统计，否则返回{@code null}
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
                return marketDtoMapper.mapToStockStatsDto(entity, market);
            }
            return null;
        });
    }

    /**
     * 执行统计信息获取，带降级链：
     * 1. 主获取器（数据库）
     * 2. K线数据降级
     * 3. 提供商数据降级（转换为统计信息）
     * 4. 抛出ResourceNotFoundException
     *
     * @param symbol         股票代码
     * @param market         市场代码
     * @param primaryFetcher 主数据获取器
     * @return 股票统计
     * @throws ResourceNotFoundException 当所有降级源都失败时抛出
     */
    private StockStatsDto withStatsFallback(String symbol, String market,
                                           Supplier<StockStatsDto> primaryFetcher) {
        try {
            StockStatsDto result = primaryFetcher.get();
            if (result != null) {
                return result;
            }
        }
        catch (RuntimeException e) {
            log.error("Error fetching stock stats: symbol={}, error={}", symbol, e.getMessage(), e);
        }

        // 降级1：尝试K线数据
        StockStatsDto klineStats = marketFallbackSupport.tryBuildStatsFromKline(symbol, market);
        if (klineStats != null) {
            log.info("Recovered stock stats from kline data: symbol={}", symbol);
            return klineStats;
        }

        // 降级2：尝试提供商
        PriceQuoteDto providerQuote = marketFallbackSupport.fetchProviderPrice(symbol);
        if (providerQuote != null) {
            log.info("Recovered stock stats from data service: symbol={}", symbol);
            return marketDtoMapper.mapPriceQuoteToStats(providerQuote, market);
        }

        log.warn("Stock stats not found in any data source: symbol={}", symbol);
        throw new ResourceNotFoundException(ErrorCode.MARKET_DATA_NOT_FOUND, "stock stats", symbol);
    }
    
    /**
     * 获取主要市场指数行情。
     *
     * @return 来自实时数据的指数列表，使用stock-basic降级
     */
    @Override
    @Cacheable(value = CacheConfig.CACHE_MARKET_INDICES, key = "'main'", unless = "#result == null || #result.isEmpty()")
    public List<MarketIndexDto> getMarketIndices() {
        log.debug("Getting market indices from database");
        
        // 从stock_realtime获取指数数据，按type='INDEX'过滤
        // 避免与具有相同代码的股票冲突（例如，000001 = 上证指数 vs 平安银行）
        List<StockRealtime> indices = stockRealtimeRepository.findBySymbolInAndType(MAIN_INDICES, MarketConstants.INDEX_TYPE);
        
        if (!indices.isEmpty()) {
            log.debug("Found {} indices in stock_realtime", indices.size());
            return indices.stream()
                    .map(marketDtoMapper::mapToMarketIndexDto)
                    .toList();
        }
        
        // 降级：尝试从stock_basic获取type='INDEX'的数据
        log.warn("No index data found in stock_realtime with type='INDEX', checking stock_basic");
        List<StockBasic> basicIndices = stockBasicRepository.findBySymbolInAndType(MAIN_INDICES, MarketConstants.INDEX_TYPE);
        
        if (basicIndices.isEmpty()) {
            log.warn("No index data found in stock_basic with type='INDEX'. " +
                     "Ensure data-service is running and updating indices.");
            return Collections.emptyList();
        }
        
        log.debug("Found {} indices in stock_basic", basicIndices.size());
        // 从StockBasic映射为MarketIndexDto（不含价格数据）
        return basicIndices.stream()
            .map(marketDtoMapper::mapBasicToMarketIndexDto)
                .toList();
    }
    
    /**
     * 按交易量获取热门股票。
     * 返回按交易量降序排列的股票。
     *
     * @param market 市场代码（例如 "AShare"）
     * @param limit  返回的股票数量
     * @return 热门股票列表
     */
    @Override
    public List<SymbolInfoDto> getHotStocks(String market, int limit) {
        log.debug("Getting hot stocks: market={}, limit={}", market, limit);
        try {
            List<StockRealtime> hotStocks = stockRealtimeRepository.findTopByVolume(PageRequest.of(0, limit));
            if (hotStocks.isEmpty()) {
                log.warn("No hot stocks found in database");
                return Collections.emptyList();
            }

            List<String> symbols = hotStocks.stream().map(StockRealtime::getSymbol).toList();
            List<StockBasic> basics = stockBasicRepository.findBySymbolIn(symbols);
            Map<String, StockBasic> basicMap = basics.stream()
                    .collect(Collectors.toMap(StockBasic::getSymbol, Function.identity(), (a, b) -> a));

            return hotStocks.stream()
                    .map(realtime -> marketDtoMapper.mapRealtimeToSymbolInfoDto(realtime,
                            basicMap.get(realtime.getSymbol()), market))
                    .filter(Objects::nonNull)
                    .limit(limit)
                    .toList();
        }
        catch (RuntimeException e) {
            log.error("Error getting hot stocks: market={}, limit={}, error={}",
                    market, limit, e.getMessage(), e);
            return Collections.emptyList();
        }
    }
    
    // ============ 板块网络方法 ============

    @Override
    public SectorNetworkDto getSectorNetwork(String market) {
        log.debug("Getting sector network data for market: {}", market);
        return mockSectorNetworkGenerator.generate(POSITIVE_LINK_TYPE, NEGATIVE_LINK_TYPE);
    }
    
}
