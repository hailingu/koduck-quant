package com.koduck.service.impl.portfolio;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.koduck.service.KlineService;
import com.koduck.service.PortfolioPriceService;

import lombok.RequiredArgsConstructor;

/**
 * Implementation of PortfolioPriceService that delegates to KlineService.
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
public class PortfolioPriceServiceImpl implements PortfolioPriceService {

    private final KlineService klineService;

    @Override
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
        return klineService.getLatestPrice(market, symbol, timeframe);
    }

    @Override
    public Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe) {
        return klineService.getPreviousClosePrice(market, symbol, timeframe);
    }
}
