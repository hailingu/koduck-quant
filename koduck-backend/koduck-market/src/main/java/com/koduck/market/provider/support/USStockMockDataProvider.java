package com.koduck.service.market.support;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;

/**
 * Mock fallback provider for US stock data when upstream API is not available.
 *
 * @author GitHub Copilot
 */
public class USStockMockDataProvider {

    /** Default health score for the provider. */
    private static final int DEFAULT_HEALTH_SCORE = 50;

    /** Random offset center for price change calculation. */
    private static final double RANDOM_OFFSET_CENTER = 0.5;

    /** Maximum kline price change percentage (4%). */
    private static final double KLINE_MAX_CHANGE_PERCENT = 0.04;

    /** Maximum high/low variation percentage (1%). */
    private static final double HIGH_LOW_VARIATION_PERCENT = 0.01;

    /** Minimum kline volume. */
    private static final long KLINE_VOLUME_MIN = 100_000L;

    /** Maximum exclusive kline volume. */
    private static final long KLINE_VOLUME_MAX_EXCLUSIVE = 10_000_000L;

    /** Maximum tick price change percentage (2%). */
    private static final double TICK_MAX_CHANGE_PERCENT = 0.02;

    /** Decimal places for percentage division calculation. */
    private static final int PERCENTAGE_DECIMAL_PLACES = 4;

    /** Percentage multiplier (100%). */
    private static final double PERCENTAGE_MULTIPLIER = 100.0;

    /** Minimum tick volume. */
    private static final long TICK_VOLUME_MIN = 1_000_000L;

    /** Maximum exclusive tick volume. */
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 50_000_000L;

    /** Bid price ratio (99.9% of current price). */
    private static final double BID_PRICE_RATIO = 0.999;

    /** Minimum order book volume. */
    private static final long ORDER_BOOK_VOLUME_MIN = 100L;

    /** Maximum exclusive order book volume. */
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 10_000L;

    /** Ask price ratio (100.1% of current price). */
    private static final double ASK_PRICE_RATIO = 1.001;

    /** Day high ratio (102% of current price). */
    private static final double DAY_HIGH_RATIO = 1.02;

    /** Day low ratio (98% of current price). */
    private static final double DAY_LOW_RATIO = 0.98;

    /** Base prices for US stocks. */
    private final Map<String, BigDecimal> basePrices = new HashMap<>();

    /**
     * Constructs a new USStockMockDataProvider with default base prices.
     */
    public USStockMockDataProvider() {
        basePrices.put("AAPL", new BigDecimal("175.50"));
        basePrices.put("MSFT", new BigDecimal("420.00"));
        basePrices.put("GOOGL", new BigDecimal("165.00"));
        basePrices.put("AMZN", new BigDecimal("180.00"));
        basePrices.put("TSLA", new BigDecimal("240.00"));
        basePrices.put("META", new BigDecimal("500.00"));
        basePrices.put("NVDA", new BigDecimal("880.00"));
        basePrices.put("AMD", new BigDecimal("180.00"));
        basePrices.put("INTC", new BigDecimal("45.00"));
        basePrices.put("NFLX", new BigDecimal("600.00"));
    }

    /**
     * Checks if the provider is available.
     *
     * @return true if available
     */
    public boolean isAvailable() {
        return true;
    }

    /**
     * Gets the health score of the provider.
     *
     * @return the health score
     */
    public int getHealthScore() {
        return DEFAULT_HEALTH_SCORE;
    }

    /**
     * Gets kline (candlestick) data for the specified symbol.
     *
     * @param symbol the stock symbol
     * @param timeframe the timeframe
     * @param limit the number of data points
     * @param startTime the start time
     * @param endTime the end time
     * @return a list of kline data
     */
    public List<KlineData> getKlineData(
            String symbol,
            String timeframe,
            int limit,
            Instant startTime,
            Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        BigDecimal basePrice = basePrices.getOrDefault(
                symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        if (endTime == null && startTime != null) {
            currentTime = startTime;
        }
        Duration interval = MarketTimeframeParser.parseStandard(timeframe);

        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (ThreadLocalRandom.current().nextDouble()
                    - RANDOM_OFFSET_CENTER) * KLINE_MAX_CHANGE_PERCENT;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1
                    + ThreadLocalRandom.current().nextDouble() * HIGH_LOW_VARIATION_PERCENT));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1
                    - ThreadLocalRandom.current().nextDouble() * HIGH_LOW_VARIATION_PERCENT));

            long volume = ThreadLocalRandom.current().nextLong(KLINE_VOLUME_MIN, KLINE_VOLUME_MAX_EXCLUSIVE);

            klines.add(KlineData.builder()
                .symbol(symbol.toUpperCase(Locale.ROOT))
                .market(MarketType.US_STOCK.getCode())
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
     * Gets real-time tick data for the specified symbol.
     *
     * @param symbol the stock symbol
     * @return an optional containing tick data
     */
    public Optional<TickData> getRealTimeTick(String symbol) {
        BigDecimal basePrice = basePrices.getOrDefault(
                symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));

        double changePercent = (ThreadLocalRandom.current().nextDouble()
                - RANDOM_OFFSET_CENTER) * TICK_MAX_CHANGE_PERCENT;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, PERCENTAGE_DECIMAL_PLACES, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER));

        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN, TICK_VOLUME_MAX_EXCLUSIVE);

        TickData tickData = TickData.builder()
            .symbol(symbol.toUpperCase(Locale.ROOT))
            .market(MarketType.US_STOCK.getCode())
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

    /**
     * Searches for symbols matching the given keyword.
     *
     * @param keyword the search keyword
     * @param limit the maximum number of results
     * @return a list of symbol information
     */
    public List<MarketDataProvider.SymbolInfo> searchSymbols(String keyword, int limit) {
        List<MarketDataProvider.SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);

        Map<String, String> usStocks = Map.of(
            "AAPL", "Apple Inc.",
            "MSFT", "Microsoft Corporation",
            "GOOGL", "Alphabet Inc.",
            "AMZN", "Amazon.com Inc.",
            "TSLA", "Tesla Inc.",
            "META", "Meta Platforms Inc.",
            "NVDA", "NVIDIA Corporation",
            "AMD", "Advanced Micro Devices",
            "INTC", "Intel Corporation",
            "NFLX", "Netflix Inc."
        );

        usStocks.entrySet().stream()
            .filter(entry -> entry.getKey().contains(upperKeyword)
                || entry.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
            .limit(limit)
            .forEach(entry -> results.add(new MarketDataProvider.SymbolInfo(
                entry.getKey(),
                entry.getValue(),
                MarketType.US_STOCK.getCode(),
                "NASDAQ",
                "stock"
            )));

        return results;
    }
}
