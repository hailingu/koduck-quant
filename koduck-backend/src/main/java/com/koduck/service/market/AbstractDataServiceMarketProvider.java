package com.koduck.service.market;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;
import com.koduck.market.provider.MarketDataProvider;
import com.koduck.market.util.MarketFieldParser;
import org.slf4j.Logger;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Abstract base class for market providers backed by the python data-service.
 */
public abstract class AbstractDataServiceMarketProvider implements MarketDataProvider {

    private final DataServiceProperties properties;
    private final RestTemplate restTemplate;
    private final Set<String> subscribedSymbols = ConcurrentHashMap.newKeySet();

    protected AbstractDataServiceMarketProvider(
            DataServiceProperties properties,
            RestTemplate dataServiceRestTemplate) {
        this.properties = properties;
        this.restTemplate = dataServiceRestTemplate;
    }

    @Override
    public boolean isAvailable() {
        return properties.isEnabled();
    }

    @Override
    public int getHealthScore() {
        return properties.isEnabled() ? 100 : 0;
    }

    @Override
    public List<KlineData> getKlineData(String symbol, String timeframe, int limit,
                                        Instant startTime, Instant endTime)
            throws MarketDataException {
        if (!isAvailable()) {
            logger().debug("Data service not available, using mock data for {} kline", getLogMarketName());
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }

        String normalizedSymbol = normalizeSymbol(symbol);
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + getDataServiceBasePath() + "/kline/{symbol}")
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

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    new ParameterizedTypeReference<>() {
                    }
            );

            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
            }

            return convertToKlineData(data, normalizedSymbol, timeframe);
        } catch (RestClientException exception) {
            logger().error("Failed to fetch {} kline from data service: {}",
                    getLogMarketName(), exception.getMessage());
            return generateMockKlineData(symbol, timeframe, limit, startTime, endTime);
        }
    }

    @Override
    public Optional<TickData> getRealTimeTick(String symbol) throws MarketDataException {
        if (!isAvailable()) {
            logger().debug("Data service not available, using mock data for {} tick", getLogMarketName());
            return generateMockTickData(symbol);
        }

        String normalizedSymbol = normalizeSymbol(symbol);
        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + getDataServiceBasePath() + "/price/{symbol}")
                    .buildAndExpand(normalizedSymbol)
                    .toUriString();

            logger().debug("Fetching {} price from data service: symbol={}", getLogMarketName(), normalizedSymbol);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    new ParameterizedTypeReference<>() {
                    }
            );

            Map<String, Object> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockTickData(symbol);
            }

            return Optional.of(convertToTickData(data, normalizedSymbol));
        } catch (RestClientException exception) {
            logger().error("Failed to fetch {} price from data service: {}",
                    getLogMarketName(), exception.getMessage());
            return generateMockTickData(symbol);
        }
    }

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
        logger().info("Subscribed to {} {} for real-time data", symbols.size(), getSubscriptionLabel());
    }

    @Override
    public void unsubscribeRealTime(List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return;
        }

        symbols.forEach(symbol -> subscribedSymbols.remove(normalizeSymbol(symbol)));
        logger().info("Unsubscribed from {} {}", symbols.size(), getSubscriptionLabel());
    }

    @Override
    public List<SymbolInfo> searchSymbols(String keyword, int limit) {
        if (!isAvailable()) {
            return generateMockSearchResults(keyword, limit);
        }

        try {
            String url = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + getDataServiceBasePath() + "/search")
                    .queryParam("keyword", keyword)
                    .queryParam("limit", limit)
                    .toUriString();

            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url,
                    Objects.requireNonNull(HttpMethod.GET),
                    null,
                    new ParameterizedTypeReference<>() {
                    }
            );

            List<Map<String, Object>> data = response.getBody();
            if (data == null || data.isEmpty()) {
                return generateMockSearchResults(keyword, limit);
            }

            return data.stream()
                    .map(this::convertToSymbolInfo)
                    .limit(limit)
                    .toList();
        } catch (RestClientException exception) {
            logger().error("Failed to search {} symbols: {}", getLogMarketName(), exception.getMessage());
            return generateMockSearchResults(keyword, limit);
        }
    }

    protected final String getString(Map<String, Object> data, String key) {
        return MarketFieldParser.toStringValue(data, key);
    }

    protected final Long getLong(Map<String, Object> data, String key) {
        return MarketFieldParser.toLong(data, key);
    }

    protected abstract Logger logger();

    protected abstract String getDataServiceBasePath();

    protected abstract String getLogMarketName();

    protected abstract String getSubscriptionLabel();

    protected abstract String normalizeSymbol(String symbol);

    protected abstract List<KlineData> generateMockKlineData(String symbol, String timeframe, int limit,
                                                             Instant startTime, Instant endTime);

    protected abstract Optional<TickData> generateMockTickData(String symbol);

    protected abstract List<SymbolInfo> generateMockSearchResults(String keyword, int limit);

    protected abstract List<KlineData> convertToKlineData(List<Map<String, Object>> data,
                                                          String symbol,
                                                          String timeframe);

    protected abstract TickData convertToTickData(Map<String, Object> data, String symbol);

    protected abstract SymbolInfo convertToSymbolInfo(Map<String, Object> data);
}
