package com.koduck.service.impl;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.market.MarketSentimentDto;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.provider.ProviderFactory;
import com.koduck.service.MarketSentimentService;

import lombok.extern.slf4j.Slf4j;

/**
 * Market sentiment analysis service implementation.
 * Calculates six-dimensional sentiment indicators for market analysis.
 *
 * @author Koduck Team
 */
@Slf4j
@Service
public class MarketSentimentServiceImpl implements MarketSentimentService {

    /** Default score for neutral sentiment. */
    private static final int DEFAULT_NEUTRAL_SCORE = 50;

    /** Default score for low sentiment. */
    private static final int DEFAULT_LOW_SCORE = 30;

    /** Days for short-term klines. */
    private static final int DAYS_SHORT_TERM = 5;

    /** Days for medium-term klines. */
    private static final int DAYS_MEDIUM_TERM = 10;

    /** Days for long-term klines. */
    private static final int DAYS_LONG_TERM = 20;

    /** Days for extended klines. */
    private static final int DAYS_EXTENDED = 30;

    /** Days for full analysis period. */
    private static final int DAYS_FULL_PERIOD = 60;

    /** Days for volatility calculation. */
    private static final int DAYS_VOLATILITY = 14;

    /** Score scaling factor. */
    private static final int SCORE_SCALE = 100;

    /** Half scale for score calculations. */
    private static final int HALF_SCALE = 50;

    /** Threshold for strong uptrend. */
    private static final int UPTREND_THRESHOLD = 70;

    /** Threshold for strong downtrend. */
    private static final int DOWNTREND_THRESHOLD = 30;

    /** Trend calculation multiplier. */
    private static final int TREND_MULTIPLIER = 3;

    /** Volume boost threshold ratio. */
    private static final double VOLUME_BOOST_THRESHOLD = 2.0;

    /** Volume boost score increment. */
    private static final int VOLUME_BOOST_INCREMENT = 20;

    /** Volatility scaling factor. */
    private static final int VOLATILITY_SCALE = 20;

    /** Price momentum scaling factor. */
    private static final double PRICE_MOMENTUM_SCALE = 2.0;

    /** Fund flow boost threshold ratio. */
    private static final double FUND_FLOW_BOOST_THRESHOLD = 2.0;

    /** Fund flow boost increment. */
    private static final int FUND_FLOW_BOOST_INCREMENT = 10;

    /** Divisor for typical price calculation (high + low + close) / divisor. */
    private static final double TYPICAL_PRICE_DIVISOR = 3.0;

    /** Minimum days for trend calculation. */
    private static final int MIN_DAYS_FOR_TREND = 20;

    /** Minimum days for fear/greed calculation. */
    private static final int MIN_DAYS_FOR_FEAR_GREED = 10;

    /** Minimum days for fund flow calculation. */
    private static final int MIN_DAYS_FOR_FUND_FLOW = 5;

    /** High overall score threshold. */
    private static final int HIGH_OVERALL_THRESHOLD = 75;

    /** Medium-high overall score threshold. */
    private static final int MEDIUM_HIGH_OVERALL_THRESHOLD = 60;

    /** Medium overall score threshold. */
    private static final int MEDIUM_OVERALL_THRESHOLD = 40;

    /** Low overall score threshold. */
    private static final int LOW_OVERALL_THRESHOLD = 25;

    /** Strong trend strength threshold. */
    private static final int STRONG_TREND_THRESHOLD = 80;

    /** High fear/greed threshold. */
    private static final int HIGH_FEAR_GREED_THRESHOLD = 70;

    /** Low fear/greed threshold. */
    private static final int LOW_FEAR_GREED_THRESHOLD = 30;

    /** Weak trend strength threshold. */
    private static final int WEAK_TREND_THRESHOLD = 20;

    /** Dimension trend up threshold. */
    private static final int TREND_UP_THRESHOLD = 60;

    /** Dimension trend down threshold. */
    private static final int TREND_DOWN_THRESHOLD = 40;

    /** Minimum days for volume trend. */
    private static final int MIN_DAYS_VOLUME_TREND = 10;

    /** Volume trend recent period. */
    private static final int VOLUME_TREND_RECENT_PERIOD = 5;

    /** Weight for activity score. */
    private static final double WEIGHT_ACTIVITY = 0.15;

    /** Weight for volatility score. */
    private static final double WEIGHT_VOLATILITY = 0.10;

    /** Weight for trend strength score. */
    private static final double WEIGHT_TREND_STRENGTH = 0.25;

    /** Weight for fear/greed score. */
    private static final double WEIGHT_FEAR_GREED = 0.15;

    /** Weight for valuation score. */
    private static final double WEIGHT_VALUATION = 0.15;

    /** Weight for fund flow score. */
    private static final double WEIGHT_FUND_FLOW = 0.20;

    /**
     * The provider factory for market data.
     */
    private final ProviderFactory providerFactory;

    /**
     * Shanghai Composite Index as representative for A-share market.
     */
    private static final String A_SHARE_INDEX = MarketConstants.A_SHARE_INDEX_SYMBOL;

    /**
     * Tencent (00700) as proxy for HK market.
     */
    private static final String HK_INDEX = "00700";

    /**
     * Apple (AAPL) as proxy for US market.
     */
    private static final String US_INDEX = "AAPL";

    /**
     * Constructs a new MarketSentimentServiceImpl.
     *
     * @param providerFactory the provider factory for market data
     */
    public MarketSentimentServiceImpl(ProviderFactory providerFactory) {
        this.providerFactory = providerFactory;
    }

    @Override
    public MarketSentimentDto getMarketSentiment(MarketType marketType) {
        String symbol = getRepresentativeSymbol(marketType);
        log.debug("Calculating market sentiment for {} using symbol {}", marketType, symbol);
        try {
            // Key optimization: fetch 60-day klines once, reuse for all dimensions
            List<KlineData> klines60 = getRecentKlines(symbol, marketType, DAYS_FULL_PERIOD);
            // Calculate six dimensions
            int activity = calculateActivityScore(klines60);
            int volatility = calculateVolatilityScore(klines60);
            int trendStrength = calculateTrendStrengthScore(klines60);
            int fearGreed = calculateFearGreedScore(klines60);
            int valuation = calculateValuationScore(klines60);
            int fundFlow = calculateFundFlowScore(klines60);
            // Calculate overall score with weights
            double overall = calculateOverallScore(
                activity, volatility, trendStrength,
                fearGreed, valuation, fundFlow
            );
            String status = determineMarketStatus(overall, trendStrength, fearGreed);
            return MarketSentimentDto.builder()
                    .timestamp(Instant.now().toString())
                    .overall((int) Math.round(overall))
                    .status(status)
                    .market(marketType.getCode())
                    .dimensions(MarketSentimentDto.SentimentDimensions.builder()
                            .activity(createDimension(activity))
                            .volatility(createDimension(volatility))
                            .trendStrength(createDimension(trendStrength))
                            .fearGreed(createDimension(fearGreed))
                            .valuation(createDimension(valuation))
                            .fundFlow(createDimension(fundFlow))
                            .build())
                    .build();
        }
        catch (RuntimeException e) {
            log.error("Failed to calculate market sentiment for {}", marketType, e);
            // Return fallback data
            return createFallbackSentiment(marketType);
        }
    }

    /**
     * Calculate activity score (0-100) based on volume and turnover.
     *
     * @param klines60 the list of 60-day kline data
     * @return the activity score (0-100)
     */
    int calculateActivityScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_LONG_TERM);
            if (klines.isEmpty()) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Calculate average volume
            double avgVolume = klines.stream()
                    .mapToLong(KlineData::volume)
                    .average()
                    .orElse(0);
            // Get latest volume
            long latestVolume = klines.get(klines.size() - 1).volume();
            // Compare to 20-day average
            double ratio = avgVolume > 0 ? (double) latestVolume / avgVolume : 1.0;
            // Score: higher volume = higher activity (0-100)
            int score = (int) Math.min(SCORE_SCALE, Math.max(0, ratio * HALF_SCALE));
            // Boost score if volume is significantly higher
            if (ratio > VOLUME_BOOST_THRESHOLD) {
                score = Math.min(SCORE_SCALE, score + VOLUME_BOOST_INCREMENT);
            }
            return score;
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate activity score", e);
            return DEFAULT_NEUTRAL_SCORE;
        }
    }

    /**
     * Calculate volatility score (0-100) based on ATR-like measurement.
     *
     * @param klines60 the list of 60-day kline data
     * @return the volatility score (0-100)
     */
    int calculateVolatilityScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_VOLATILITY);
            if (klines.size() < 2) {
                return DEFAULT_LOW_SCORE;
            }
            // Calculate average true range
            double totalRange = 0;
            for (int i = 1; i < klines.size(); i++) {
                KlineData current = klines.get(i);
                KlineData previous = klines.get(i - 1);
                double high = current.high().doubleValue();
                double low = current.low().doubleValue();
                double prevClose = previous.close().doubleValue();
                double range = Math.max(high - low,
                    Math.max(Math.abs(high - prevClose), Math.abs(low - prevClose)));
                totalRange += range;
            }
            double avgRange = totalRange / (klines.size() - 1);
            double avgPrice = klines.stream()
                    .mapToDouble(k -> k.close().doubleValue())
                    .average()
                    .orElse(1);
            // Volatility as percentage of price
            double volatilityPct = avgPrice > 0 ? (avgRange / avgPrice) * SCORE_SCALE : 0;
            // Score: 0-100 based on volatility (higher volatility = higher score)
            // Typical daily volatility: 0.5% - 5%
            int score = (int) Math.min(SCORE_SCALE, Math.max(0, volatilityPct * VOLATILITY_SCALE));
            return score;
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate volatility score", e);
            return DEFAULT_LOW_SCORE;
        }
    }

    /**
     * Calculate trend strength score (0-100) based on moving averages.
     *
     * @param klines60 the list of 60-day kline data
     * @return the trend strength score (0-100)
     */
    int calculateTrendStrengthScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_FULL_PERIOD);
            if (klines.size() < MIN_DAYS_FOR_TREND) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Calculate short and long-term MAs
            double ma5 = calculateMA(klines, DAYS_SHORT_TERM);
            double ma10 = calculateMA(klines, DAYS_MEDIUM_TERM);
            double ma20 = calculateMA(klines, DAYS_LONG_TERM);
            // Trend alignment score
            int score = DEFAULT_NEUTRAL_SCORE; // neutral
            if (ma5 > ma10 && ma10 > ma20) {
                // Strong uptrend
                score = UPTREND_THRESHOLD
                    + (int) ((ma5 - ma20) / ma20 * SCORE_SCALE * TREND_MULTIPLIER);
            }
            else if (ma5 < ma10 && ma10 < ma20) {
                // Strong downtrend
                score = DOWNTREND_THRESHOLD
                    - (int) ((ma20 - ma5) / ma20 * SCORE_SCALE * TREND_MULTIPLIER);
            }
            return Math.max(0, Math.min(SCORE_SCALE, score));
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate trend strength score", e);
            return DEFAULT_NEUTRAL_SCORE;
        }
    }

    /**
     * Calculate fear/greed score (0-100).
     * 0 = extreme fear, 100 = extreme greed.
     *
     * @param klines60 the list of 60-day kline data
     * @return the fear/greed score (0-100)
     */
    int calculateFearGreedScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_EXTENDED);
            if (klines.size() < MIN_DAYS_FOR_FEAR_GREED) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Calculate price momentum
            double priceChange = calculatePriceChange(klines, DAYS_MEDIUM_TERM);
            double priceChange20 = calculatePriceChange(klines, DAYS_LONG_TERM);
            // Volume trend
            double volumeTrend = calculateVolumeTrend(klines);
            // Combine factors
            // Price up + volume up = greed
            // Price down + volume up = fear
            double greedScore = DEFAULT_NEUTRAL_SCORE
                + priceChange * PRICE_MOMENTUM_SCALE
                + priceChange20
                + volumeTrend * DAYS_MEDIUM_TERM;
            return Math.max(0, Math.min(SCORE_SCALE, (int) greedScore));
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate fear/greed score", e);
            return DEFAULT_NEUTRAL_SCORE;
        }
    }

    /**
     * Calculate valuation score (0-100).
     * Based on price relative to recent range.
     *
     * @param klines60 the list of 60-day kline data
     * @return the valuation score (0-100)
     */
    int calculateValuationScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_FULL_PERIOD);
            if (klines.size() < MIN_DAYS_FOR_TREND) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Find 60-day high and low
            double high60 = klines.stream()
                    .mapToDouble(k -> k.high().doubleValue())
                    .max()
                    .orElse(0);
            double low60 = klines.stream()
                    .mapToDouble(k -> k.low().doubleValue())
                    .min()
                    .orElse(0);
            double current = klines.get(klines.size() - 1).close().doubleValue();
            if (high60 <= low60) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Score based on position in range
            // 0 = at 60-day low (cheap), 100 = at 60-day high (expensive)
            double position = (current - low60) / (high60 - low60);
            int score = (int) (position * SCORE_SCALE);
            return Math.max(0, Math.min(SCORE_SCALE, score));
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate valuation score", e);
            return DEFAULT_NEUTRAL_SCORE;
        }
    }

    /**
     * Calculate fund flow score (0-100).
     * Based on price-volume relationship.
     *
     * @param klines60 the list of 60-day kline data
     * @return the fund flow score (0-100)
     */
    int calculateFundFlowScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, DAYS_LONG_TERM);
            if (klines.size() < MIN_DAYS_FOR_FUND_FLOW) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Calculate money flow
            double positiveFlow = 0;
            double negativeFlow = 0;
            for (KlineData kline : klines) {
                double close = kline.close().doubleValue();
                double open = kline.open().doubleValue();
                double high = kline.high().doubleValue();
                double low = kline.low().doubleValue();
                long volume = kline.volume();
                // Typical price
                double typicalPrice = (high + low + close) / TYPICAL_PRICE_DIVISOR;
                // Money flow
                double flow = typicalPrice * volume;
                if (close > open) {
                    positiveFlow += flow;
                }
                else {
                    negativeFlow += flow;
                }
            }
            double totalFlow = positiveFlow + negativeFlow;
            if (totalFlow == 0) {
                return DEFAULT_NEUTRAL_SCORE;
            }
            // Score: 0-100 based on positive flow ratio
            int score = (int) ((positiveFlow / totalFlow) * SCORE_SCALE);
            // Boost for strong inflow
            if (positiveFlow > negativeFlow * FUND_FLOW_BOOST_THRESHOLD) {
                score = Math.min(SCORE_SCALE, score + FUND_FLOW_BOOST_INCREMENT);
            }
            return score;
        }
        catch (RuntimeException e) {
            log.warn("Failed to calculate fund flow score", e);
            return DEFAULT_NEUTRAL_SCORE;
        }
    }

    /**
     * Calculate overall weighted score.
     *
     * @param activity the activity score
     * @param volatility the volatility score
     * @param trendStrength the trend strength score
     * @param fearGreed the fear/greed score
     * @param valuation the valuation score
     * @param fundFlow the fund flow score
     * @return the overall weighted score
     */
    double calculateOverallScore(int activity, int volatility, int trendStrength,
                                 int fearGreed, int valuation, int fundFlow) {
        // Weights as per requirements
        // activity: 0.15, volatility: 0.10, trendStrength: 0.25
        // fearGreed: 0.15, valuation: 0.15, fundFlow: 0.20
        return activity * WEIGHT_ACTIVITY
               + volatility * WEIGHT_VOLATILITY
               + trendStrength * WEIGHT_TREND_STRENGTH
               + fearGreed * WEIGHT_FEAR_GREED
               + valuation * WEIGHT_VALUATION
               + fundFlow * WEIGHT_FUND_FLOW;
    }

    /**
     * Determine market status based on overall score and key dimensions.
     *
     * @param overall the overall score
     * @param trendStrength the trend strength score
     * @param fearGreed the fear/greed score
     * @return the market status string
     */
    String determineMarketStatus(double overall, int trendStrength, int fearGreed) {
        if (overall >= HIGH_OVERALL_THRESHOLD) {
            return trendStrength > STRONG_TREND_THRESHOLD ? "strong_bullish" : "bullish";
        }
        else if (overall >= MEDIUM_HIGH_OVERALL_THRESHOLD) {
            return fearGreed > HIGH_FEAR_GREED_THRESHOLD ? "greedy" : "cautious_bullish";
        }
        else if (overall >= MEDIUM_OVERALL_THRESHOLD) {
            return "neutral";
        }
        else if (overall >= LOW_OVERALL_THRESHOLD) {
            return fearGreed < LOW_FEAR_GREED_THRESHOLD ? "fearful" : "cautious_bearish";
        }
        else {
            return trendStrength < WEAK_TREND_THRESHOLD ? "strong_bearish" : "bearish";
        }
    }

    /**
     * Get representative symbol for the given market type.
     *
     * @param marketType the market type
     * @return the representative symbol
     */
    String getRepresentativeSymbol(MarketType marketType) {
        return switch (marketType) {
            case A_SHARE -> A_SHARE_INDEX;
            case HK_STOCK -> HK_INDEX;
            case US_STOCK -> US_INDEX;
            default -> A_SHARE_INDEX;
        };
    }

    /**
     * Get recent kline data for the given symbol and market type.
     *
     * @param symbol the symbol
     * @param marketType the market type
     * @param limit the limit of klines to fetch
     * @return the list of kline data
     */
    List<KlineData> getRecentKlines(String symbol, MarketType marketType, int limit) {
        try {
            return providerFactory.getAvailableProvider(marketType)
                    .map(provider -> {
                        try {
                            return provider.getKlineData(
                                symbol,
                                MarketConstants.DEFAULT_TIMEFRAME,
                                limit,
                                Instant.now().minus(2L * limit, ChronoUnit.DAYS),
                                Instant.now()
                            );
                        }
                        catch (MarketDataProvider.MarketDataException e) {
                            log.warn("Failed to get kline data for {} from provider: {}",
                                symbol, e.getMessage());
                            return List.<KlineData>of();
                        }
                    }
                )
                    .orElse(List.of());
        }
        catch (RuntimeException e) {
            log.warn("Failed to get recent klines for {}: {}", symbol, e.getMessage());
            return List.of();
        }
    }

    /**
     * Get the last n klines from the list.
     *
     * @param klines the list of klines
     * @param limit the number of klines to get
     * @return the last n klines
     */
    private List<KlineData> tailKlines(List<KlineData> klines, int limit) {
        if (klines == null || klines.isEmpty()) {
            return List.of();
        }
        if (klines.size() <= limit) {
            return klines;
        }
        return klines.subList(klines.size() - limit, klines.size());
    }

    /**
     * Calculate moving average.
     *
     * @param klines the list of klines
     * @param period the period
     * @return the moving average
     */
    private double calculateMA(List<KlineData> klines, int period) {
        if (klines.size() < period) {
            return 0;
        }
        return klines.subList(klines.size() - period, klines.size()).stream()
                .mapToDouble(k -> k.close().doubleValue())
                .average()
                .orElse(0);
    }

    /**
     * Calculate price change percentage.
     *
     * @param klines the list of klines
     * @param period the period
     * @return the price change percentage
     */
    private double calculatePriceChange(List<KlineData> klines, int period) {
        if (klines.size() < period) {
            return 0;
        }
        double current = klines.get(klines.size() - 1).close().doubleValue();
        double past = klines.get(klines.size() - period).close().doubleValue();
        return past > 0 ? ((current - past) / past) * SCORE_SCALE : 0;
    }

    /**
     * Calculate volume trend.
     *
     * @param klines the list of klines
     * @return the volume trend
     */
    private double calculateVolumeTrend(List<KlineData> klines) {
        if (klines.size() < MIN_DAYS_VOLUME_TREND) {
            return 0;
        }
        double recent = klines.subList(klines.size() - VOLUME_TREND_RECENT_PERIOD, klines.size())
                .stream()
                .mapToLong(KlineData::volume)
                .average()
                .orElse(0);
        double past = klines.subList(0, klines.size() - VOLUME_TREND_RECENT_PERIOD).stream()
                .mapToLong(KlineData::volume)
                .average()
                .orElse(0);
        return past > 0 ? (recent - past) / past : 0;
    }

    /**
     * Create a sentiment dimension.
     *
     * @param value the value
     * @return the sentiment dimension
     */
    MarketSentimentDto.SentimentDimension createDimension(int value) {
        return MarketSentimentDto.SentimentDimension.builder()
                .value(value)
                .trend(value > TREND_UP_THRESHOLD
                    ? "up"
                    : value < TREND_DOWN_THRESHOLD
                        ? "down"
                        : "neutral")
                .build();
    }

    /**
     * Create fallback sentiment when calculation fails.
     *
     * @param marketType the market type
     * @return the fallback sentiment
     */
    MarketSentimentDto createFallbackSentiment(MarketType marketType) {
        return MarketSentimentDto.builder()
                .timestamp(Instant.now().toString())
                .overall(DEFAULT_NEUTRAL_SCORE)
                .status("neutral")
                .market(marketType.getCode())
                .dimensions(MarketSentimentDto.SentimentDimensions.builder()
                        .activity(createDimension(DEFAULT_NEUTRAL_SCORE))
                        .volatility(createDimension(DEFAULT_LOW_SCORE))
                        .trendStrength(createDimension(DEFAULT_NEUTRAL_SCORE))
                        .fearGreed(createDimension(DEFAULT_NEUTRAL_SCORE))
                        .valuation(createDimension(DEFAULT_NEUTRAL_SCORE))
                        .fundFlow(createDimension(DEFAULT_NEUTRAL_SCORE))
                        .build())
                .build();
    }
}
