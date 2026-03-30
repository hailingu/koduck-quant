package com.koduck.controller;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.MarketSentimentDto;
import com.koduck.market.MarketType;
import com.koduck.service.MarketSentimentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
/**
 * Market sentiment analysis controller.
 * Provides six-dimensional sentiment indicators for market analysis.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/market/sentiment")
@RequiredArgsConstructor
@Tag(name = "Market Sentiment", description = "Market sentiment analysis APIs")
public class SentimentController {
    private final MarketSentimentService sentimentService;
    /**
     * Get market sentiment radar data.
     *
     * @param market market type (a_share, hk, us), defaults to a_share
     * @return six-dimensional sentiment indicators
     */
    @GetMapping("/radar")
    @Operation(summary = "Get market sentiment radar", 
               description = "Returns six-dimensional sentiment indicators for market analysis")
    public ApiResponse<MarketSentimentDto> getSentimentRadar(
            @Parameter(description = "Market type: a_share, hk, us")
            @RequestParam(defaultValue = "a_share") String market) {
        log.info("Getting sentiment radar for market: {}", market);
        MarketType marketType = parseMarketType(market);
        MarketSentimentDto sentiment = sentimentService.getMarketSentiment(marketType);
        return ApiResponse.success(sentiment);
    }
    /**
     * Get sentiment data for all supported markets.
     *
     * @return list of sentiment data for all markets
     */
    @GetMapping("/all")
    @Operation(summary = "Get sentiment for all markets",
               description = "Returns sentiment data for all supported markets")
    public ApiResponse<List<MarketSentimentDto>> getAllMarketsSentiment() {
        log.info("Getting sentiment for all markets");
        List<MarketSentimentDto> sentiments = Arrays.asList(
                sentimentService.getMarketSentiment(MarketType.A_SHARE),
                sentimentService.getMarketSentiment(MarketType.HK_STOCK),
                sentimentService.getMarketSentiment(MarketType.US_STOCK)
        );
        return ApiResponse.success(sentiments);
    }
    /**
     * Parse market type string to enum.
     */
    private MarketType parseMarketType(String market) {
        return switch (market.toLowerCase(Locale.ROOT)) {
            case "hk", "hk_stock" -> MarketType.HK_STOCK;
            case "us", "us_stock" -> MarketType.US_STOCK;
            case "a_share", "a", "cn" -> MarketType.A_SHARE;
            default -> MarketType.A_SHARE;
        };
    }
}
