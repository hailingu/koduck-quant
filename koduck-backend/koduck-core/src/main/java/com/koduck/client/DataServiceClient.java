package com.koduck.client;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.koduck.config.properties.DataServiceProperties;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.slf4j.Slf4j;

/**
 * Client for communicating with the external data-service.
 * Provides methods to trigger realtime data updates for stock symbols.
 *
 * @author GitHub Copilot
 */
@Component
@Slf4j
public class DataServiceClient {

    /**
     * Request body key for stock symbol collections.
     */
    private static final String KEY_SYMBOLS = "symbols";

    /**
     * Circuit breaker name for data service client.
     */
    private static final String CB_DATA_SERVICE_CLIENT = "dataServiceClient";

    /**
     * Timeout for realtime update HTTP calls in seconds.
     */
    private static final int REALTIME_UPDATE_TIMEOUT_SECONDS = 5;

    /**
     * Data-service feature flags and endpoint settings.
     */
    private final DataServiceProperties dataSvcProps;

    /**
     * Dedicated HTTP client for data-service requests.
     */
    @Qualifier("dataServiceWebClient")
    private final WebClient dataServiceWebClient;

    /**
     * Creates a client for interacting with the data-service.
     *
     * @param dataSvcProps data-service properties
     * @param dataServiceWebClient WebClient qualified for data-service access
     */
    public DataServiceClient(
            final DataServiceProperties dataSvcProps,
            @Qualifier("dataServiceWebClient") final WebClient dataServiceWebClient) {
        this.dataSvcProps = dataSvcProps;
        this.dataServiceWebClient = dataServiceWebClient;
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
        }
        else if (symbols == null || symbols.isEmpty()) {
            log.debug("realtime_update_skipped reason=empty_symbols");
            shouldTrigger = false;
            requestedSymbols = Collections.emptyList();
        }
        else {
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
        final Map<String, Object> requestBody = Map.of(KEY_SYMBOLS, requestedSymbols);

        dataServiceWebClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .toBodilessEntity()
                .timeout(Duration.ofSeconds(REALTIME_UPDATE_TIMEOUT_SECONDS))
                .doOnSuccess(response -> {
                    if (log.isInfoEnabled()) {
                        log.info("realtime_update_triggered symbolsCount={} symbols={}",
                                requestedSymbols.size(), requestedSymbols);
                    }
                })
                .doOnError(error -> log.warn("realtime_update_trigger_failed symbols={} error={}",
                        requestedSymbols, error.getMessage()))
                .subscribe();
    }

    /**
     * Circuit-breaker fallback for realtime update invocation failures.
     *
     * @param requestedSymbols symbols to trigger refresh
     * @param throwable root cause
     */
    void triggerRealtimeUpdateFallback(final List<String> requestedSymbols, final Throwable throwable) {
        if (throwable instanceof WebClientResponseException webClientException) {
            log.warn("realtime_update_trigger_failed symbols={} error={}",
                    requestedSymbols, webClientException.getMessage());
            return;
        }
        log.warn("realtime_update_trigger_failed symbols={} errorType={} error={}",
                requestedSymbols, throwable.getClass().getSimpleName(), throwable.getMessage());
    }
}
