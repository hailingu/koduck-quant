package com.koduck.mapper;

import com.koduck.dto.market.DailyBreadthDto;
import com.koduck.entity.MarketDailyBreadth;
import org.mapstruct.Mapper;

/**
 * Mapper for market daily breadth.
 */
@Mapper(componentModel = "spring")
public interface MarketBreadthMapper {

    /**
     * Maps market breadth entity to DTO.
     *
     * @param entity market breadth entity
     * @return market breadth DTO
     */
    DailyBreadthDto toDto(MarketDailyBreadth entity);
}
