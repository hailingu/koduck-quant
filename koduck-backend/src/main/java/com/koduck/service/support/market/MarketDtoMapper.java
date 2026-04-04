package com.koduck.service.support.market;

import java.time.ZoneOffset;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.market.MarketIndexDto;
import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockStatsDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.entity.market.StockBasic;
import com.koduck.entity.market.StockRealtime;
import com.koduck.util.SymbolUtils;

/**
 * Mapper for converting market-related entities into DTOs.
 *
 * @author Koduck Team
 */
@Component
public class MarketDtoMapper {

    /** Stock type identifier. */
    private static final String STOCK_TYPE = MarketConstants.STOCK_TYPE;

    /** UTC offset in hours for China timezone. */
    private static final int UTC_OFFSET_HOURS = 8;

    /**
     * Maps a realtime stock entity to a {@link SymbolInfoDto}.
     *
     * @param realtime      the realtime data entity
     * @param basic         the basic stock information
     * @param defaultMarket the default market code
     * @return the mapped DTO, or {@code null} if {@code realtime} is null
     */
    public SymbolInfoDto mapRealtimeToSymbolInfoDto(StockRealtime realtime,
            StockBasic basic, String defaultMarket) {
        if (realtime == null) {
            return null;
        }

        String market = defaultMarket;
        String name = realtime.getName();

        if (basic != null) {
            if (basic.getMarket() != null && !basic.getMarket().isBlank()) {
                market = basic.getMarket();
            }
            if (basic.getName() != null && !basic.getName().isBlank()) {
                name = basic.getName();
            }
        }

        return SymbolInfoDto.builder()
                .symbol(realtime.getSymbol())
                .name(name)
                .type(realtime.getType())
                .market(market)
                .price(realtime.getPrice())
                .changePercent(realtime.getChangePercent())
                .volume(realtime.getVolume())
                .amount(realtime.getAmount())
                .build();
    }

    /**
     * Maps a basic stock entity and optional realtime data to a
     * {@link SymbolInfoDto}.
     *
     * @param basic    the basic stock information
     * @param realtime the realtime data (may be null)
     * @return the mapped DTO
     */
    public SymbolInfoDto mapToSymbolInfoDto(StockBasic basic, StockRealtime realtime) {
        String normalizedSymbol = SymbolUtils.normalize(basic.getSymbol());
        if (realtime != null) {
            return SymbolInfoDto.builder()
                    .symbol(normalizedSymbol)
                    .name(basic.getName())
                    .type(realtime.getType())
                    .market(basic.getMarket())
                    .price(realtime.getPrice())
                    .changePercent(realtime.getChangePercent())
                    .volume(realtime.getVolume())
                    .amount(realtime.getAmount())
                    .build();
        }

        return SymbolInfoDto.builder()
                .symbol(normalizedSymbol)
                .name(basic.getName())
                .type(STOCK_TYPE)
                .market(basic.getMarket())
                .build();
    }

    /**
     * Determines whether a candidate DTO should replace an existing one
     * based on the presence of richer fields.
     *
     * @param existing  the currently stored DTO
     * @param candidate the new candidate DTO
     * @return {@code true} if the candidate should replace the existing entry
     */
    public boolean shouldReplaceSymbol(SymbolInfoDto existing, SymbolInfoDto candidate) {
        if (existing.price() == null && candidate.price() != null) {
            return true;
        }
        if (existing.changePercent() == null && candidate.changePercent() != null) {
            return true;
        }
        if (existing.volume() == null && candidate.volume() != null) {
            return true;
        }
        return existing.amount() == null && candidate.amount() != null;
    }

    /**
     * Maps a realtime stock entity to a {@link PriceQuoteDto}.
     *
     * @param entity the realtime data entity
     * @return the mapped price quote DTO
     */
    public PriceQuoteDto mapToPriceQuoteDto(StockRealtime entity) {
        return PriceQuoteDto.builder()
                .symbol(entity.getSymbol())
                .name(entity.getName())
                .type(entity.getType())
                .price(entity.getPrice())
                .open(entity.getOpenPrice())
                .high(entity.getHigh())
                .low(entity.getLow())
                .prevClose(entity.getPrevClose())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .change(entity.getChangeAmount())
                .changePercent(entity.getChangePercent())
                .bidPrice(entity.getBidPrice())
                .bidVolume(entity.getBidVolume())
                .askPrice(entity.getAskPrice())
                .askVolume(entity.getAskVolume())
                .timestamp(entity.getUpdatedAt() != null
                        ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
                .build();
    }

    /**
     * Maps a realtime stock entity to a {@link MarketIndexDto}.
     *
     * @param entity the realtime data entity
     * @return the mapped market index DTO
     */
    public MarketIndexDto mapToMarketIndexDto(StockRealtime entity) {
        return MarketIndexDto.builder()
                .symbol(entity.getSymbol())
                .name(entity.getName())
                .type(entity.getType())
                .price(entity.getPrice())
                .change(entity.getChangeAmount())
                .changePercent(entity.getChangePercent())
                .open(entity.getOpenPrice())
                .high(entity.getHigh())
                .low(entity.getLow())
                .prevClose(entity.getPrevClose())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .timestamp(entity.getUpdatedAt() != null
                        ? entity.getUpdatedAt().toInstant(ZoneOffset.ofHours(
                                UTC_OFFSET_HOURS)) : null)
                .build();
    }

    /**
     * Maps a basic stock entity to a {@link MarketIndexDto} without price data.
     *
     * @param basic the basic stock information
     * @return the mapped market index DTO
     */
    public MarketIndexDto mapBasicToMarketIndexDto(StockBasic basic) {
        return MarketIndexDto.builder()
                .symbol(basic.getSymbol())
                .name(basic.getName())
                .type(basic.getType())
                .build();
    }

    /**
     * Maps a realtime stock entity to a {@link StockStatsDto}.
     *
     * @param entity the realtime data entity
     * @param market the market code
     * @return the mapped stock stats DTO
     */
    public StockStatsDto mapToStockStatsDto(StockRealtime entity, String market) {
        return StockStatsDto.builder()
                .symbol(entity.getSymbol())
                .market(market)
                .open(entity.getOpenPrice())
                .high(entity.getHigh())
                .low(entity.getLow())
                .current(entity.getPrice())
                .prevClose(entity.getPrevClose())
                .change(entity.getChangeAmount())
                .changePercent(entity.getChangePercent())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .timestamp(entity.getUpdatedAt() != null
                        ? entity.getUpdatedAt().toInstant(ZoneOffset.UTC) : null)
                .build();
    }

    /**
     * Maps a price quote DTO to a stock stats DTO.
     *
     * @param quote  the price quote DTO
     * @param market the market code
     * @return the mapped stock stats DTO
     */
    public StockStatsDto mapPriceQuoteToStats(PriceQuoteDto quote, String market) {
        return StockStatsDto.builder()
                .symbol(quote.symbol())
                .market(market)
                .open(quote.open())
                .high(quote.high())
                .low(quote.low())
                .current(quote.price())
                .prevClose(quote.prevClose())
                .change(quote.change())
                .changePercent(quote.changePercent())
                .volume(quote.volume())
                .amount(quote.amount())
                .timestamp(quote.timestamp())
                .build();
    }
}
