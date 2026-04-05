package com.koduck.service.support.market;

import java.time.ZoneOffset;

import org.springframework.stereotype.Component;

import com.koduck.common.constants.MarketConstants;
import com.koduck.market.dto.MarketIndexDto;
import com.koduck.market.dto.PriceQuoteDto;
import com.koduck.market.dto.StockStatsDto;
import com.koduck.market.dto.SymbolInfoDto;
import com.koduck.market.entity.StockBasic;
import com.koduck.market.entity.StockRealtime;
import com.koduck.util.SymbolUtils;

/**
 * 将市场相关实体转换为DTO的映射器。
 *
 * @author Koduck Team
 */
@Component
public class MarketDtoMapper {

    /** 股票类型标识。 */
    private static final String STOCK_TYPE = MarketConstants.STOCK_TYPE;

    /** 中国时区的UTC偏移小时数。 */
    private static final int UTC_OFFSET_HOURS = 8;

    /**
     * 将实时股票实体映射为{@link SymbolInfoDto}。
     *
     * @param realtime      实时数据实体
     * @param basic         股票基本信息
     * @param defaultMarket 默认市场代码
     * @return 映射后的DTO，如果{@code realtime}为null则返回{@code null}
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
     * 将股票基本实体和可选的实时数据映射为{@link SymbolInfoDto}。
     *
     * @param basic    股票基本信息
     * @param realtime 实时数据（可能为null）
     * @return 映射后的DTO
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
     * 根据是否存在更丰富字段，决定是否用候选DTO替换现有DTO。
     *
     * @param existing  当前存储的DTO
     * @param candidate 新的候选DTO
     * @return 如果候选应替换现有条目则返回{@code true}
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
     * 将实时股票实体映射为{@link PriceQuoteDto}。
     *
     * @param entity 实时数据实体
     * @return 映射后的行情报价DTO
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
     * 将实时股票实体映射为{@link MarketIndexDto}。
     *
     * @param entity 实时数据实体
     * @return 映射后的市场指数DTO
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
     * 将股票基本实体映射为不含价格数据的{@link MarketIndexDto}。
     *
     * @param basic 股票基本信息
     * @return 映射后的市场指数DTO
     */
    public MarketIndexDto mapBasicToMarketIndexDto(StockBasic basic) {
        return MarketIndexDto.builder()
                .symbol(basic.getSymbol())
                .name(basic.getName())
                .type(basic.getType())
                .build();
    }

    /**
     * 将实时股票实体映射为{@link StockStatsDto}。
     *
     * @param entity 实时数据实体
     * @param market 市场代码
     * @return 映射后的股票统计DTO
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
     * 将行情报价DTO映射为股票统计DTO。
     *
     * @param quote  行情报价DTO
     * @param market 市场代码
     * @return 映射后的股票统计DTO
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
