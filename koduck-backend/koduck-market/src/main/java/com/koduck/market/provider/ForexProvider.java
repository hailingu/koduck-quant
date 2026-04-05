package com.koduck.service.market;

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
import com.koduck.service.market.support.MarketDataMapReader;
import com.koduck.service.market.support.MarketTimeframeParser;

/**
 * Forex market data provider.
 *
 * <p>Data-service based implementation with unified retrieval and error handling
 * inherited from {@link AbstractDataServiceMarketProvider}.</p>
 *
 * @author Koduck Team
 */
@Component
public class ForexProvider extends AbstractDataServiceMarketProvider {

    /** Logger instance for this class. */
    private static final Logger LOG = LoggerFactory.getLogger(ForexProvider.class);

    /** New York timezone for market hours calculation. */
    private static final ZoneId NEW_YORK_ZONE = ZoneId.of("America/New_York");

    /** Base path for forex data service endpoints. */
    private static final String FOREX_BASE_PATH = "/forex";

    /** Provider name identifier. */
    private static final String PROVIDER_NAME = "akshare-forex";

    /** Forex market opening hour (Sunday 17:00 ET). */
    private static final int FOREX_MARKET_OPEN_HOUR = 17;

    /** Forex market closing hour (Friday 17:00 ET). */
    private static final int FOREX_MARKET_CLOSE_HOUR = 17;

    /** Standard number of decimal digits for pips (4 digits). */
    private static final int PIP_DIGITS_STANDARD = 4;

    /** Number of decimal digits for gold pips (2 digits). */
    private static final int PIP_DIGITS_GOLD = 2;

    /** Number of decimal digits for JPY and silver pips (3 digits). */
    private static final int PIP_DIGITS_JPY_SILVER = 3;

    /** Standard forex symbol length (6 characters). */
    private static final int SYMBOL_LENGTH_STANDARD = 6;

    /** Length of symbol prefix (3 characters). */
    private static final int SYMBOL_PREFIX_LENGTH = 3;

    /** Volatility for precious metals (0.8%). */
    private static final double VOLATILITY_PRECIOUS_METALS = 0.008;

    /** Volatility for forex pairs (0.15%). */
    private static final double VOLATILITY_FOREX_PAIRS = 0.0015;

    /** Volatility for tick data of precious metals (0.5%). */
    private static final double VOLATILITY_TICK_PRECIOUS_METALS = 0.005;

    /** Volatility for tick data of forex pairs (0.1%). */
    private static final double VOLATILITY_TICK_FOREX = 0.001;

    /** Multiplier for price change calculation (0.5 for centering random value). */
    private static final double PRICE_CHANGE_MULTIPLIER = 0.5;

    /** Multiplier for day high price calculation (101%). */
    private static final double DAY_HIGH_MULTIPLIER = 1.01;

    /** Multiplier for day low price calculation (99%). */
    private static final double DAY_LOW_MULTIPLIER = 0.99;

    /** Minimum volume for kline data generation. */
    private static final long VOLUME_MIN = 10_000L;

    /** Maximum exclusive volume for kline data generation. */
    private static final long VOLUME_MAX_EXCLUSIVE = 1_000_000L;

    /** Minimum volume for tick data generation. */
    private static final long TICK_VOLUME_MIN = 100_000L;

    /** Maximum exclusive volume for tick data generation. */
    private static final long TICK_VOLUME_MAX_EXCLUSIVE = 5_000_000L;

    /** Minimum volume for order book data generation. */
    private static final long ORDER_BOOK_VOLUME_MIN = 100L;

    /** Maximum exclusive volume for order book data generation. */
    private static final long ORDER_BOOK_VOLUME_MAX_EXCLUSIVE = 10_000L;

    /** Multiplier for bid/ask spread calculation. */
    private static final int BID_ASK_SPREAD_MULTIPLIER = 2;

    /** Decimal scale for division operations. */
    private static final int DIVIDE_SCALE = 4;

    /** Multiplier for percentage calculations (100%). */
    private static final double PERCENT_MULTIPLIER = 100.0;

    /** XAU (Gold) symbol prefix. */
    private static final String XAU_PREFIX = "XAU";

    /** XAG (Silver) symbol prefix. */
    private static final String XAG_PREFIX = "XAG";

    /** JPY (Japanese Yen) symbol suffix. */
    private static final String JPY_SUFFIX = "JPY";

    /** Symbol separator: forward slash (/). */
    private static final String SYMBOL_SEPARATOR_SLASH = "/";

    /** Symbol separator: dash (-). */
    private static final String SYMBOL_SEPARATOR_DASH = "-";

    /** Symbol separator: underscore (_). */
    private static final String SYMBOL_SEPARATOR_UNDERSCORE = "_";

    /** Exchange name for forex. */
    private static final String EXCHANGE_FOREX = "FOREX";

    /** Symbol type identifier for forex. */
    private static final String SYMBOL_TYPE_FOREX = "forex";

    /** Initial capacity for maps (14 forex pairs). */
    private static final int INITIAL_CAPACITY = 14;

    /** Base for pip size calculation (10). */
    private static final int PIP_SIZE_BASE = 10;

    /** Base rates for major forex pairs (fallback mock data). */
    private final Map<String, BigDecimal> baseRates = new LinkedHashMap<>(INITIAL_CAPACITY);

    /**
     * Constructs a new ForexProvider.
     *
     * @param properties the data service properties
     * @param webClient the WebClient for data service calls
     */
    public ForexProvider(DataServiceProperties properties,
        @Qualifier("dataServiceWebClient") WebClient webClient) {
        super(properties, webClient);
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
            || (dayOfWeek == DayOfWeek.SUNDAY
            && time.isBefore(LocalTime.of(FOREX_MARKET_OPEN_HOUR, 0)))
            || (dayOfWeek == DayOfWeek.FRIDAY
            && time.isAfter(LocalTime.of(FOREX_MARKET_CLOSE_HOUR, 0)));

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
        normalized = normalized.replace(SYMBOL_SEPARATOR_DASH, SYMBOL_SEPARATOR_SLASH)
            .replace(SYMBOL_SEPARATOR_UNDERSCORE, SYMBOL_SEPARATOR_SLASH);

        // If no separator and length is 6, insert / in the middle (e.g., EURUSD -> EUR/USD)
        if (!normalized.contains(SYMBOL_SEPARATOR_SLASH)
            && normalized.length() == SYMBOL_LENGTH_STANDARD
            && normalized.matches("[A-Z]{6}")) {
            normalized = normalized.substring(0, SYMBOL_PREFIX_LENGTH)
                + SYMBOL_SEPARATOR_SLASH
                + normalized.substring(SYMBOL_PREFIX_LENGTH);
        }

        // Handle XAUUSD/XAGUSD format
        if (!normalized.contains(SYMBOL_SEPARATOR_SLASH)
            && normalized.length() == SYMBOL_LENGTH_STANDARD
            && (normalized.startsWith(XAU_PREFIX) || normalized.startsWith(XAG_PREFIX))) {
            normalized = normalized.substring(0, SYMBOL_PREFIX_LENGTH)
                + SYMBOL_SEPARATOR_SLASH
                + normalized.substring(SYMBOL_PREFIX_LENGTH);
        }

        return normalized;
    }

    @Override
    protected List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
        Instant startTime, Instant endTime) {
        List<KlineData> klines = new ArrayList<>();
        String normalizedSymbol = normalizeSymbol(symbol);
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, BigDecimal.ONE);

        Instant currentTime = endTime != null ? endTime : Instant.now();
        if (endTime == null && startTime != null) {
            currentTime = startTime;
        }
        Duration interval = MarketTimeframeParser.parseWithFourHour(timeframe);

        // Precious metals are more volatile than major forex pairs
        double volatility = normalizedSymbol.startsWith(XAU_PREFIX)
            || normalizedSymbol.startsWith(XAG_PREFIX)
            ? VOLATILITY_PRECIOUS_METALS : VOLATILITY_FOREX_PAIRS;

        BigDecimal currentRate = baseRate;
        for (int i = 0; i < limit; i++) {
            double changePercent = (ThreadLocalRandom.current().nextDouble() - PRICE_CHANGE_MULTIPLIER)
                * volatility * 2;
            BigDecimal change = currentRate.multiply(BigDecimal.valueOf(changePercent));
            BigDecimal close = currentRate.add(change);

            BigDecimal high = close.multiply(BigDecimal.valueOf(1
                + ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal low = close.multiply(BigDecimal.valueOf(1
                - ThreadLocalRandom.current().nextDouble() * volatility));
            BigDecimal open = currentRate;

            long volume = ThreadLocalRandom.current().nextLong(VOLUME_MIN, VOLUME_MAX_EXCLUSIVE);

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
        BigDecimal baseRate = baseRates.getOrDefault(normalizedSymbol, BigDecimal.ONE);

        double volatility = normalizedSymbol.startsWith(XAU_PREFIX)
            || normalizedSymbol.startsWith(XAG_PREFIX)
            ? VOLATILITY_TICK_PRECIOUS_METALS : VOLATILITY_TICK_FOREX;

        double changePercent = (ThreadLocalRandom.current().nextDouble() - PRICE_CHANGE_MULTIPLIER)
            * volatility * 2;
        BigDecimal price = baseRate.multiply(BigDecimal.valueOf(1 + changePercent));
        BigDecimal change = price.subtract(baseRate);
        BigDecimal changePercentValue = change.divide(baseRate, DIVIDE_SCALE, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(PERCENT_MULTIPLIER));

        long volume = ThreadLocalRandom.current().nextLong(TICK_VOLUME_MIN,
            TICK_VOLUME_MAX_EXCLUSIVE);

        int pipDigits = PIP_DIGITS_STANDARD;
        if (normalizedSymbol.startsWith(XAU_PREFIX)) {
            pipDigits = PIP_DIGITS_GOLD;
        }
        else if (normalizedSymbol.contains(JPY_SUFFIX)
            || normalizedSymbol.startsWith(XAG_PREFIX)) {
            pipDigits = PIP_DIGITS_JPY_SILVER;
        }
        BigDecimal pipSize = BigDecimal.valueOf(Math.pow(PIP_SIZE_BASE, -pipDigits));

        TickData tickData = TickData.builder()
            .symbol(normalizedSymbol)
            .market(MarketType.FOREX.getCode())
            .timestamp(Instant.now())
            .price(price)
            .change(change)
            .changePercent(changePercentValue)
            .volume(volume)
            .amount(price.multiply(BigDecimal.valueOf(volume)))
            .bidPrice(price.subtract(pipSize.multiply(
                BigDecimal.valueOf(BID_ASK_SPREAD_MULTIPLIER))))
            .bidVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN,
                ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .askPrice(price.add(pipSize.multiply(
                BigDecimal.valueOf(BID_ASK_SPREAD_MULTIPLIER))))
            .askVolume(ThreadLocalRandom.current().nextLong(ORDER_BOOK_VOLUME_MIN,
                ORDER_BOOK_VOLUME_MAX_EXCLUSIVE))
            .dayHigh(price.multiply(BigDecimal.valueOf(DAY_HIGH_MULTIPLIER)))
            .dayLow(price.multiply(BigDecimal.valueOf(DAY_LOW_MULTIPLIER)))
            .open(baseRate)
            .prevClose(baseRate)
            .build();

        return Optional.of(tickData);
    }

    @Override
    protected List<SymbolInfo> generateMockSearchResults(String keyword, int limit) {
        List<SymbolInfo> results = new ArrayList<>();
        String upperKeyword = keyword.toUpperCase(Locale.ROOT);

        Map<String, String> forexPairs = new LinkedHashMap<>(INITIAL_CAPACITY);
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
            .forEach(e -> results.add(new SymbolInfo(e.getKey(), e.getValue(),
                MarketType.FOREX.getCode(), EXCHANGE_FOREX, SYMBOL_TYPE_FOREX)));

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
                .timestamp(DataConverter.toInstantFromMillis(
                    MarketDataMapReader.getLong(item, "timestamp")))
                .open(DataConverter.toBigDecimal(
                    MarketDataMapReader.getString(item, "open")))
                .high(DataConverter.toBigDecimal(
                    MarketDataMapReader.getString(item, "high")))
                .low(DataConverter.toBigDecimal(
                    MarketDataMapReader.getString(item, "low")))
                .close(DataConverter.toBigDecimal(
                    MarketDataMapReader.getString(item, "close")))
                .volume(MarketDataMapReader.getLong(item, "volume"))
                .amount(DataConverter.toBigDecimal(
                    MarketDataMapReader.getString(item, "amount")))
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
            .timestamp(DataConverter.toInstantFromMillis(
                MarketDataMapReader.getLong(data, "timestamp")))
            .price(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "price")))
            .change(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "change")))
            .changePercent(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "changePercent")))
            .volume(MarketDataMapReader.getLong(data, "volume"))
            .amount(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "amount")))
            .bidPrice(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "bidPrice")))
            .bidVolume(MarketDataMapReader.getLong(data, "bidVolume"))
            .askPrice(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "askPrice")))
            .askVolume(MarketDataMapReader.getLong(data, "askVolume"))
            .dayHigh(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "high")))
            .dayLow(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "low")))
            .open(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "open")))
            .prevClose(DataConverter.toBigDecimal(
                MarketDataMapReader.getString(data, "prevClose")))
            .build();
    }

    @Override
    protected SymbolInfo convertToSymbolInfo(Map<String, Object> data) {
        return new SymbolInfo(
            MarketDataMapReader.getString(data, "symbol"),
            MarketDataMapReader.getString(data, "name"),
            MarketType.FOREX.getCode(),
            EXCHANGE_FOREX,
            SYMBOL_TYPE_FOREX
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
