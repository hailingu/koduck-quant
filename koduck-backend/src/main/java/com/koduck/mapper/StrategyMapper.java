package com.koduck.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.koduck.dto.strategy.StrategyDto;
import com.koduck.dto.strategy.StrategyParameterDto;
import com.koduck.dto.strategy.StrategyVersionDto;
import com.koduck.entity.strategy.Strategy;
import com.koduck.entity.strategy.StrategyParameter;
import com.koduck.entity.strategy.StrategyVersion;

/**
 * Mapper for strategy domain objects and DTOs.
 *
 * @author Koduck Team
 */
@Mapper(componentModel = "spring")
public interface StrategyMapper {

    /**
     * Maps strategy to DTO without parameter payload.
     *
     * @param strategy strategy entity
     * @return strategy DTO
     */
    @Mapping(target = "parameters", ignore = true)
    StrategyDto toStrategyDto(Strategy strategy);

    /**
     * Maps strategy and parameter list to DTO.
     *
     * @param strategy strategy entity
     * @param parameters strategy parameter DTO list
     * @return strategy DTO
     */
    @Mapping(target = "parameters", source = "parameters")
    StrategyDto toStrategyDto(Strategy strategy, List<StrategyParameterDto> parameters);

    /**
     * Maps strategy parameter entity to DTO.
     *
     * @param parameter strategy parameter entity
     * @return strategy parameter DTO
     */
    StrategyParameterDto toStrategyParameterDto(StrategyParameter parameter);

    /**
     * Maps strategy version entity to DTO.
     *
     * @param version strategy version entity
     * @return strategy version DTO
     */
    StrategyVersionDto toStrategyVersionDto(StrategyVersion version);
}
