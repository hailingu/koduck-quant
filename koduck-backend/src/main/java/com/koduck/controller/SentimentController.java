package com.koduck.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.ApiResponse;
import com.koduck.dto.market.MarketSentimentDto;
import com.koduck.market.MarketType;
import com.koduck.service.MarketSentimentService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Market sentiment analysis controller.
 * <p>Provides six-dimensional sentiment indicators for market analysis.</p>
 *
 * @author GitHub Copilot
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/market/sentiment")
@RequiredArgsConstructor
@Tag(name = "市场情绪", description = "市场情绪分析接口，提供六维情绪指标")
public class SentimentController {

    /**
     * Market sentiment service.
     */
    private final MarketSentimentService sentimentService;

    /**
     * Get market sentiment radar data.
     *
     * @param market market type (a_share, hk, us), defaults to a_share
     * @return six-dimensional sentiment indicators
     */
    @Operation(
        summary = "获取市场情绪雷达",
        description = "获取指定市场的六维情绪指标分析数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = MarketSentimentDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "市场类型无效"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/radar")
    public ApiResponse<MarketSentimentDto> getSentimentRadar(
            @Parameter(description = "市场类型", example = "a_share",
                schema = @Schema(allowableValues = {"a_share", "hk", "us"}))
            @RequestParam(defaultValue = MarketConstants.DEFAULT_MARKET_CODE) String market) {
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
    @Operation(
        summary = "获取所有市场情绪",
        description = "获取所有支持市场的情绪分析数据"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = MarketSentimentDto.class))
            ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/all")
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
     *
     * @param market market type string
     * @return MarketType enum
     */
    private MarketType parseMarketType(String market) {
        return switch (market.toLowerCase(Locale.ROOT)) {
            case "hk", "hk_stock" -> MarketType.HK_STOCK;
            case "us", "us_stock" -> MarketType.US_STOCK;
            case MarketConstants.DEFAULT_MARKET_CODE, "a", "cn" -> MarketType.A_SHARE;
            default -> MarketType.A_SHARE;
        };
    }
}
