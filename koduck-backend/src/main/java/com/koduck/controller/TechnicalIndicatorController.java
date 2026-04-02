package com.koduck.controller;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.service.TechnicalIndicatorService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Technical Indicator REST API controller.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@RestController
@RequestMapping("/api/v1/indicators")
@RequiredArgsConstructor
@Validated
@Slf4j
@Tag(name = "技术指标", description = "技术指标查询与计算接口")
public class TechnicalIndicatorController {
    private static final String DEFAULT_PERIOD = "20";
    private final TechnicalIndicatorService indicatorService;

    /**
     * Get available technical indicators.
     *
     * @return available indicator definitions
     */
    @Operation(
        summary = "获取可用技术指标",
        description = "获取系统支持的所有技术指标列表及其参数定义"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "获取成功",
            content = @Content(schema = @Schema(implementation = IndicatorListResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping
    public ApiResponse<IndicatorListResponse> getAvailableIndicators() {
        log.debug("GET /api/v1/indicators");
        IndicatorListResponse indicators = indicatorService.getAvailableIndicators();
        return ApiResponse.success(indicators);
    }

    /**
     * Calculate technical indicator for a symbol.
     *
     * Example: GET /api/v1/indicators/{symbol}?market=AShare&indicator=MA&period=20
     *
     * @param symbol stock symbol
     * @param market market identifier
     * @param indicator indicator type
     * @param period indicator period, defaults to 20
     * @return indicator calculation result
     */
    @Operation(
        summary = "计算技术指标",
        description = "为指定股票计算技术指标\n\n" +
                      "示例：GET /api/v1/indicators/600519?market=AShare&indicator=MA&period=20"
    )
    @io.swagger.v3.oas.annotations.responses.ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "计算成功",
            content = @Content(schema = @Schema(implementation = IndicatorResponse.class))
        ),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "请求参数错误或指标不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "股票不存在"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "服务器内部错误")
    })
    @GetMapping("/{symbol}")
    public ApiResponse<IndicatorResponse> calculateIndicator(
            @Parameter(description = "股票代码", example = "600519")
            @PathVariable @NotBlank String symbol,
            @Parameter(description = "市场代码", example = "AShare")
            @RequestParam @NotBlank String market,
            @Parameter(description = "指标类型", example = "MA",
                schema = @Schema(allowableValues = {"MA", "EMA", "MACD", "RSI", "KDJ", "BOLL", "VOL"}))
            @RequestParam @NotBlank String indicator,
            @Parameter(description = "计算周期", example = "20")
            @RequestParam(defaultValue = DEFAULT_PERIOD) @Positive Integer period) {
        log.debug(
                "GET /api/v1/indicators/{}: market={}, indicator={}, period={}",
                symbol,
                market,
                indicator,
                period);
        IndicatorResponse response = indicatorService.calculateIndicator(market, symbol, indicator, period);
        return ApiResponse.success(response);
    }
}
