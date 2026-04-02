package com.koduck.client;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.koduck.config.properties.DataServiceProperties;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.slf4j.Slf4j;

/**
 * Client for communicating with the external data-service.
 * Provides methods to trigger realtime data updates for stock symbols.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Component
@Slf4j
public class DataServiceClient {

    /**
     * Request body key for stock symbol collections.
     */
    private static final String KEY_SYMBOLS = "symbols";
    private static final String CB_DATA_SERVICE_CLIENT = "dataServiceClient";

    /**
     * Data-service feature flags and endpoint settings.
     */
    private final DataServiceProperties dataSvcProps;

    /**
     * Dedicated HTTP client for data-service requests.
     */
    @Qualifier("dataServiceRestTemplate")
    private final RestTemplate dataSvcRestTemplate;

    /**
     * Creates a client for interacting with the data-service.
     *
     * @param dataSvcProps data-service properties
     * @param dataSvcRestTemplate RestTemplate qualified for data-service access
     */
    public DataServiceClient(
            final DataServiceProperties dataSvcProps,
            @Qualifier("dataServiceRestTemplate") final RestTemplate dataSvcRestTemplate) {
        this.dataSvcProps = dataSvcProps;
        this.dataSvcRestTemplate = dataSvcRestTemplate;
    }

    /**
     * Trigger realtime data update for a single stock symbol.
     * This is an asynchronous operation - the method returns immediately
     * after scheduling the update.
     *
     * @param symbol the stock symbol to update (e.g., "601398")
     */
    public void triggerRealtimeUpdate(final String symbol) {
        if (symbol == null || symbol.isBlank()) {
            log.debug("realtime_update_skipped reason=blank_symbol");
            return;
        }
        triggerRealtimeUpdate(Collections.singletonList(symbol));
    }

    /**
     * Trigger realtime data update for multiple stock symbols.
     * This is an asynchronous operation - the method returns immediately
     * after scheduling the updates.
     *
     * @param symbols list of stock symbols to update
     */
    @CircuitBreaker(name = CB_DATA_SERVICE_CLIENT, fallbackMethod = "triggerRealtimeUpdateFallback")
    public void triggerRealtimeUpdate(final List<String> symbols) {
        final boolean shouldTrigger;
        final List<String> requestedSymbols;
        if (!dataSvcProps.isEnabled()) {
            log.debug("realtime_update_skipped reason=data_service_disabled");
            shouldTrigger = false;
            requestedSymbols = Collections.emptyList();
        } else if (symbols == null || symbols.isEmpty()) {
            log.debug("realtime_update_skipped reason=empty_symbols");
            shouldTrigger = false;
            requestedSymbols = Collections.emptyList();
        } else {
            shouldTrigger = true;
            requestedSymbols = List.copyOf(symbols);
        }

        if (shouldTrigger) {
            invokeRealtimeUpdate(requestedSymbols);
        }
    }

    /**
     * Invokes data-service realtime update endpoint with circuit breaker protection.
     *
     * @param requestedSymbols symbols to trigger refresh
     */
    void invokeRealtimeUpdate(final List<String> requestedSymbols) {
        final String url = dataSvcProps.getBaseUrl() + dataSvcProps.getRealtimeUpdatePath();
        final HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        final Map<String, Object> requestBody = Map.of(KEY_SYMBOLS, requestedSymbols);
        final HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
        dataSvcRestTemplate.postForObject(url, request, Void.class);

        if (log.isInfoEnabled()) {
            log.info("realtime_update_triggered symbolsCount={} symbols={}",
                    requestedSymbols.size(), requestedSymbols);
        }
    }

    /**
     * Circuit-breaker fallback for realtime update invocation failures.
     *
     * @param requestedSymbols symbols to trigger refresh
     * @param throwable root cause
     */
    void triggerRealtimeUpdateFallback(final List<String> requestedSymbols, final Throwable throwable) {
        if (throwable instanceof RestClientException restClientException) {
            log.warn("realtime_update_trigger_failed symbols={} error={}",
                    requestedSymbols, restClientException.getMessage());
            return;
        }
        log.warn("realtime_update_trigger_failed symbols={} errorType={} error={}",
                requestedSymbols, throwable.getClass().getSimpleName(), throwable.getMessage());
    }
}
