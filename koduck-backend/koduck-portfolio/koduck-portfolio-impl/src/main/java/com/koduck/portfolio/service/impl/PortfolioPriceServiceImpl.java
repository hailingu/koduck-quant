package com.koduck.portfolio.service.impl;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.api.MarketQueryService;
import com.koduck.portfolio.config.PortfolioCacheConfig;
import com.koduck.portfolio.service.PortfolioPriceService;
import com.koduck.portfolio.service.SymbolKey;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Portfolio price service implementation.
 * Provides optimized batch price queries to solve N+1 problem.
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioPriceServiceImpl implements PortfolioPriceService {

    private final MarketQueryService marketQueryService;

    @Override
    @Cacheable(value = PortfolioCacheConfig.CACHE_PRICE_LATEST,
               key = "#market + ':' + #symbol + ':' + #timeframe")
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
        Objects.requireNonNull(market, "market must not be null");
        Objects.requireNonNull(symbol, "symbol must not be null");

        try {
            Optional<PriceQuoteDto> quoteOpt = marketQueryService.getStockDetail(symbol);
            return quoteOpt.map(PriceQuoteDto::price);
        } catch (Exception e) {
            log.warn("Failed to get latest price for {}/{}: {}", market, symbol, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    @Cacheable(value = PortfolioCacheConfig.CACHE_PRICE_PREVIOUS_CLOSE,
               key = "#market + ':' + #symbol + ':' + #timeframe")
    public Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe) {
        Objects.requireNonNull(market, "market must not be null");
        Objects.requireNonNull(symbol, "symbol must not be null");

        try {
            Optional<PriceQuoteDto> quoteOpt = marketQueryService.getStockDetail(symbol);
            return quoteOpt.map(PriceQuoteDto::prevClose);
        } catch (Exception e) {
            log.warn("Failed to get previous close price for {}/{}: {}",
                    market, symbol, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public Map<String, BigDecimal> getLatestPrices(List<SymbolKey> symbols, String timeframe) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, BigDecimal> result = new HashMap<>();
        
        // Process each symbol individually for now
        // In production, this should call a batch API from market module
        for (SymbolKey symbolKey : symbols) {
            try {
                Optional<BigDecimal> priceOpt = getLatestPrice(
                        symbolKey.market(), symbolKey.symbol(),
                        timeframe != null ? timeframe : MarketConstants.DEFAULT_TIMEFRAME);
                priceOpt.ifPresent(price -> result.put(symbolKey.toKey(), price));
            } catch (Exception e) {
                log.warn("Failed to get price for {}: {}", symbolKey.toKey(), e.getMessage());
            }
        }

        return result;
    }

    @Override
    public Map<String, BigDecimal> getPreviousClosePrices(List<SymbolKey> symbols, String timeframe) {
        if (symbols == null || symbols.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, BigDecimal> result = new HashMap<>();
        
        // Process each symbol individually for now
        // In production, this should call a batch API from market module
        for (SymbolKey symbolKey : symbols) {
            try {
                Optional<BigDecimal> priceOpt = getPreviousClosePrice(
                        symbolKey.market(), symbolKey.symbol(),
                        timeframe != null ? timeframe : MarketConstants.DEFAULT_TIMEFRAME);
                priceOpt.ifPresent(price -> result.put(symbolKey.toKey(), price));
            } catch (Exception e) {
                log.warn("Failed to get previous close price for {}: {}",
                        symbolKey.toKey(), e.getMessage());
            }
        }

        return result;
    }
}
