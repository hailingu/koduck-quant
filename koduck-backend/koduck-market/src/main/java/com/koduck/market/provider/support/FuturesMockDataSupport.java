package com.koduck.service.market.support;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;

/**
 * Mock data helper class for futures provider fallback and local search.
 *
 * @author Koduck Team
 */
public final class FuturesMockDataSupport {

    /** Default exchange code. */
    private static final String DEFAULT_EXCHANGE = "SHFE";
    /** Dalian Commodity Exchange code. */
    private static final String EXCHANGE_DCE = "DCE";
    /** China Financial Futures Exchange code. */
    private static final String EXCHANGE_CFFEX = "CFFEX";
    /** Minimum volume for kline data. */
    private static final long KLINE_VOLUME_MIN = 1_000L;
    /** Maximum exclusive volume for kline data. */
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 100_000L;
    /** Minimum volume for tick data. */
    private static final long TICK_VOLUME_MIN = 10_000L;
    /** Maximum exclusive volume for tick data. */
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 500_000L;
    /** Minimum volume for order book. */
    private static final long ORDER_BOOK_VOLUME_MIN = 10L;
    /** Maximum exclusive volume for order book. */
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 1_000L;
    /** Volatility for gold futures. */
    private static final double VOLATILITY_GOLD = 0.008;
    /** Default volatility for futures. */
    private static final double VOLATILITY_DEFAULT = 0.015;
    /** Price change multiplier for random generation. */
    private static final double PRICE_CHANGE_MULTIPLIER = 0.5;
    /** Change percent range for tick data. */
    private static final double CHANGE_PERCENT_RANGE = 0.02;
    /** High/low price range multiplier. */
    private static final double HIGH_LOW_RANGE = 0.02;
    /** Decimal scale for division operations. */
    private static final int DIVIDE_SCALE = 4;
    /** Multiplier to convert to percentage. */
    private static final double PERCENT_MULTIPLIER = 100.0;
    /** Gold futures symbol prefix. */
    private static final String PREFIX_AU = "AU";
    /** Gold commodity symbol. */
    private static final String SYMBOL_GC = "GC";
    /** Tick size for gold futures. */
    private static final BigDecimal TICK_SIZE_GOLD = new BigDecimal("0.02");
    /** Default tick size. */
    private static final BigDecimal TICK_SIZE_DEFAULT = BigDecimal.ONE;
    /** First session start hour. */
    private static final int SESSION_START_HOUR_1 = 9;
    /** First session start minute. */
    private static final int SESSION_START_MINUTE_1 = 0;
    /** First session end hour. */
    private static final int SESSION_END_HOUR_1 = 10;
    /** First session end minute. */
    private static final int SESSION_END_MINUTE_1 = 15;
    /** Second session start hour. */
    private static final int SESSION_START_HOUR_2 = 10;
    /** Second session start minute. */
    private static final int SESSION_START_MINUTE_2 = 30;
    /** Second session end hour. */
    private static final int SESSION_END_HOUR_2 = 11;
    /** Second session end minute. */
    private static final int SESSION_END_MINUTE_2 = 30;
    /** Third session start hour. */
    private static final int SESSION_START_HOUR_3 = 13;
    /** Third session start minute. */
    private static final int SESSION_START_MINUTE_3 = 30;
    /** Third session end hour. */
    private static final int SESSION_END_HOUR_3 = 15;
    /** Third session end minute. */
    private static final int SESSION_END_MINUTE_3 = 0;
    /** Night session start hour. */
    private static final int NIGHT_SESSION_START_HOUR = 21;
    /** Night session end hour. */
    private static final int NIGHT_SESSION_END_HOUR = 2;
    /** Night session end minute. */
    private static final int NIGHT_SESSION_END_MINUTE = 30;
    /** First break start hour. */
    private static final int BREAK_START_HOUR_1 = 10;
    /** First break start minute. */
    private static final int BREAK_START_MINUTE_1 = 15;
    /** First break end hour. */
    private static final int BREAK_END_HOUR_1 = 10;
    /** First break end minute. */
    private static final int BREAK_END_MINUTE_1 = 30;
    /** Second break start hour. */
    private static final int BREAK_START_HOUR_2 = 11;
    /** Second break start minute. */
    private static final int BREAK_START_MINUTE_2 = 30;
    /** Second break end hour. */
    private static final int BREAK_END_HOUR_2 = 13;
    /** Second break end minute. */
    private static final int BREAK_END_MINUTE_2 = 30;
    /** Third break start hour. */
    private static final int BREAK_START_HOUR_3 = 15;
    /** Third break start minute. */
    private static final int BREAK_START_MINUTE_3 = 0;
    /** Third break end hour. */
    private static final int BREAK_END_HOUR_3 = 21;
    /** Third break end minute. */
    private static final int BREAK_END_MINUTE_3 = 0;
    /** Initial capacity for price maps. */
    private static final int INITIAL_CAPACITY = 25;

    private FuturesMockDataSupport() {
    }

    /**
     * Gets default base prices.
     *
     * @return mapping from symbol to price
     */
    public static Map<String, BigDecimal> defaultBasePrices() {
        Map<String, BigDecimal> basePrices = new LinkedHashMap<>(INITIAL_CAPACITY);
        basePrices.put("AU2412", new BigDecimal("480.00"));
        basePrices.put("AG2412", new BigDecimal("5800.00"));
        basePrices.put("CU2412", new BigDecimal("68000.00"));
        basePrices.put("AL2412", new BigDecimal("19200.00"));
        basePrices.put("ZN2412", new BigDecimal("23500.00"));
        basePrices.put("NI2412", new BigDecimal("128000.00"));
        basePrices.put("RB2412", new BigDecimal("3500.00"));
        basePrices.put("HC2412", new BigDecimal("3650.00"));
        basePrices.put("I2501", new BigDecimal("780.00"));
        basePrices.put("A2501", new BigDecimal("4200.00"));
        basePrices.put("M2501", new BigDecimal("3200.00"));
        basePrices.put("Y2501", new BigDecimal("7500.00"));
        basePrices.put("P2501", new BigDecimal("7200.00"));
        basePrices.put("IF2412", new BigDecimal("3800.00"));
        basePrices.put("IH2412", new BigDecimal("2550.00"));
        basePrices.put("IC2412", new BigDecimal("5600.00"));
        basePrices.put("IM2412", new BigDecimal("6200.00"));
        basePrices.put("T2412", new BigDecimal("104.50"));
        basePrices.put("TF2412", new BigDecimal("103.20"));
        basePrices.put("GC", new BigDecimal("2150.00"));
        basePrices.put("SI", new BigDecimal("24.50"));
        basePrices.put("CL", new BigDecimal("78.50"));
        basePrices.put("ES", new BigDecimal("5800.00"));
        basePrices.put("NQ", new BigDecimal("20500.00"));
        return basePrices;
    }

    /**
     * Generates mock K-line data.
     *
     * @param normalizedSymbol normalized symbol
     * @param timeframe time period
     * @param limit count limit
     * @param endTime end time
     * @param basePrices base prices
     * @return K-line data list
     */
    public static List<KlineData> generateMockKlineData(String normalizedSymbol,
        String timeframe, int limit, Instant endTime,
        Map<String, BigDecimal> basePrices) {
        List<KlineData> klines = new ArrayList<>();
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol,
            new BigDecimal("5000.00"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = MarketTimeframeParser.parseWithTwoAndFourHour(timeframe);

        double volatility = normalizedSymbol.startsWith(PREFIX_AU)
            || normalizedSymbol.equals(SYMBOL_GC)
            ? VOLATILITY_GOLD : VOLATILITY_DEFAULT;

        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (Math.random() - PRICE_CHANGE_MULTIPLIER) * volatility * 2;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + Math.random() * volatility));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - Math.random() * volatility));

            long volume = ThreadLocalRandom.current().nextLong(KLINE_VOLUME_MIN,
                KLINE_VOLUME_MAX_EXCLUSIVE);

            klines.add(KlineData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.FUTURES.getCode())
                .timestamp(currentTime)
                .open(currentPrice)
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

    /**
     * Generates mock Tick data.
     *
     * @param normalizedSymbol normalized symbol
     * @param basePrices base prices
     * @return Tick data
     */
    public static TickData generateMockTickData(String normalizedSymbol,
        Map<String, BigDecimal> basePrices) {
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol,
            new BigDecimal("5000.00"));

        double changePercent = (Math.random() - PRICE_CHANGE_MULTIPLIER) * CHANGE_PERCENT_RANGE;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, DIVIDE_SCALE, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(PERCENT_MULTIPLIER));

        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN,
            TICK_VOLUME_MAX_EXCLUSIVE);
        BigDecimal tickSize = normalizedSymbol.startsWith(PREFIX_AU)
            || normalizedSymbol.equals(SYMBOL_GC)
            ? TICK_SIZE_GOLD : TICK_SIZE_DEFAULT;

        return TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.FUTURES.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.subtract(tickSize))
            .bidVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN,
                ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .askPrice(price.add(tickSize))
            .askVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN,
                ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .dayHigh(price.multiply(BigDecimal.valueOf(1 + HIGH_LOW_RANGE)))
            .dayLow(price.multiply(BigDecimal.valueOf(1 - HIGH_LOW_RANGE)))
            .open(basePrice)
            .prevClose(basePrice)
            .build();
    }

    /**
     * Generates mock search results.
     *
     * @param keyword keyword
     * @param limit limit count
     * @return search results list
     */
    public static List<MarketDataProvider.SymbolInfo> generateMockSearchResults(
        String keyword, int limit) {
        List<MarketDataProvider.SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);

        Map<String, String> shfeFutures = new LinkedHashMap<>();
        shfeFutures.put("AU2412", "上海黄金期货 (Gold)");
        shfeFutures.put("AG2412", "上海白银期货 (Silver)");
        shfeFutures.put("CU2412", "上海铜期货 (Copper)");
        shfeFutures.put("AL2412", "上海铝期货 (Aluminum)");
        shfeFutures.put("ZN2412", "上海锌期货 (Zinc)");
        shfeFutures.put("NI2412", "上海镍期货 (Nickel)");
        shfeFutures.put("RB2412", "螺纹钢期货 (Rebar)");
        shfeFutures.put("HC2412", "热轧卷板期货 (HRC)");

        Map<String, String> dceFutures = new LinkedHashMap<>();
        dceFutures.put("I2501", "铁矿石期货 (Iron Ore)");
        dceFutures.put("A2501", "豆一期货 (Soybean No.1)");
        dceFutures.put("M2501", "豆粕期货 (Soybean Meal)");
        dceFutures.put("Y2501", "豆油期货 (Soybean Oil)");
        dceFutures.put("P2501", "棕榈油期货 (Palm Oil)");

        Map<String, String> cffexFutures = new LinkedHashMap<>();
        cffexFutures.put("IF2412", "沪深300指数期货 (CSI300)");
        cffexFutures.put("IH2412", "上证50指数期货 (SSE50)");
        cffexFutures.put("IC2412", "中证500指数期货 (CSI500)");
        cffexFutures.put("IM2412", "中证1000指数期货 (CSI1000)");
        cffexFutures.put("T2412", "10年期国债期货 (10Y Treasury)");
        cffexFutures.put("TF2412", "5年期国债期货 (5Y Treasury)");

        Map<String, String> allFutures = new LinkedHashMap<>();
        allFutures.putAll(shfeFutures);
        allFutures.putAll(dceFutures);
        allFutures.putAll(cffexFutures);

        allFutures.entrySet().stream()
            .filter(entry -> entry.getKey().contains(upperKeyword)
                || entry.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
            .limit(limit)
            .forEach(entry -> results.add(new MarketDataProvider.SymbolInfo(
                entry.getKey(), entry.getValue(), MarketType.FUTURES.getCode(),
                resolveExchange(entry.getKey(), shfeFutures, dceFutures), "futures")));

        return results;
    }

    /**
     * Resolves exchange or returns default.
     *
     * @param exchange exchange
     * @return resolved exchange
     */
    public static String resolveExchangeOrDefault(String exchange) {
        if (exchange == null || exchange.isBlank()) {
            return DEFAULT_EXCHANGE;
        }
        return exchange;
    }

    /**
     * Checks if weekend.
     *
     * @param dayOfWeek day of week
     * @return true if weekend
     */
    public static boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    /**
     * Checks if day session time.
     *
     * @param time time
     * @return true if day session
     */
    public static boolean isDaySession(LocalTime time) {
        LocalTime session1Start = LocalTime.of(SESSION_START_HOUR_1, SESSION_START_MINUTE_1);
        LocalTime session1End = LocalTime.of(SESSION_END_HOUR_1, SESSION_END_MINUTE_1);
        LocalTime session2Start = LocalTime.of(SESSION_START_HOUR_2, SESSION_START_MINUTE_2);
        LocalTime session2End = LocalTime.of(SESSION_END_HOUR_2, SESSION_END_MINUTE_2);
        LocalTime session3Start = LocalTime.of(SESSION_START_HOUR_3, SESSION_START_MINUTE_3);
        LocalTime session3End = LocalTime.of(SESSION_END_HOUR_3, SESSION_END_MINUTE_3);

        return (time.isAfter(session1Start) && time.isBefore(session1End))
            || (time.isAfter(session2Start) && time.isBefore(session2End))
            || (time.isAfter(session3Start) && time.isBefore(session3End));
    }

    /**
     * Checks if night session time.
     *
     * @param time time
     * @return true if night session
     */
    public static boolean isNightSession(LocalTime time) {
        LocalTime nightStart = LocalTime.of(NIGHT_SESSION_START_HOUR, 0);
        LocalTime nightEnd = LocalTime.of(NIGHT_SESSION_END_HOUR, NIGHT_SESSION_END_MINUTE);
        return time.isAfter(nightStart) || time.isBefore(nightEnd);
    }

    /**
     * Checks if break session time.
     *
     * @param time time
     * @return true if break session
     */
    public static boolean isBreakSession(LocalTime time) {
        LocalTime break1Start = LocalTime.of(BREAK_START_HOUR_1, BREAK_START_MINUTE_1);
        LocalTime break1End = LocalTime.of(BREAK_END_HOUR_1, BREAK_END_MINUTE_1);
        LocalTime break2Start = LocalTime.of(BREAK_START_HOUR_2, BREAK_START_MINUTE_2);
        LocalTime break2End = LocalTime.of(BREAK_END_HOUR_2, BREAK_END_MINUTE_2);
        LocalTime break3Start = LocalTime.of(BREAK_START_HOUR_3, BREAK_START_MINUTE_3);
        LocalTime break3End = LocalTime.of(BREAK_END_HOUR_3, BREAK_END_MINUTE_3);

        return (time.equals(break1Start)
            || (time.isAfter(break1Start) && time.isBefore(break1End)))
            || (time.equals(break2Start)
            || (time.isAfter(break2Start) && time.isBefore(break2End)))
            || (time.equals(break3Start)
            || (time.isAfter(break3Start) && time.isBefore(break3End)));
    }

    private static String resolveExchange(String symbol, Map<String, String> shfeFutures,
        Map<String, String> dceFutures) {
        if (shfeFutures.containsKey(symbol)) {
            return DEFAULT_EXCHANGE;
        }
        if (dceFutures.containsKey(symbol)) {
            return EXCHANGE_DCE;
        }
        return EXCHANGE_CFFEX;
    }
}
