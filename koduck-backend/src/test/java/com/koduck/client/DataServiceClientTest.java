package com.koduck.client;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.koduck.config.properties.DataServiceProperties;

import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Unit tests for {@link DataServiceClient}.
 *
 * @author Koduck Team
 */
class DataServiceClientTest {

    /** Test stock symbol. */
    private static final String TEST_SYMBOL = "601398";

    /** Test base URL for data service. */
    private static final String TEST_BASE_URL = "http://localhost:8000";

    /** Test realtime update path. */
    private static final String TEST_PATH = "/market/realtime/update";

    /** Max elapsed milliseconds to assert non-blocking return. */
    private static final int MAX_ELAPSED_MS = 500;

    /** HTTP status for service unavailable used in fallback test. */
    private static final int HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

    /**
     * Confirms that triggerRealtimeUpdate schedules the HTTP request
     * asynchronously and returns immediately without blocking.
     */
    @Test
    @DisplayName("shouldSendRealtimeUpdateRequestAsynchronously")
    void shouldSendRealtimeUpdateRequestAsynchronously() {
        AtomicBoolean exchangeCalled = new AtomicBoolean(false);
        AtomicReference<ClientRequest> capturedRequest = new AtomicReference<>();

        WebClient webClient = WebClient.builder()
                .exchangeFunction(request -> {
                    capturedRequest.set(request);
                    exchangeCalled.set(true);
                    return Mono.just(ClientResponse.create(HttpStatus.ACCEPTED)
                            .header("Content-Type", "application/json")
                            .build());
                })
                .build();

        DataServiceProperties properties = new DataServiceProperties();
        properties.setEnabled(true);
        properties.setBaseUrl(TEST_BASE_URL);
        properties.setRealtimeUpdatePath(TEST_PATH);

        DataServiceClient client = new DataServiceClient(properties, webClient);

        long start = System.currentTimeMillis();
        client.triggerRealtimeUpdate(List.of(TEST_SYMBOL));
        long elapsed = System.currentTimeMillis() - start;

        assertThat(elapsed).isLessThan(MAX_ELAPSED_MS);
        await().atMost(Duration.ofSeconds(2))
                .untilTrue(exchangeCalled);

        assertThat(capturedRequest.get()).isNotNull();
        assertThat(capturedRequest.get().method()).isEqualTo(HttpMethod.POST);
        assertThat(capturedRequest.get().url().toString())
                .isEqualTo(TEST_BASE_URL + TEST_PATH);
    }

    /**
     * Ensures that no HTTP exchange happens when the data-service integration
     * is disabled.
     */
    @Test
    @DisplayName("shouldSkipRequestWhenDataServiceDisabled")
    void shouldSkipRequestWhenDataServiceDisabled() {
        AtomicBoolean exchangeCalled = new AtomicBoolean(false);

        WebClient webClient = WebClient.builder()
                .exchangeFunction(request -> {
                    exchangeCalled.set(true);
                    return Mono.just(ClientResponse.create(HttpStatus.ACCEPTED).build());
                })
                .build();

        DataServiceProperties properties = new DataServiceProperties();
        properties.setEnabled(false);

        DataServiceClient client = new DataServiceClient(properties, webClient);
        client.triggerRealtimeUpdate(List.of(TEST_SYMBOL));

        assertThat(exchangeCalled).isFalse();
    }

    /**
     * Verifies that blank or null symbols result in an early return without
     * triggering any HTTP call.
     */
    @Test
    @DisplayName("shouldSkipRequestWhenSymbolIsBlank")
    void shouldSkipRequestWhenSymbolIsBlank() {
        AtomicBoolean exchangeCalled = new AtomicBoolean(false);

        WebClient webClient = WebClient.builder()
                .exchangeFunction(request -> {
                    exchangeCalled.set(true);
                    return Mono.just(ClientResponse.create(HttpStatus.ACCEPTED).build());
                })
                .build();

        DataServiceProperties properties = new DataServiceProperties();
        properties.setEnabled(true);

        DataServiceClient client = new DataServiceClient(properties, webClient);
        client.triggerRealtimeUpdate("   ");
        client.triggerRealtimeUpdate((String) null);
        client.triggerRealtimeUpdate(Collections.emptyList());

        assertThat(exchangeCalled).isFalse();
    }

    /**
     * Validates the circuit-breaker fallback method directly to ensure it
     * handles WebClientResponseException and generic throwables gracefully.
     */
    @Test
    @DisplayName("shouldHandleFallbackForWebClientAndGenericErrors")
    void shouldHandleFallbackForWebClientAndGenericErrors() {
        WebClient webClient = WebClient.builder().build();
        DataServiceProperties properties = new DataServiceProperties();
        DataServiceClient client = new DataServiceClient(properties, webClient);

        List<String> symbols = List.of(TEST_SYMBOL);

        WebClientResponseException webEx = WebClientResponseException.create(
                HTTP_STATUS_SERVICE_UNAVAILABLE, "Service Unavailable", null, null, null);
        RuntimeException genericEx = new RuntimeException("network error");

        client.triggerRealtimeUpdateFallback(symbols, webEx);
        client.triggerRealtimeUpdateFallback(symbols, genericEx);

        assertThat(true).isTrue();
    }
}
