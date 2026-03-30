package com.koduck.service.impl;
import com.koduck.dto.market.MarketSentimentDto;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.provider.ProviderFactory;
import com.koduck.service.MarketSentimentService;
import com.koduck.service.MarketService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
/**
 * Market sentiment analysis service implementation.
 * Calculates six-dimensional sentiment indicators for market analysis.
 */
@Slf4j
@Service
public class MarketSentimentServiceImpl implements MarketSentimentService {
    @org.springframework.beans.factory.annotation.Autowired
    private ProviderFactory providerFactory;
    @org.springframework.beans.factory.annotation.Autowired
    private MarketService marketService;
    // Representative index symbols for each market
    private static final String A_SHARE_INDEX = "000001"; // Shanghai Composite
    private static final String HK_INDEX = "00700"; // Tencent as proxy for HK
    private static final String US_INDEX = "AAPL"; // Apple as proxy for US
    @Override
    public MarketSentimentDto getMarketSentiment(MarketType marketType) {
        String symbol = getRepresentativeSymbol(marketType);
        log.debug("Calculating market sentiment for {} using symbol {}", marketType, symbol);
        try {
            // 关键优化：只拉取一次 60 日 K 线，所有维度复用，避免重复远程请求
            List<KlineData> klines60 = getRecentKlines(symbol, marketType, 60);
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
        } catch (Exception e) {
            log.error("Failed to calculate market sentiment for {}", marketType, e);
            // Return fallback data
            return createFallbackSentiment(marketType);
        }
    }
    /**
     * Calculate activity score (0-100) based on volume and turnover.
     */
    int calculateActivityScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 20);
            if (klines.isEmpty()) {
                return 50;
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
            int score = (int) Math.min(100, Math.max(0, ratio * 50));
            // Boost score if volume is significantly higher
            if (ratio > 2.0) {
                score = Math.min(100, score + 20);
            }
            return score;
        } catch (Exception e) {
            log.warn("Failed to calculate activity score", e);
            return 50;
        }
    }
    /**
     * Calculate volatility score (0-100) based on ATR-like measurement.
     */
    int calculateVolatilityScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 14);
            if (klines.size() < 2) {
                return 30;
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
            double volatilityPct = avgPrice > 0 ? (avgRange / avgPrice) * 100 : 0;
            // Score: 0-100 based on volatility (higher volatility = higher score)
            // Typical daily volatility: 0.5% - 5%
            int score = (int) Math.min(100, Math.max(0, volatilityPct * 20));
            return score;
        } catch (Exception e) {
            log.warn("Failed to calculate volatility score", e);
            return 30;
        }
    }
    /**
     * Calculate trend strength score (0-100) based on moving averages.
     */
    int calculateTrendStrengthScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 60);
            if (klines.size() < 20) {
                return 50;
            }
            // Calculate short and long-term MAs
            double ma5 = calculateMA(klines, 5);
            double ma10 = calculateMA(klines, 10);
            double ma20 = calculateMA(klines, 20);
            // Trend alignment score
            int score = 50; // neutral
            if (ma5 > ma10 && ma10 > ma20) {
                // Strong uptrend
                score = 70 + (int) ((ma5 - ma20) / ma20 * 100 * 3);
            } else if (ma5 < ma10 && ma10 < ma20) {
                // Strong downtrend
                score = 30 - (int) ((ma20 - ma5) / ma20 * 100 * 3);
            }
            return Math.max(0, Math.min(100, score));
        } catch (Exception e) {
            log.warn("Failed to calculate trend strength score", e);
            return 50;
        }
    }
    /**
     * Calculate fear/greed score (0-100).
     * 0 = extreme fear, 100 = extreme greed.
     */
    int calculateFearGreedScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 30);
            if (klines.size() < 10) {
                return 50;
            }
            // Calculate price momentum
            double priceChange = calculatePriceChange(klines, 10);
            double priceChange20 = calculatePriceChange(klines, 20);
            // Volume trend
            double volumeTrend = calculateVolumeTrend(klines);
            // Combine factors
            // Price up + volume up = greed
            // Price down + volume up = fear
            double greedScore = 50 + priceChange * 2 + priceChange20 + volumeTrend * 10;
            return Math.max(0, Math.min(100, (int) greedScore));
        } catch (Exception e) {
            log.warn("Failed to calculate fear/greed score", e);
            return 50;
        }
    }
    /**
     * Calculate valuation score (0-100).
     * Based on price relative to recent range.
     */
    int calculateValuationScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 60);
            if (klines.size() < 20) {
                return 50;
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
                return 50;
            }
            // Score based on position in range
            // 0 = at 60-day low (cheap), 100 = at 60-day high (expensive)
            double position = (current - low60) / (high60 - low60);
            int score = (int) (position * 100);
            return Math.max(0, Math.min(100, score));
        } catch (Exception e) {
            log.warn("Failed to calculate valuation score", e);
            return 50;
        }
    }
    /**
     * Calculate fund flow score (0-100).
     * Based on price-volume relationship.
     */
    int calculateFundFlowScore(List<KlineData> klines60) {
        try {
            List<KlineData> klines = tailKlines(klines60, 20);
            if (klines.size() < 5) {
                return 50;
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
                double typicalPrice = (high + low + close) / 3;
                // Money flow
                double flow = typicalPrice * volume;
                if (close > open) {
                    positiveFlow += flow;
                } else {
                    negativeFlow += flow;
                }
            }
            double totalFlow = positiveFlow + negativeFlow;
            if (totalFlow == 0) {
                return 50;
            }
            // Score: 0-100 based on positive flow ratio
            int score = (int) ((positiveFlow / totalFlow) * 100);
            // Boost for strong inflow
            if (positiveFlow > negativeFlow * 2) {
                score = Math.min(100, score + 10);
            }
            return score;
        } catch (Exception e) {
            log.warn("Failed to calculate fund flow score", e);
            return 50;
        }
    }
    /**
     * Calculate overall weighted score.
     */
    double calculateOverallScore(int activity, int volatility, int trendStrength,
                                 int fearGreed, int valuation, int fundFlow) {
        // Weights as per requirements
        // activity: 0.15, volatility: 0.10, trendStrength: 0.25
        // fearGreed: 0.15, valuation: 0.15, fundFlow: 0.20
        return activity * 0.15 +
               volatility * 0.10 +
               trendStrength * 0.25 +
               fearGreed * 0.15 +
               valuation * 0.15 +
               fundFlow * 0.20;
    }
    /**
     * Determine market status based on overall score and key dimensions.
     */
    String determineMarketStatus(double overall, int trendStrength, int fearGreed) {
        if (overall >= 75) {
            return trendStrength > 80 ? "strong_bullish" : "bullish";
        } else if (overall >= 60) {
            return fearGreed > 70 ? "greedy" : "cautious_bullish";
        } else if (overall >= 40) {
            return "neutral";
        } else if (overall >= 25) {
            return fearGreed < 30 ? "fearful" : "cautious_bearish";
        } else {
            return trendStrength < 20 ? "strong_bearish" : "bearish";
        }
    }
    String getRepresentativeSymbol(MarketType marketType) {
        return switch (marketType) {
            case A_SHARE -> A_SHARE_INDEX;
            case HK_STOCK -> HK_INDEX;
            case US_STOCK -> US_INDEX;
            default -> A_SHARE_INDEX;
        };
    }
    List<KlineData> getRecentKlines(String symbol, MarketType marketType, int limit) {
        try {
            return providerFactory.getAvailableProvider(marketType)
                    .map(provider -> {
                        try {
                            return provider.getKlineData(symbol, "1D", limit, 
                                    Instant.now().minus(2L * limit, ChronoUnit.DAYS), Instant.now());
                        } catch (MarketDataProvider.MarketDataException e) {
                            log.warn("Failed to get kline data for {} from provider: {}", symbol, e.getMessage());
                            return List.<KlineData>of();
                        }
                    })
                    .orElse(List.of());
        } catch (Exception e) {
            log.warn("Failed to get recent klines for {}: {}", symbol, e.getMessage());
            return List.of();
        }
    }
    private List<KlineData> tailKlines(List<KlineData> klines, int limit) {
        if (klines == null || klines.isEmpty()) {
            return List.of();
        }
        if (klines.size() <= limit) {
            return klines;
        }
        return klines.subList(klines.size() - limit, klines.size());
    }
    private double calculateMA(List<KlineData> klines, int period) {
        if (klines.size() < period) {
            return 0;
        }
        return klines.subList(klines.size() - period, klines.size()).stream()
                .mapToDouble(k -> k.close().doubleValue())
                .average()
                .orElse(0);
    }
    private double calculatePriceChange(List<KlineData> klines, int period) {
        if (klines.size() < period) {
            return 0;
        }
        double current = klines.get(klines.size() - 1).close().doubleValue();
        double past = klines.get(klines.size() - period).close().doubleValue();
        return past > 0 ? ((current - past) / past) * 100 : 0;
    }
    private double calculateVolumeTrend(List<KlineData> klines) {
        if (klines.size() < 10) {
            return 0;
        }
        double recent = klines.subList(klines.size() - 5, klines.size()).stream()
                .mapToLong(KlineData::volume)
                .average()
                .orElse(0);
        double past = klines.subList(0, klines.size() - 5).stream()
                .mapToLong(KlineData::volume)
                .average()
                .orElse(0);
        return past > 0 ? (recent - past) / past : 0;
    }
    MarketSentimentDto.SentimentDimension createDimension(int value) {
        return MarketSentimentDto.SentimentDimension.builder()
                .value(value)
                .trend(value > 60 ? "up" : value < 40 ? "down" : "neutral")
                .build();
    }
    MarketSentimentDto createFallbackSentiment(MarketType marketType) {
        return MarketSentimentDto.builder()
                .timestamp(Instant.now().toString())
                .overall(50)
                .status("neutral")
                .market(marketType.getCode())
                .dimensions(MarketSentimentDto.SentimentDimensions.builder()
                        .activity(createDimension(50))
                        .volatility(createDimension(30))
                        .trendStrength(createDimension(50))
                        .fearGreed(createDimension(50))
                        .valuation(createDimension(50))
                        .fundFlow(createDimension(50))
                        .build())
                .build();
    }
}
