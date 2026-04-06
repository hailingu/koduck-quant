package com.koduck.strategy.mapper;

import org.mapstruct.Mapper;

import com.koduck.strategy.dto.BacktestTradeDto;
import com.koduck.strategy.entity.backtest.BacktestTrade;

/**
 * Mapper for backtest trade responses.
 *
 * @author Koduck Team
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
