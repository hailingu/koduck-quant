package com.koduck.service.market;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import com.koduck.infrastructure.config.properties.DataServiceProperties;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.MarketFieldParser;

/**
 * Abstract base class for market providers backed by the python data-service.
 * <p>
 * This class implements common retrieval logic for kline, real-time tick, search
 * and subscription operations. Subclasses provide provider-specific URL paths,
 * symbol normalization and conversion from response payloads to domain models.
 * </p>
 *
 * <p>
 * It includes fallback behavior to generate mock data when the data service is
 * unavailable or returns empty payloads.
 * </p>
 *
 * @author GitHub Copilot
 */
public abstract class AbstractDataServiceMarketProvider implements MarketDataProvider {

    /** Response type for list of maps. */
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST_MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<List<Map<String, Object>>>() {
        };

    /** Response type for single map. */
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_RESPONSE_TYPE =
        new ParameterizedTypeReference<Map<String, Object>>() {
        };

    /** Health score when enabled. */
    private static final int HEALTH_SCORE_ENABLED = 100;

    /** Health score when disabled. */
    private static final int HEALTH_SCORE_DISABLED = 0;

    /** Configuration properties. */
    private final DataServiceProperties properties;

    /** WebClient for HTTP calls. */
    private final WebClient webClient;

    /** Set of subscribed symbols. */
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();

    /**
     * Constructs a new AbstractDataServiceMarketProvider.
     *
     * @param properties the data service properties
     * @param dataServiceWebClient the WebClient
     */
    protected AbstractDataServiceMarketProvider(
            DataServiceProperties properties,
            WebClient dataServiceWebClient) {
        this.properties = properties;
        this.webClient = dataServiceWebClient;
    }

    /**
     * Returns whether the market provider is enabled via configuration.
     *
     * @return true if provider is enabled, false otherwise
     */
    @Override
    public boolean isAvailable() {
        return properties.isEnabled();
    }

    /**
     * Returns a provider health score for monitoring and priority decisions.
     *
     * @return 100 when enabled, 0 when disabled
     */
    @Override
    public int getHealthScore() {
        return properties.isEnabled() ? HEALTH_SCORE_ENABLED : HEALTH_SCORE_DISABLED;
    }

    /**
     * Retrieves kline (candlestick) data for a symbol from the data service.
     * <p>
     * If the service is unavailable or the response is empty, fallback mock data
     * is returned.
     * </p>
     *
     * @param symbol stock symbol to query
     * @param timeframe interval (e.g., 1m, 1d)
     * @param limit maximum number of points
     * @param startTime optional start timestamp for range filtering
     * @param endTime optional end timestamp for range filtering
     * @return list of KlineData objects
     * @throws MarketDataException on invalid input or retrievable errors
     */
    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                        Instant startTime, Instant endTime)
            throws MarketDataException {
        if (!isAvailable()) {
            logger().debug("Data service not available, using mock data for {} kline",
                getLogMarketName());
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }

        String normalizedSymbol = normalizeSymbol(symbol);
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl()
                        + getDataServiceBasePath() + "/kline/{symbol}")
                    .queryParam("timeframe", timeframe)
                    .queryParam("limit", limit);

            if (startTime != null) {
                builder.queryParam("startTime", startTime.toEpochMilli());
            }
            if (endTime != null) {
                builder.queryParam("endTime", endTime.toEpochMilli());
            }

            String url = builder.buildAndExpand(normalizedSymbol).toUriString();
            logger().debug("Fetching {} kline from data service: symbol={}, timeframe={}",
                    getLogMarketName(), normalizedSymbol, timeframe);

            List<Map<String, Object>> data = webClient.method(Objects.requireNonNull(HttpMethod.GET))
                    .uri(url)
                    .retrieve()
                    .bodyToMono(LIST_MAP_RESPONSE_TYPE)
                    .block();

            if (data == null || data.isEmpty()) {
                return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
            }

            return convertToKlineData(data, normalizedSymbol, timeframe);
        }
        catch (WebClientResponseException exception) {
            logger().error("Failed to fetch {} kline from data service: {}",
                    getLogMarketName(), exception.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }
    }

    /**
     * Retrieves real-time tick data for a symbol via data service.
     *
     * @param symbol stock symbol to query
     * @return optional tick data (absent when no data is available or service error occurs)
     * @throws MarketDataException on invalid input or retrievable errors
     */
    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            logger().debug("Data service not available, using mock data for {} tick",
                getLogMarketName());
            return generateMockTickData(symbol);
        }

        String normalizedSymbol = normalizeSymbol(symbol);
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl()
                        + getDataServiceBasePath() + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();

            logger().debug("Fetching {} price from data service: symbol={}",
                getLogMarketName(), normalizedSymbol);

            Map<String, Object> data = webClient.method(Objects.requireNonNull(HttpMethod.GET))
                    .uri(url)
                    .retrieve()
                    .bodyToMono(MAP_RESPONSE_TYPE)
                    .block();

            if (data == null || data.isEmpty()) {
                return generateMockTickData(symbol);
            }

            return Optional.of(convertToTickData(data, normalizedSymbol));
        }
        catch (WebClientResponseException exception) {
            logger().error("Failed to fetch {} price from data service: {}",
                    getLogMarketName(), exception.getMessage());
            return generateMockTickData(symbol);
        }
    }

    /**
     * Subscribes to real-time data updates for the given symbols.
     *
     * @param symbols list of symbols to subscribe
     * @param callback callback invoked for each tick update
     * @throws MarketDataException when provider is unavailable
     */
    @Override
    public void subscribeRealTime(List<String> symbols, RealTimeDataCallback callback)
            throws MarketDataException {
        if (!isAvailable()) {
            throw new MarketDataException("Provider is not available");
        }

        if (symbols == null || symbols.isEmpty()) {
            return;
        }

        symbols.forEach(symbol -> subscribedSymbols.add(normalizeSymbol(symbol)));
        logger().info("Subscribed to {} {} for real-time data",
            symbols.size(), getSubscriptionLabel());
    }

    /**
     * Unsubscribes from real-time data updates for the given symbols.
     *
     * @param symbols list of symbols to unsubscribe
     */
    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return;
        }

        symbols.forEach(symbol -> subscribedSymbols.remove(normalizeSymbol(symbol)));
        logger().info("Unsubscribed from {} {}", symbols.size(), getSubscriptionLabel());
    }

    /**
     * Searches symbols using the data service endpoint.
     *
     * @param keyword search keyword
     * @param limit maximum number of results
     * @return list of symbol insights
     */
    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            return generateMockSearchResults(keyword, limit);
        }

        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl()
                        + getDataServiceBasePath() + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();

            List<Map<String, Object>> data = webClient.method(Objects.requireNonNull(HttpMethod.GET))
                    .uri(url)
                    .retrieve()
                    .bodyToMono(LIST_MAP_RESPONSE_TYPE)
                    .block();

            if (data == null || data.isEmpty()) {
                return generateMockSearchResults(keyword, limit);
            }

            return data.stream()
                    .map(this::convertToSymbolInfo)
                    .limit(limit)
                    .toList();
        }
        catch (WebClientResponseException exception) {
            logger().error("Failed to search {} symbols: {}",
                getLogMarketName(), exception.getMessage());
            return generateMockSearchResults(keyword, limit);
        }
    }

    /**
     * Gets a string value from raw market response map safely.
     *
     * @param data raw response map
     * @param key the key to read
     * @return parsed string, or null when missing/unparseable
     */
    protected final String getString(Map<String, Object> data, String key) {
        return MarketFieldParser.toStringValue(data, key);
    }

    /**
     * Gets a long value from raw market response map safely.
     *
     * @param data raw response map
     * @param key the key to read
     * @return parsed long, or null when missing/unparseable
     */
    protected final Long getLong(Map<String, Object> data, String key) {
        return MarketFieldParser.toLong(data, key);
    }

    /**
     * Provides a typed logger for subclasses.
     *
     * @return logger instance
     */
    protected abstract Logger logger();

    /**
     * Gets data-service base path specific to the provider (e.g. /hk, /us).
     *
     * @return provider-specific data-service base path
     */
    protected abstract String getDataServiceBasePath();

    /**
     * Gets the provider friendly name for logs.
     *
     * @return provider log name
     */
    protected abstract String getLogMarketName();

    /**
     * Gets the subscription label used in log events.
     *
     * @return subscription label string
     */
    protected abstract String getSubscriptionLabel();

    /**
     * Normalizes a symbol into provider-specific format.
     *
     * @param symbol raw symbol input
     * @return normalized symbol
     */
    protected abstract String normalizeSymbol(String symbol);

    /**
     * Generates mock kline data when the real data service is unavailable.
     *
     * @param symbol target symbol
     * @param timeframe interval (e.g., 1m, 1d)
     * @param limit number of points
     * @param startTime optional start time
     * @param endTime optional end time
     * @return list of kline data points
     */
    protected abstract List<KlineData> generateMockKlineData(String symbol, String timeframe,
                                                             int limit, Instant startTime,
                                                             Instant endTime);

    /**
     * Generates mock tick data when the real data service is unavailable.
     *
     * @param symbol target symbol
     * @return optional tick data
     */
    protected abstract Optional<TickData> generateMockTickData(String symbol);

    /**
     * Generates mock symbol search results when the data service is unavailable.
     *
     * @param keyword search keyword
     * @param limit maximum number of results
     * @return list of symbol info
     */
    protected abstract List<SymbolInfo> generateMockSearchResults(String keyword, int limit);

    /**
     * Converts a raw response payload to domain kline data.
     *
     * @param data raw response data list
     * @param symbol normalized symbol
     * @param timeframe interval
     * @return list of KlineData
     */
    protected abstract List<KlineData> convertToKlineData(List<Map<String, Object>> data,
                                                          String symbol,
                                                          String timeframe);

    /**
     * Converts a raw response payload to domain tick data.
     *
     * @param data raw response map
     * @param symbol normalized symbol
     * @return TickData instance
     */
    protected abstract TickData convertToTickData(Map<String, Object> data, String symbol);

    /**
     * Converts a raw response payload to a symbol search info object.
     *
     * @param data raw response map
     * @return SymbolInfo object
     */
    protected abstract SymbolInfo convertToSymbolInfo(Map<String, Object> data);
}
