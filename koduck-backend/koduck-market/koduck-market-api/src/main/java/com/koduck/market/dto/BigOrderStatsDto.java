package com.koduck.market.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record BigOrderStatsDto(
        @JsonProperty("total_count_24h")
        Integer totalCount24h,
        @JsonProperty("total_volume_24h")
        Double totalVolume24h,
        @JsonProperty("buy_sell_ratio")
        Double buySellRatio,
        @JsonProperty("top_sectors")
        List<BigOrderSectorDto> topSectors
) {
    public BigOrderStatsDto {
        topSectors = topSectors == null ? null : List.copyOf(topSectors);
    }

    public static BigOrderStatsDto empty() {
        return new BigOrderStatsDto(0, 0D, 0D, List.of());
    }
}
