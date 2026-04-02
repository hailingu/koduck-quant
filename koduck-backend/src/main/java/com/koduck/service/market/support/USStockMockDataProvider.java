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
 * @date 2026-03-31
 */
public class USStockMockDataProvider {

    private final Map<String, BigDecimal> basePrices = new HashMap<>();

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

    public boolean isAvailable() {
        return true;
    }

    public int getHealthScore() {
        return 50;
    }

    public List<KlineData> getKlineData(
            String symbol,
            String timeframe,
            int limit,
            Instant startTime,
            Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        BigDecimal basePrice = basePrices.getOrDefault(symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        if (endTime == null && startTime != null) {
            currentTime = startTime;
        }
        Duration interval = MarketTimeframeParser.parseStandard(timeframe);

        BigDecimal currentPrice = basePrice;
        for (int i = 0; i < limit; i++) {
            double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.04;
            BigDecimal change = currentPrice.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentPrice.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1 + ThreadLocalRandom.current().nextDouble() * 0.01));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1 - ThreadLocalRandom.current().nextDouble() * 0.01));

            long volume = ThreadLocalRandom.current().nextLong(100_000L, 10_000_000L);

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

    public Optional<TickData> getRealTimeTick(String symbol) {
        BigDecimal basePrice = basePrices.getOrDefault(symbol.toUpperCase(Locale.ROOT), new BigDecimal("100.00"));

        double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * 0.02;
        BigDecimal price = basePrice.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(basePrice);
        BigDecimal changePercentValue = change.divide(basePrice, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));

        long volume = ThreadLocalRandom.current().nextLong(1_000_000L, 50_000_000L);

        TickData tickData = TickData.builder()
            .symbol(symbol.toUpperCase(Locale.ROOT))
            .market(MarketType.US_STOCK.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.multiply(BigDecimal.valueOf(0.999)))
            .bidVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
            .askPrice(price.multiply(BigDecimal.valueOf(1.001)))
            .askVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
            .dayHigh(price.multiply(BigDecimal.valueOf(1.02)))
            .dayLow(price.multiply(BigDecimal.valueOf(0.98)))
            .open(basePrice)
            .prevClose(basePrice)
            .build();

        return Optional.of(tickData);
    }

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
