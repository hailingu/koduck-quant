package com.koduck.mapper;
import org.mapstruct.Mapper;

import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.entity.BacktestTrade;

/**
 * Mapper for backtest trade responses.
 */
@Mapper(componentModel = "spring")
public interface BacktestTradeMapper {

    /**
     * Maps backtest trade entity to DTO.
     *
     * @param trade backtest trade entity
     * @return backtest trade DTO
     */
    BacktestTradeDto toDto(BacktestTrade trade);
}
