package com.koduck.service.market.support;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.koduck.dto.market.PriceQuoteDto;
import com.koduck.dto.market.StockIndustryDto;
import com.koduck.dto.market.StockValuationDto;
import com.koduck.dto.market.SymbolInfoDto;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.DataConverter;

/**
 * Mapping helpers for AKShare payload conversion.
 *
 * @author Koduck Team
 */
public final class AKShareDataMapperSupport {

    /** The key for symbol field. */
    private static final String KEY_SYMBOL = "symbol";

    /** The key for name field. */
    private static final String KEY_NAME = "name";

    /** The key for volume field. */
    private static final String KEY_VOLUME = "volume";

    /** The key for amount field. */
    private static final String KEY_AMOUNT = "amount";

    private AKShareDataMapperSupport() {
    }

    public static List<KlineData> parseKlineResponse(List<Map<String, Object>> responseData) {
        if (responseData == null) {
            return Collections.emptyList();
        }
        return responseData.stream().map(AKShareDataMapperSupport::mapToKlineData).toList();
    }

    public static List<MarketDataProvider.SymbolInfo> parseSymbolInfoResponse(List<Map<String, Object>> responseData) {
        if (responseData == null) {
            return Collections.emptyList();
        }
        return responseData.stream().map(AKShareDataMapperSupport::mapToSymbolInfo).toList();
    }

    public static List<SymbolInfoDto> parseSymbolListResponse(List<Map<String, Object>> responseData) {
        if (responseData == null) {
            return Collections.emptyList();
        }
        return responseData.stream().map(AKShareDataMapperSupport::mapToSymbolInfoDto).toList();
    }

    public static PriceQuoteDto parsePriceQuoteResponse(Map<String, Object> responseData) {
        if (responseData == null) {
            return null;
        }
        return mapToPriceQuoteDto(responseData);
    }

    public static StockValuationDto parseStockValuationResponse(Map<String, Object> responseData) {
        if (responseData == null) {
            return null;
        }
        return mapToStockValuationDto(responseData);
    }

    public static StockIndustryDto parseStockIndustryResponse(Map<String, Object> responseData) {
        if (responseData == null) {
            return null;
        }
        return mapToStockIndustryDto(responseData);
    }

    public static PriceQuoteDto mapToPriceQuoteDto(Map<String, Object> data) {
        return PriceQuoteDto.builder()
            .symbol(MarketDataMapReader.getString(data, KEY_SYMBOL))
            .name(MarketDataMapReader.getString(data, KEY_NAME))
            .type(Optional.ofNullable(MarketDataMapReader.getString(data, "type")).orElse("STOCK"))
            .price(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "price")))
            .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "open")))
            .high(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "high")))
            .low(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "low")))
            .prevClose(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "prev_close")))
            .volume(MarketDataMapReader.getLong(data, KEY_VOLUME))
            .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, KEY_AMOUNT)))
            .change(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "change")))
            .changePercent(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "change_percent")))
            .bidPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "bid_price")))
            .bidVolume(MarketDataMapReader.getLong(data, "bid_volume"))
            .askPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "ask_price")))
            .askVolume(MarketDataMapReader.getLong(data, "ask_volume"))
            .timestamp(getInstant(data, "timestamp"))
            .build();
    }

    private static KlineData mapToKlineData(Map<String, Object> data) {
        return KlineData.builder()
            .symbol(MarketDataMapReader.getString(data, KEY_SYMBOL))
            .market(MarketType.A_SHARE.getCode())
            .timestamp(DataConverter.toInstantFromMillis(MarketDataMapReader.getLong(data, "timestamp")))
            .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "open")))
            .high(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "high")))
            .low(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "low")))
            .close(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "close")))
            .volume(MarketDataMapReader.getLong(data, KEY_VOLUME))
            .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, KEY_AMOUNT)))
            .timeframe(MarketDataMapReader.getString(data, "timeframe"))
            .build();
    }

    private static MarketDataProvider.SymbolInfo mapToSymbolInfo(Map<String, Object> data) {
        String normalizedSymbol = DataConverter.normalizeSymbol(
            MarketDataMapReader.getString(data, KEY_SYMBOL),
            MarketType.A_SHARE.getCode());
        return new MarketDataProvider.SymbolInfo(
            normalizedSymbol,
            MarketDataMapReader.getString(data, KEY_NAME),
            MarketType.A_SHARE.getCode(),
            resolveExchange(normalizedSymbol),
            "stock"
        );
    }

    private static SymbolInfoDto mapToSymbolInfoDto(Map<String, Object> data) {
        return SymbolInfoDto.builder()
            .symbol(MarketDataMapReader.getString(data, KEY_SYMBOL))
            .name(MarketDataMapReader.getString(data, KEY_NAME))
            .type(Optional.ofNullable(MarketDataMapReader.getString(data, "type")).orElse("STOCK"))
            .market(MarketDataMapReader.getString(data, "market"))
            .price(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "price")))
            .changePercent(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "change_percent")))
            .volume(MarketDataMapReader.getLong(data, KEY_VOLUME))
            .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, KEY_AMOUNT)))
            .build();
    }

    private static StockValuationDto mapToStockValuationDto(Map<String, Object> data) {
        return StockValuationDto.builder()
            .symbol(MarketDataMapReader.getString(data, KEY_SYMBOL))
            .name(MarketDataMapReader.getString(data, KEY_NAME))
            .peTtm(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "pe_ttm")))
            .pb(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "pb")))
            .psTtm(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "ps_ttm")))
            .marketCap(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "market_cap")))
            .floatMarketCap(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "float_market_cap")))
            .totalShares(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "total_shares")))
            .floatShares(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "float_shares")))
            .floatRatio(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "float_ratio")))
            .turnoverRate(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "turnover_rate")))
            .build();
    }

    private static StockIndustryDto mapToStockIndustryDto(Map<String, Object> data) {
        return StockIndustryDto.builder()
            .symbol(MarketDataMapReader.getString(data, KEY_SYMBOL))
            .name(MarketDataMapReader.getString(data, KEY_NAME))
            .industry(MarketDataMapReader.getString(data, "industry"))
            .sector(MarketDataMapReader.getString(data, "sector"))
            .subIndustry(MarketDataMapReader.getString(data, "sub_industry"))
            .board(MarketDataMapReader.getString(data, "board"))
            .build();
    }

    private static Instant getInstant(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null) {
            return null;
        }
        if (value instanceof String timestamp) {
            try {
                return Instant.parse(timestamp);
            }
            catch (Exception _) {
                return null;
            }
        }
        return null;
    }

    private static String resolveExchange(String normalizedSymbol) {
        if (normalizedSymbol.contains(".SH")) {
            return "SH";
        }
        if (normalizedSymbol.contains(".SZ")) {
            return "SZ";
        }
        return "CN";
    }
}
