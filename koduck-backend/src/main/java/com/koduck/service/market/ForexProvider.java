package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.MarketType;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.util.DataConverter;
import com.koduck.service.market.support.MarketDataMapReader;
import com.koduck.service.market.support.MarketTimeframeParser;
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
import org.springframework.web.client.RestTemplate;

/**
 * Forex (Foreign Exchange) market data provider.
 *
 * <p>Data-service based implementation with unified retrieval and error handling inherited from
 * {@link AbstractDataServiceMarketProvider}.</p>
 */
@Component
public class ForexProvider extends AbstractDataServiceMarketProvider {

    private static final Logger LOG = LoggerFactory.getLogger(ForexProvider.class);
    private static final ZoneId NEW_YORK_ZONE = ZoneId.of("America/New_York");
    private static final String FOREX_BASE_PATH = "/forex";
    private static final String PROVIDER_NAME = "akshare-forex";

    // Base rates for major currency pairs (mock data fallback)
    private final Map<String, BigDecimal> baseRates = new LinkedHashMap<>();

    public ForexProvider(
            DataServiceProperties properties,
            @Qualifier("dataServiceRestTemplate") RestTemplate restTemplate) {
        super(properties, restTemplate);
        initBaseRates();
    }

    @Override
    public String getProviderName() {
        return PROVIDER_NAME;
    }

    @Override
    public MarketType getMarketType() {
        return MarketType.FOREX;
    }

    @Override
    public MarketStatus getMarketStatus() {
        ZonedDateTime now = ZonedDateTime.now(NEW_YORK_ZONE);
        DayOfWeek dayOfWeek = now.getDayOfWeek();
        LocalTime time = now.toLocalTime();

        // Forex trades 24 hours from Sunday 17:00 ET to Friday 17:00 ET
        boolean isWeekend = dayOfWeek == DayOfWeek.SATURDAY
                || (dayOfWeek == DayOfWeek.SUNDAY && time.isBefore(LocalTime.of(17, 0)))
                || (dayOfWeek == DayOfWeek.FRIDAY && time.isAfter(LocalTime.of(17, 0)));

        if (isWeekend) {
            return MarketStatus.CLOSED;
        }

        return MarketStatus.OPEN;
    }

    @Override
    protected Logger logger() {
        return LOG;
    }

    @Override
    protected String getDataServiceBasePath() {
        return FOREX_BASE_PATH;
    }

    @Override
    protected String getLogMarketName() {
        return "forex";
    }

    @Override
    protected String getSubscriptionLabel() {
        return "forex pairs";
    }

    @Override
    protected String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }

        String normalized = symbol.trim().toUpperCase(Locale.ROOT);

        // Handle different formats: EURUSD, EUR-USD, EUR_USD -> EUR/USD
        normalized = normalized.replace("-", "/").replace("_", "/");

        // If no separator and 6 chars, insert / in middle (e.g., EURUSD -> EUR/USD)
        if (!normalized.contains("/") && normalized.length() == 6
                && normalized.matches("[A-Z]{6}")) {
            normalized = normalized.substring(0, 3) + "/" + normalized.substring(3);
        }

        // Handle XAUUSD/XAGUSD format
        if (!normalized.contains("/") && normalized.length() == 6
                && (normalized.startsWith("XAU") || normalized.startsWith("XAG"))) {
            normalized = normalized.substring(0, 3) + "/" + normalized.substring(3);
        }

        return normalized;
    }

    @Override
    protected List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                    Instant startTime, Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, new BigDecimal("1.0000"));

        Instant currentTime = endTime != null ? endTime : Instant.now();
        if (endTime == null && startTime != null) {
            currentTime = startTime;
        }
        Duration interval = MarketTimeframeParser.parseWithFourHour(timeframe);

        // Precious metals are more volatile than major forex pairs
        double volatility = normalizedSymbol.startsWith("XAU") || normalizedSymbol.startsWith("XAG")
                ? 0.008 : 0.0015;

        BigDecimal currentRate = baseRate;
        for (int i = 0; i < limit; i++) {
            double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * volatility * 2;
            BigDecimal change = currentRate.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentRate.add(change);

            BigDecimal high = close.multiply(
                    BigDecimal.valueOf(1 + ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal low = close.multiply(
                    BigDecimal.valueOf(1 - ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal open = currentRate;

            long volume = ThreadLocalRandom.current().nextLong(10_000L, 1_000_000L);

            klines.add(KlineData.builder()
                    .symbol(normalizedSymbol)
                    .market(MarketType.FOREX.getCode())
                    .timestamp(currentTime)
                    .open(open)
                    .high(high)
                    .low(low)
                    .close(close)
                    .volume(volume)
                    .amount(close.multiply(BigDecimal.valueOf(volume)))
                    .timeframe(timeframe)
                    .build());

            currentRate = close;
            currentTime = currentTime.minus(interval);
        }

        Collections.reverse(klines);
        return klines;
    }

    @Override
    protected Optional<TickData> generateMockTickData(String symbol) {
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, new BigDecimal("1.0000"));

        double volatility = normalizedSymbol.startsWith("XAU") || normalizedSymbol.startsWith("XAG")
                ? 0.005 : 0.001;

        double changePercent = (ThreadLocalRandom.current().nextDouble() - 0.5) * volatility * 2;
        BigDecimal price = baseRate.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(baseRate);
        BigDecimal changePercentValue = change.divide(baseRate, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));

        long volume = ThreadLocalRandom.current().nextLong(100_000L, 5_000_000L);

        int pipDigits = 4;
        if (normalizedSymbol.startsWith("XAU")) {
            pipDigits = 2;
        } else if (normalizedSymbol.contains("JPY") || normalizedSymbol.startsWith("XAG")) {
            pipDigits = 3;
        }
        BigDecimal pipSize = BigDecimal.valueOf(Math.pow(10, -pipDigits));

        TickData tickData = TickData.builder()
                .symbol(normalizedSymbol)
                .market(MarketType.FOREX.getCode())
                .timestamp(Instant.now())
                .price(price)
                .change(change)
                .changePercent(changePercentValue)
                .volume(volume)
                .amount(price.multiply(BigDecimal.valueOf(volume)))
                .bidPrice(price.subtract(pipSize.multiply(BigDecimal.valueOf(2))))
                .bidVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
                .askPrice(price.add(pipSize.multiply(BigDecimal.valueOf(2))))
                .askVolume(ThreadLocalRandom.current().nextLong(100L, 10_000L))
                .dayHigh(price.multiply(BigDecimal.valueOf(1.01)))
                .dayLow(price.multiply(BigDecimal.valueOf(0.99)))
                .open(baseRate)
                .prevClose(baseRate)
                .build();

        return Optional.of(tickData);
    }

    @Override
    protected List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);

        Map<String, String> forexPairs = new LinkedHashMap<>();
        forexPairs.put("EUR/USD", "Euro / US Dollar");
        forexPairs.put("USD/JPY", "US Dollar / Japanese Yen");
        forexPairs.put("GBP/USD", "British Pound / US Dollar");
        forexPairs.put("USD/CHF", "US Dollar / Swiss Franc");
        forexPairs.put("AUD/USD", "Australian Dollar / US Dollar");
        forexPairs.put("USD/CAD", "US Dollar / Canadian Dollar");
        forexPairs.put("EUR/GBP", "Euro / British Pound");
        forexPairs.put("EUR/JPY", "Euro / Japanese Yen");
        forexPairs.put("GBP/JPY", "British Pound / Japanese Yen");
        forexPairs.put("USD/CNH", "US Dollar / Chinese Yuan (Offshore)");
        forexPairs.put("USD/SGD", "US Dollar / Singapore Dollar");
        forexPairs.put("USD/HKD", "US Dollar / Hong Kong Dollar");
        forexPairs.put("XAU/USD", "Gold / US Dollar");
        forexPairs.put("XAG/USD", "Silver / US Dollar");

        forexPairs.entrySet().stream()
                .filter(e -> e.getKey().contains(upperKeyword)
                        || e.getValue().toUpperCase(Locale.ROOT).contains(upperKeyword))
                .limit(limit)
                .forEach(e -> results.add(new SymbolInfo(
                        e.getKey(),
                        e.getValue(),
                        MarketType.FOREX.getCode(),
                        "FOREX",
                        "forex"
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
                    .market(MarketType.FOREX.getCode())
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
                .market(MarketType.FOREX.getCode())
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
                MarketType.FOREX.getCode(),
                "FOREX",
                "forex"
        );
    }

    private void initBaseRates() {
        baseRates.put("EUR/USD", new BigDecimal("1.0850"));
        baseRates.put("USD/JPY", new BigDecimal("149.50"));
        baseRates.put("GBP/USD", new BigDecimal("1.2650"));
        baseRates.put("USD/CHF", new BigDecimal("0.8820"));
        baseRates.put("AUD/USD", new BigDecimal("0.6550"));
        baseRates.put("USD/CAD", new BigDecimal("1.3520"));
        baseRates.put("EUR/GBP", new BigDecimal("0.8570"));
        baseRates.put("EUR/JPY", new BigDecimal("162.20"));
        baseRates.put("GBP/JPY", new BigDecimal("189.20"));
        baseRates.put("USD/CNH", new BigDecimal("7.2150"));
        baseRates.put("USD/SGD", new BigDecimal("1.3450"));
        baseRates.put("USD/HKD", new BigDecimal("7.8230"));
        baseRates.put("XAU/USD", new BigDecimal("2150.00"));
        baseRates.put("XAG/USD", new BigDecimal("24.50"));
    }
}
