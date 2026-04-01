package com.koduck.mapper;

import com.koduck.dto.market.DailyNetFlowDto;
import com.koduck.entity.MarketDailyNetFlow;
import org.mapstruct.Mapper;

/**
 * Mapper for market daily net flow.
 */
@Mapper(componentModel = "spring")
public interface MarketFlowMapper {

    /**
     * Maps net flow entity to DTO.
     *
     * @param entity net flow entity
     * @return net flow DTO
     */
    DailyNetFlowDto toDto(MarketDailyNetFlow entity);
}
