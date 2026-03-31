package com.koduck.service.market.support;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
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

/**
 * Mock-data helpers for futures provider fallback and local search.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class FuturesMockDataSupport {

    private static final String DEFAULT_EXCHANGE = "SHFE";
    private static final long KLINE_VOLUME_MIN = 1_000L;
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 100_000L;
    private static final long TICK_VOLUME_MIN = 10_000L;
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 500_000L;
    private static final long ORDER_BOOK_VOLUME_MIN = 10L;
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 1_000L;

    private FuturesMockDataSupport() {
    }

    public static Map<String, BigDecimal> defaultBasePrices() {
        Map<String, BigDecimal> basePrices = new LinkedHashMap<>();
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

    public static List<KlineData> generateMockKlineData(
            String normalizedSymbol,
            String timeframe,
            int limit,
            Instant endTime,
            Map<String, BigDecimal> basePrices) {
        List<KlineData> klines = new ArrayList<>();
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("5000.00"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        Duration interval = MarketTimeframeParser.parseWithTwoAndFourHour(timeframe);

        double volatility = normalizedSymbol.startsWith("AU") || normalizedSymbol.equals("GC") ? 0.008 : 0.015;

        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (Math.random() - 0.5) * volatility * 2;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + Math.random() * volatility));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - Math.random() * volatility));

            long volume = ThreadLocalRandom.current().nextLong(KLINE_VOLUME_MIN, KLINE_VOLUME_MAX_EXCLUSIVE);

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

    public static TickData generateMockTickData(String normalizedSymbol, Map<String, BigDecimal> basePrices) {
        BigDecimal basePrice = basePrices.getOrDefault(normalizedSymbol, new BigDecimal("5000.00"));

        double changePercent = (Math.random() - 0.5) * 0.02;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));

        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN, TICK_VOLUME_MAX_EXCLUSIVE);
        BigDecimal tickSize = normalizedSymbol.startsWith("AU") || normalizedSymbol.equals("GC")
            ? new BigDecimal("0.02")
            : BigDecimal.ONE;

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
            .bidVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .askPrice(price.add(tickSize))
            .askVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN, ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .dayHigh(price.multiply(BigDecimal.valueOf(1.02)))
            .dayLow(price.multiply(BigDecimal.valueOf(0.98)))
            .open(basePrice)
            .prevClose(basePrice)
            .build();
    }

    public static List<MarketDataProvider.SymbolInfo> generateMockSearchResults(String keyword, int limit) {
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
                entry.getKey(),
                entry.getValue(),
                MarketType.FUTURES.getCode(),
                resolveExchange(entry.getKey(), shfeFutures, dceFutures),
                "futures"
            )));

        return results;
    }

    public static String resolveExchangeOrDefault(String exchange) {
        if (exchange == null || exchange.isBlank()) {
            return DEFAULT_EXCHANGE;
        }
        return exchange;
    }

    public static boolean isWeekend(DayOfWeek dayOfWeek) {
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    public static boolean isDaySession(LocalTime time) {
        return (time.isAfter(LocalTime.of(9, 0)) && time.isBefore(LocalTime.of(10, 15)))
            || (time.isAfter(LocalTime.of(10, 30)) && time.isBefore(LocalTime.of(11, 30)))
            || (time.isAfter(LocalTime.of(13, 30)) && time.isBefore(LocalTime.of(15, 0)));
    }

    public static boolean isNightSession(LocalTime time) {
        return time.isAfter(LocalTime.of(21, 0)) || time.isBefore(LocalTime.of(2, 30));
    }

    public static boolean isBreakSession(LocalTime time) {
        return (time.equals(LocalTime.of(10, 15))
                || (time.isAfter(LocalTime.of(10, 15)) && time.isBefore(LocalTime.of(10, 30))))
            || (time.equals(LocalTime.of(11, 30))
                || (time.isAfter(LocalTime.of(11, 30)) && time.isBefore(LocalTime.of(13, 30))))
            || (time.equals(LocalTime.of(15, 0))
                || (time.isAfter(LocalTime.of(15, 0)) && time.isBefore(LocalTime.of(21, 0))));
    }

    private static String resolveExchange(
            String symbol,
            Map<String, String> shfeFutures,
            Map<String, String> dceFutures) {
        if (shfeFutures.containsKey(symbol)) {
            return DEFAULT_EXCHANGE;
        }
        if (dceFutures.containsKey(symbol)) {
            return "DCE";
        }
        return "CFFEX";
    }
}
