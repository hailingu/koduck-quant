package com.koduck.service;

import com.koduck.dto.market.MarketSentimentDto;
import com.koduck.market.MarketType;

/**
 * Market sentiment analysis service interface.
 * Calculates six-dimensional sentiment indicators for market analysis.
 *
 * @author GitHub Copilot
 */
public interface MarketSentimentService {

    /**
     * Get comprehensive market sentiment analysis.
     *
     * @param marketType the market type (A_SHARE, HK, US)
     * @return MarketSentimentDto containing six dimensions
     */
    MarketSentimentDto getMarketSentiment(MarketType marketType);
}
