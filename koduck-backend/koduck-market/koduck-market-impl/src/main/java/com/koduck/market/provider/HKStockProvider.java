package com.koduck.market.provider;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.koduck.infrastructure.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.util.DataConverter;
import com.koduck.market.service.support.HKStockMarketCalendar;
import com.koduck.market.service.support.MarketDataMapReader;
import com.koduck.market.service.support.MarketTimeframeParser;

/**
 * Hong Kong stock market data provider.
 *
 * <p>Data-service based implementation with unified retrieval and error handling inherited from
 * {@link AbstractDataServiceMarketProvider}.</p>
 *
 * @author Koduck Team
 */
@Component
public class HKStockProvider extends AbstractDataServiceMarketProvider {

    /** Logger instance for this class. */
    private static final Logger LOG = LoggerFactory.getLogger(HKStockProvider.class);

    /** Hong Kong timezone for market hours calculation. */
    private static final ZoneId HONG_KONG_ZONE = ZoneId.of("Asia/Hong_Kong");

    /** Base path for HK stock data service endpoints. */
    private static final String HK_STOCK_BASE_PATH = "/hk";

    /** Provider name identifier. */
    private static final String PROVIDER_NAME = "akshare-hk-stock";

    /** Minimum volume for kline mock data generation. */
    private static final long KLINE_VOLUME_MIN = 100_000L;

    /** Maximum exclusive volume for kline mock data generation. */
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 10_000_000L;

    /** Minimum volume for tick mock data generation. */
    private static final long TICK_VOLUME_MIN = 1_000_000L;

    /** Maximum exclusive volume for tick mock data generation. */
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 50_000_000L;

    /** Minimum volume for order book mock data generation. */
    private static final long ORDER_BOOK_VOLUME_MIN = 100L;

    /** Maximum exclusive volume for order book mock data generation. */
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 10_000L;

    /** Length of the ".HK" suffix in stock symbols. */
    private static final int HK_SUFFIX_LENGTH = 3;

    /** Random offset center for price change calculation. */
    private static final double RANDOM_OFFSET_CENTER = 0.5;

    /** Maximum kline price change percentage (4%). */
    private static final double KLINE_MAX_CHANGE_PERCENT = 0.04;

    /** Maximum high/low variation percentage (1%). */
    private static final double HIGH_LOW_VARIATION_PERCENT = 0.01;

    /** Maximum tick price change percentage (2%). */
    private static final double TICK_MAX_CHANGE_PERCENT = 0.02;

    /** Decimal places for percentage division calculation. */
    private static final int PERCENTAGE_DECIMAL_PLACES = 4;

    /** Percentage multiplier (100%). */
    private static final double PERCENTAGE_MULTIPLIER = 100.0;

    /** Bid price ratio (99.9% of current price). */
    private static final double BID_PRICE_RATIO = 0.999;

    /** Ask price ratio (100.1% of current price). */
    private static final double ASK_PRICE_RATIO = 1.001;

    /** Day high ratio (102% of current price). */
    private static final double DAY_HIGH_RATIO = 1.02;

    /** Day low ratio (98% of current price). */
    private static final double DAY_LOW_RATIO = 0.98;

    /** Mock data for fallback. */
    private final Map<String, BigDecimal> basePrices = new LinkedHashMap<>();

    /**
     * Constructs a new HKStockProvider.
     *
     * @param properties the data service properties
     * @param webClient the WebClient for data service calls
     */
    public HKStockProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceWebClient") WebClient webClient) {
        super(properties, webClient);
        initBasePrices();
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public MarketType getMarketType() {
        return MarketType.HK_STOCK;
    }

    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(HONG_KONG_ZONE);
        LocalTime time = now.toLocalTime();
        DayOfWeek dayOfWeek = now.getDayOfWeek();

        if (HKStockMarketCalendar.isWeekend(dayOfWeek)
                || HKStockMarketCalendar.isPublicHoliday(now.toLocalDate())) {
            return MarketStatus.CLOSED;
        }

        if (HKStockMarketCalendar.isPreMarket(time)) {
            return MarketStatus.PRE_MARKET;
        }

        if (HKStockMarketCalendar.isMorningSession(time)
                || HKStockMarketCalendar.isAfternoonSession(time)) {
            return MarketStatus.OPEN;
        }

        if (HKStockMarketCalendar.isLunchBreak(time)) {
            return MarketStatus.BREAK;
        }

        if (HKStockMarketCalendar.isClosingAuction(time)) {
            return MarketStatus.POST_MARKET;
        }

        return MarketStatus.CLOSED;
    }

    @Override
    protected Logger logger() {
        return LOG;
    }

    @Override
    protected String getDataServiceBasePath() {
        return HK_STOCK_BASE_PATH;
    }

    @Override
    protected String getLogMarketName() {
        return "HK stock";
    }

    @Override
    protected String getSubscriptionLabel() {
        return "HK stocks";
    }

    @Override
    protected String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }

        String normalized = symbol.trim().toUpperCase(Locale.ROOT);

        // Remove .HK suffix if present.
        if (normalized.endsWith(".HK")) {
            normalized = normalized.substring(0, normalized.length() - HK_SUFFIX_LENGTH);
        }

        // Pad to 5 digits.
        if (normalized.matches("\\d+")) {
            normalized = String.format("%05d", Integer.parseInt(normalized));
        }

        return normalized;
    }

    @Override
    protected List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                    Instant startTime, Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("50.00"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = MarketTimeframeParser.parseStandard(timeframe);

        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (Math.random() - RANDOM_OFFSET_CENTER) * KLINE_MAX_CHANGE_PERCENT;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + Math.random() * HIGH_LOW_VARIATION_PERCENT));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - Math.random() * HIGH_LOW_VARIATION_PERCENT));
            BigDecimal open = currentPrice;

            long volume = ThreadLocalRandom.current().nextLong(KLINE_VOLUME_MIN, KLINE_VOLUME_MAX_EXCLUSIVE);

            klines.add(KlineData.builder()
                    .symbol(normalizedSymbol)
                    .market(MarketType.HK_STOCK.getCode())
                    .timestamp(currentTime)
                    .open(open)
                    .high(high)
                    .low(low)
                    .close(close)
                    .volume(volume)
                    .amount(close.multiply(BigDecimal.valueOf(volume)))
                    .timeframe(timeframe)
                    .build());

            currentPrice = close;
            currentTime = currentTime.minus(interval);
        }

        Collections.reverse(klines);
        return klines;
    }

    @Override
    protected Optional<TickData> generateMockTickData(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("50.00"));

        double changePercent = (Math.random() - RANDOM_OFFSET_CENTER) * TICK_MAX_CHANGE_PERCENT;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, PERCENTAGE_DECIMAL_PLACES, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER));

        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN, TICK_VOLUME_MAX_EXCLUSIVE);

        TickData tickData = TickData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.HK_STOCK.getCode())
                .timestamp(Instant.now())
                .price(price)
                .change(change)
                .changePercent(changePercentValue)
                .volume(volume)
                .amount(price.multiply(BigDecimal.valueOf(volume)))
                .bidPrice(price.multiply(BigDecimal.valueOf(BID_PRICE_RATIO)))
                .bidVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
                .askPrice(price.multiply(BigDecimal.valueOf(ASK_PRICE_RATIO)))
                .askVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
                .dayHigh(price.multiply(BigDecimal.valueOf(DAY_HIGH_RATIO)))
                .dayLow(price.multiply(BigDecimal.valueOf(DAY_LOW_RATIO)))
                .open(basePrice)
                .prevClose(basePrice)
                .build();

        return Optional.of(tickData);
    }

    @Override
    protected List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);

        Map<String, String> hkStocks = new LinkedHashMap<>();
        hkStocks.put("00700", "Tencent Holdings Ltd.");
        hkStocks.put("09988", "Alibaba Health Information Technology");
        hkStocks.put("01898", "Meituan");
        hkStocks.put("09618", "JD.com Inc.");
        hkStocks.put("01211", "BYD Company Limited");
        hkStocks.put("09888", "Baidu Inc.");
        hkStocks.put("01024", "Kuaishou Technology");
        hkStocks.put("02015", "Li Auto Inc.");
        hkStocks.put("09868", "XPeng Inc.");
        hkStocks.put("06690", "Haier Smart Home Co.");

        hkStocks.entrySet().stream()
                .filter(e -> e.getKey().contains(upperKeyword)
                        || e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
                .limit(limit)
                .forEach(e -> results.add(new SymbolInfo(
                        e.getKey(),
                        e.getValue(),
                        MarketType.HK_STOCK.getCode(),
                        "HKEX",
                        "stock"
                )));

        return results;
    }

    @Override
    protected List<KlineData> convertToKlineData(List<Map<String, Object>> data, String symbol,
                                                 String timeframe) {
        List<KlineData> klines = new ArrayList<>();

        for (Map<String, Object> item : data) {
            klines.add(KlineData.builder()
                    .symbol(symbol)
                    .market(MarketType.HK_STOCK.getCode())
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
                .market(MarketType.HK_STOCK.getCode())
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
        String exchange = MarketDataMapReader.getString(data, "exchange");
        return new SymbolInfo(
                MarketDataMapReader.getString(data, "symbol"),
                MarketDataMapReader.getString(data, "name"),
                MarketType.HK_STOCK.getCode(),
                exchange != null ? exchange : "HKEX",
                "stock"
        );
    }

    private void initBasePrices() {
        basePrices.put("00700", new BigDecimal("380.00"));
        basePrices.put("09988", new BigDecimal("75.00"));
        basePrices.put("01898", new BigDecimal("120.00"));
        basePrices.put("09618", new BigDecimal("95.00"));
        basePrices.put("01211", new BigDecimal("150.00"));
        basePrices.put("09888", new BigDecimal("85.00"));
        basePrices.put("01024", new BigDecimal("45.00"));
        basePrices.put("02015", new BigDecimal("55.00"));
        basePrices.put("09868", new BigDecimal("40.00"));
        basePrices.put("06690", new BigDecimal("25.00"));
    }
}
