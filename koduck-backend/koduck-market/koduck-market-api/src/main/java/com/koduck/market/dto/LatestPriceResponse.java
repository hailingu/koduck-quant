package com.koduck.market.dto;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Response for latest price endpoint.
 *
 * @param symbol the stock symbol
 * @param price  the latest price
 * @author Koduck Team
 */
@Schema(description = "最新价格响应")
public record LatestPriceResponse(
    @Schema(description = "股票代码", example = "600519")
    String symbol,
    @Schema(description = "最新价格", example = "1688.88")
    BigDecimal price
) {}
