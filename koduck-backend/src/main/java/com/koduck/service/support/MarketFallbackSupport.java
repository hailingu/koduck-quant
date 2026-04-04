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
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.market.StockBasic;
import com.koduck.market.MarketType;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.provider.ProviderFactory;
import com.koduck.repository.market.StockBasicRepository;
import com.koduck.service.KlineService;
import com.koduck.service.market.AKShareDataProvider;
import com.koduck.util.SymbolUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Fallback helper for provider and kline based market query recovery.
 *
 * @author Koduck Team
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MarketFallbackSupport {

    /** Stock type identifier. */
    private static final String STOCK_TYPE = MarketConstants.STOCK_TYPE;

    /** Repository for stock basic information. */
    private final StockBasicRepository stockBasicRepository;

    /** Service for kline data operations. */
    private final KlineService klineService;

    /** Factory for market data providers. */
    private final ProviderFactory providerFactory;

    /** Support service for market operations. */
    private final MarketServiceSupport marketServiceSupport;

    /**
     * Fetches price from provider.
     *
     * @param symbol the stock symbol
     * @return the price quote DTO, or null if not available
     */
    public PriceQuoteDto fetchProviderPrice(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getPrice(symbol))
            .orElse(null);
    }

    /**
     * Searches symbols from provider.
     *
     * @param keyword the search keyword
     * @param size    the maximum number of results
     * @return list of symbol info DTOs
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
     * Fetches valuation from provider.
     *
     * @param symbol the stock symbol
     * @return the stock valuation DTO, or null if not available
     */
    public StockValuationDto fetchProviderValuation(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockValuation(symbol))
            .orElse(null);
    }

    /**
     * Fetches industry from provider.
     *
     * @param symbol the stock symbol
     * @return the stock industry DTO, or null if not available
     */
    public StockIndustryDto fetchProviderIndustry(String symbol) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockIndustry(symbol))
            .orElse(null);
    }

    /**
     * Fetches industries for multiple symbols from provider.
     *
     * @param symbols the list of stock symbols
     * @return map of symbol to stock industry DTO
     */
    public Map<String, StockIndustryDto> fetchProviderIndustries(List<String> symbols) {
        return getAShareProvider()
            .flatMap(this::toAkShareProvider)
            .map(provider -> provider.getStockIndustries(symbols))
            .orElse(Collections.emptyMap());
    }

    /**
     * Tries to build quote from latest kline.
     *
     * @param symbol the stock symbol
     * @return the price quote DTO, or null if not available
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
     * Tries to build stats from kline.
     *
     * @param symbol the stock symbol
     * @param market the market code
     * @return the stock stats DTO, or null if not available
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

            List<com.koduck.dto.market.KlineDataDto> recent =
                klineService.getKlineData(actualMarket, symbol,
                        MarketConstants.DEFAULT_TIMEFRAME, 2, null);
            recent = marketServiceSupport.normalizeKlineData(recent);
            if (recent.isEmpty()) {
                return null;
            }

            com.koduck.dto.market.KlineDataDto latest =
                    recent.get(recent.size() - 1);
            BigDecimal prevClose = recent.size() >= 2
                    ? recent.get(recent.size() - 2).close() : null;
            BigDecimal current = latest.close();
            BigDecimal change = marketServiceSupport
                    .calculateChange(current, prevClose);
            BigDecimal changePercent = marketServiceSupport
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
        List<com.koduck.dto.market.KlineDataDto> recent =
            klineService.getKlineData(market, symbol, MarketConstants.DEFAULT_TIMEFRAME, 2, null);
        recent = marketServiceSupport.normalizeKlineData(recent);
        if (recent.isEmpty()) {
            return null;
        }

        com.koduck.dto.market.KlineDataDto latest =
                recent.get(recent.size() - 1);
        BigDecimal prevClose = recent.size() >= 2
                ? recent.get(recent.size() - 2).close() : null;
        BigDecimal price = latest.close();
        BigDecimal change = marketServiceSupport.calculateChange(price, prevClose);
        BigDecimal changePercent = marketServiceSupport
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
