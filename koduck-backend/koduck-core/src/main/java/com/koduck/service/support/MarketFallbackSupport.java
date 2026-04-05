package com.koduck.service.support;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.MarketConstants;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.dto.StockIndustryDto;
import com.koduck.market.dto.StockStatsDto;
import com.koduck.market.dto.StockValuationDto;
import com.koduck.market.dto.SymbolInfoDto;
import com.koduck.market.entity.StockBasic;
import com.koduck.market.MarketType;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.provider.ProviderFactory;
import com.koduck.repository.market.StockBasicRepository;
import com.koduck.service.KlineService;
import com.koduck.service.market.AKShareDataProvider;
import com.koduck.service.support.market.KlineDataNormalizer;
import com.koduck.service.support.market.MarketPriceCalculator;
import com.koduck.util.SymbolUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 基于数据提供商和K线查询的市场查询降级辅助类。
 *
 * @author Koduck Team
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MarketFallbackSupport {

    /** 股票类型标识。 */
    private static final String STOCK_TYPE = MarketConstants.STOCK_TYPE;

    /** 股票基本信息仓库。 */
    private final StockBasicRepository stockBasicRepository;

    /** K线数据操作服务。 */
    private final KlineService klineService;

    /** 市场数据提供商工厂。 */
    private final ProviderFactory providerFactory;

    /** K线数据规范化器。 */
    private final KlineDataNormalizer klineDataNormalizer;

    /** 价格变动计算器。 */
    private final MarketPriceCalculator marketPriceCalculator;

    /**
     * 从提供商获取价格。
     *
     * @param symbol 股票代码
     * @return 行情报价DTO，如不可用则返回null
     */
    public PriceQuoteDto fetchProviderPrice(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getPrice(symbol))
            .orElse(null);
    }

    /**
     * 从提供商搜索股票代码。
     *
     * @param keyword 搜索关键词
     * @param size    最大结果数
     * @return 股票信息DTO列表
     */
    public List<SymbolInfoDto> searchSymbolsFromProvider(String keyword, int size) {
        List<MarketDataProvider.SymbolInfo> providerResults = getAShareProvider()
            .map(provider -> provider.searchSymbols(keyword, size))
            .orElse(Collections.emptyList());
        if (providerResults == null || providerResults.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, SymbolInfoDto> deduplicated = new LinkedHashMap<>();
        for (MarketDataProvider.SymbolInfo symbolInfo : providerResults) {
            if (symbolInfo == null || symbolInfo.symbol() == null
                    || symbolInfo.symbol().isBlank()) {
                continue;
            }
            String normalizedSymbol = SymbolUtils.normalize(symbolInfo.symbol());
            String market = symbolInfo.market() == null || symbolInfo.market().isBlank()
                ? MarketConstants.DEFAULT_MARKET
                : symbolInfo.market();
            String name = symbolInfo.name() == null || symbolInfo.name().isBlank()
                ? normalizedSymbol
                : symbolInfo.name();

            SymbolInfoDto dto = SymbolInfoDto.builder()
                .symbol(normalizedSymbol)
                .name(name)
                .type(STOCK_TYPE)
                .market(market)
                .build();
            deduplicated.putIfAbsent(market + ":" + normalizedSymbol, dto);
        }

        if (deduplicated.isEmpty()) {
            return Collections.emptyList();
        }
        return deduplicated.values().stream().limit(size).toList();
    }

    /**
     * 从提供商获取估值。
     *
     * @param symbol 股票代码
     * @return 股票估值DTO，如不可用则返回null
     */
    public StockValuationDto fetchProviderValuation(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockValuation(symbol))
            .orElse(null);
    }

    /**
     * 从提供商获取行业信息。
     *
     * @param symbol 股票代码
     * @return 股票行业DTO，如不可用则返回null
     */
    public StockIndustryDto fetchProviderIndustry(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockIndustry(symbol))
            .orElse(null);
    }

    /**
     * 从提供商批量获取多只股票的行业信息。
     *
     * @param symbols 股票代码列表
     * @return 股票代码到行业DTO的映射
     */
    public Map<String, StockIndustryDto> fetchProviderIndustries(List<String> symbols) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockIndustries(symbols))
            .orElse(Collections.emptyMap());
    }

    /**
     * 尝试从最新K线构建行情。
     *
     * @param symbol 股票代码
     * @return 行情报价DTO，如不可用则返回null
     */
    public PriceQuoteDto tryBuildQuoteFromLatestKline(String symbol) {
        try {
            return buildQuoteFromLatestKline(symbol);
        }
        catch (Exception ex) {
            log.warn("Failed to build quote from kline: symbol={}, error={}",
                    symbol, ex.getMessage());
            return null;
        }
    }

    /**
     * 尝试从K线构建统计信息。
     *
     * @param symbol 股票代码
     * @param market 市场代码
     * @return 股票统计DTO，如不可用则返回null
     */
    public StockStatsDto tryBuildStatsFromKline(String symbol, String market) {
        try {
            StockBasic basic = stockBasicRepository.findBySymbol(symbol)
                    .orElse(null);
            if (basic == null) {
                return null;
            }

            String actualMarket = market;
            if (actualMarket == null || actualMarket.isBlank()) {
                String basicMarket = basic.getMarket();
                if (basicMarket != null && !basicMarket.isBlank()) {
                    actualMarket = basicMarket;
                }
                else {
                    actualMarket = MarketConstants.DEFAULT_MARKET;
                }
            }

            List<com.koduck.market.dto.KlineDataDto> recent =
                klineService.getKlineData(actualMarket, symbol,
                        MarketConstants.DEFAULT_TIMEFRAME, 2, null);
            recent = klineDataNormalizer.normalizeKlineData(recent);
            if (recent.isEmpty()) {
                return null;
            }

            com.koduck.market.dto.KlineDataDto latest =
                    recent.get(recent.size() - 1);
            BigDecimal prevClose = recent.size() >= 2
                    ? recent.get(recent.size() - 2).close() : null;
            BigDecimal current = latest.close();
            BigDecimal change = marketPriceCalculator
                    .calculateChange(current, prevClose);
            BigDecimal changePercent = marketPriceCalculator
                    .calculateChangePercent(change, prevClose);

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
                .timestamp(latest.timestamp() != null
                        ? Instant.ofEpochSecond(latest.timestamp()) : null)
                .build();
        }
        catch (Exception ex) {
            log.warn("Failed to build stats from kline: symbol={}, error={}",
                    symbol, ex.getMessage());
            return null;
        }
    }

    private Optional<MarketDataProvider> getAShareProvider() {
        return providerFactory.getPrimaryProvider(MarketType.A_SHARE);
    }

    private Optional<AKShareDataProvider> toAkShareProvider(
            MarketDataProvider provider) {
        if (provider instanceof AKShareDataProvider akShareProvider) {
            return Optional.of(akShareProvider);
        }
        log.warn("Primary provider for A_SHARE is not AKShareDataProvider: {}",
                provider.getProviderName());
        return Optional.empty();
    }

    private PriceQuoteDto buildQuoteFromLatestKline(String symbol) {
        StockBasic basic = stockBasicRepository.findBySymbol(symbol)
                .orElse(null);
        if (basic == null) {
            return null;
        }

        String market = basic.getMarket() != null && !basic.getMarket().isBlank()
                ? basic.getMarket() : MarketConstants.DEFAULT_MARKET;
        PriceQuoteDto quote = buildQuoteFromKline(symbol, basic, market);
        if (quote != null) {
            return quote;
        }
        if (!MarketConstants.DEFAULT_MARKET.equals(market)) {
            return buildQuoteFromKline(symbol, basic, MarketConstants.DEFAULT_MARKET);
        }
        return null;
    }

    private PriceQuoteDto buildQuoteFromKline(String symbol, StockBasic basic,
            String market) {
        List<com.koduck.market.dto.KlineDataDto> recent =
            klineService.getKlineData(market, symbol, MarketConstants.DEFAULT_TIMEFRAME, 2, null);
        recent = klineDataNormalizer.normalizeKlineData(recent);
        if (recent.isEmpty()) {
            return null;
        }

        com.koduck.market.dto.KlineDataDto latest =
                recent.get(recent.size() - 1);
        BigDecimal prevClose = recent.size() >= 2
                ? recent.get(recent.size() - 2).close() : null;
        BigDecimal price = latest.close();
        BigDecimal change = marketPriceCalculator.calculateChange(price, prevClose);
        BigDecimal changePercent = marketPriceCalculator
                .calculateChangePercent(change, prevClose);

        return PriceQuoteDto.builder()
            .symbol(symbol)
            .name(basic.getName())
            .type(STOCK_TYPE)
            .price(price)
            .open(latest.open())
            .high(latest.high())
            .low(latest.low())
            .prevClose(prevClose)
            .volume(latest.volume())
            .amount(latest.amount())
            .change(change)
            .changePercent(changePercent)
            .timestamp(latest.timestamp() != null
                    ? Instant.ofEpochSecond(latest.timestamp()) : null)
            .build();
    }
}
