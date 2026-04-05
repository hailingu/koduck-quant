package com.koduck.service.market;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.infrastructure.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.util.DataConverter;
import com.koduck.service.market.support.FuturesMockDataSupport;
import com.koduck.service.market.support.MarketDataMapReader;

/**
 * Futures market data provider.
 *
 * <p>Data-service based implementation with unified retrieval and error handling inherited from
 * {@link AbstractDataServiceMarketProvider}.</p>
 *
 * @author GitHub Copilot
 */
@Component
public class FuturesProvider extends AbstractDataServiceMarketProvider {

    /**
     * Logger for this provider.
     */
    private static final Logger LOG = LoggerFactory.getLogger(FuturesProvider.class);

    /**
     * Beijing timezone for market hours calculation.
     */
    private static final ZoneId BEIJING_ZONE = DateTimePatternConstants.MARKET_ZONE_ID;

    /**
     * Base path for futures data service endpoints.
     */
    private static final String FUTURES_BASE_PATH = "/futures";

    /**
     * Provider name identifier.
     */
    private static final String PROVIDER_NAME = "akshare-futures";

    /**
     * Base prices for popular futures (mock data fallback).
     */
    private final Map<String, BigDecimal> basePrices;

    /**
     * Constructs a new FuturesProvider.
     *
     * @param properties the data service properties
     * @param webClient the WebClient for data service calls
     */
    public FuturesProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceWebClient") WebClient webClient) {
        super(properties, webClient);
        this.basePrices = FuturesMockDataSupport.defaultBasePrices();
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public MarketType getMarketType() {
        return MarketType.FUTURES;
    }

    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(BEIJING_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        if (FuturesMockDataSupport.isWeekend(dayOfWeek)) {
            return MarketStatus.CLOSED;
        }

        if (FuturesMockDataSupport.isDaySession(time)) {
            return MarketStatus.OPEN;
        }

        if (FuturesMockDataSupport.isNightSession(time)) {
            return MarketStatus.POST_MARKET;
        }

        if (FuturesMockDataSupport.isBreakSession(time)) {
            return MarketStatus.BREAK;
        }

        return MarketStatus.CLOSED;
    }

    @Override
    protected Logger logger() {
        return LOG;
    }

    @Override
    protected String getDataServiceBasePath() {
        return FUTURES_BASE_PATH;
    }

    @Override
    protected String getLogMarketName() {
        return "futures";
    }

    @Override
    protected String getSubscriptionLabel() {
        return "futures contracts";
    }

    @Override
    protected String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }

        String normalized = symbol.trim().toUpperCase(Locale.ROOT);

        // Remove exchange suffix if present.
        if (normalized.contains(".")) {
            normalized = normalized.substring(0, normalized.indexOf('.'));
        }

        return normalized;
    }

    @Override
    protected List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                    Instant startTime, Instant endTime) {
        return FuturesMockDataSupport.generateMockKlineData(
                normalizeSymbol(symbol), timeframe, limit, endTime, basePrices);
    }

    @Override
    protected Optional<TickData> generateMockTickData(String symbol) {
        return Optional.of(FuturesMockDataSupport.generateMockTickData(normalizeSymbol(symbol), basePrices));
    }

    @Override
    protected List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        return FuturesMockDataSupport.generateMockSearchResults(keyword, limit);
    }

    @Override
    protected List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol,
                                                 String timeframe) {
        List<KlineData> klines = new ArrayList<>();

        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                    .symbol(symbol)
                    .market(MarketType.FUTURES.getCode())
                    .timestamp(DataConverter.toInstantFromMillis(MarketDataMapReader.getLong(item, "timestamp")))
                    .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "open")))
                    .high(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "high")))
                    .low(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "low")))
                    .close(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "close")))
                    .volume(MarketDataMapReader.getLong(item, "volume"))
                    .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(item, "amount")))
                    .timeframe(timeframe)
                    .build());
        }

        return klines;
    }

    @Override
    protected TickData convertToTickData(Map<String, Object> data, String symbol) {
        return TickData.builder()
                .symbol(symbol)
                .market(MarketType.FUTURES.getCode())
                .timestamp(DataConverter.toInstantFromMillis(MarketDataMapReader.getLong(data, "timestamp")))
                .price(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "price")))
                .change(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "change")))
                .changePercent(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "changePercent")))
                .volume(MarketDataMapReader.getLong(data, "volume"))
                .amount(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "amount")))
                .bidPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "bidPrice")))
                .bidVolume(MarketDataMapReader.getLong(data, "bidVolume"))
                .askPrice(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "askPrice")))
                .askVolume(MarketDataMapReader.getLong(data, "askVolume"))
                .dayHigh(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "high")))
                .dayLow(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "low")))
                .open(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "open")))
                .prevClose(DataConverter.toBigDecimal(MarketDataMapReader.getString(data, "prevClose")))
                .build();
    }

    @Override
    protected SymbolInfo convertToSymbolInfo(Map<String, Object> data) {
        return new SymbolInfo(
                MarketDataMapReader.getString(data, "symbol"),
                MarketDataMapReader.getString(data, "name"),
                MarketType.FUTURES.getCode(),
                FuturesMockDataSupport.resolveExchangeOrDefault(MarketDataMapReader.getString(data, "exchange")),
                "futures"
        );
    }
}
