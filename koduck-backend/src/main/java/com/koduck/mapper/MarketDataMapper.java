package com.koduck.mapper;

import org.mapstruct.Mapper;

import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.entity.market.MarketDailyBreadth;
import com.koduck.entity.market.MarketDailyNetFlow;

/**
 * Consolidated mapper for market data DTO conversions.
 *
 * @author Koduck Team
 */
@Mapper(componentModel = "spring")
public interface MarketDataMapper {

    /**
     * Maps net flow entity to DTO.
     *
     * @param entity net flow entity
     * @return net flow DTO
     */
    DailyNetFlowDto toDto(MarketDailyNetFlow entity);

    /**
     * Maps market breadth entity to DTO.
     *
     * @param entity market breadth entity
     * @return market breadth DTO
     */
    DailyBreadthDto toDto(MarketDailyBreadth entity);
}
