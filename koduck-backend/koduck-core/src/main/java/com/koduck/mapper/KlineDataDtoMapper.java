package com.koduck.mapper;

import java.util.Map;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.koduck.market.dto.KlineDataDto;
import com.koduck.market.util.MarketFieldParser;

/**
 * Mapper for converting map payloads to KlineDataDto.
 *
 * @author GitHub Copilot
 */
@Mapper(componentModel = "spring", imports = {MarketFieldParser.class})
public interface KlineDataDtoMapper {

    /**
     * Converts a map payload returned by data-service into KlineDataDto.
     *
     * @param data raw payload map
     * @return mapped KlineDataDto
     */
    @Mapping(target = "timestamp", expression = "java(MarketFieldParser.toLong(data, \"timestamp\"))")
    @Mapping(target = "open", expression = "java(MarketFieldParser.toBigDecimal(data, \"open\"))")
    @Mapping(target = "high", expression = "java(MarketFieldParser.toBigDecimal(data, \"high\"))")
    @Mapping(target = "low", expression = "java(MarketFieldParser.toBigDecimal(data, \"low\"))")
    @Mapping(target = "close", expression = "java(MarketFieldParser.toBigDecimal(data, \"close\"))")
    @Mapping(target = "volume", expression = "java(MarketFieldParser.toLong(data, \"volume\"))")
    @Mapping(target = "amount", expression = "java(MarketFieldParser.toBigDecimal(data, \"amount\"))")
    KlineDataDto fromMap(Map<String, Object> data);
}
