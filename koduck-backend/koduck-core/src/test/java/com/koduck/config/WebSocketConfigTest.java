package com.koduck.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.koduck.infrastructure.config.properties.StompRelayProperties;
import com.koduck.infrastructure.config.properties.WebSocketProperties;
import com.koduck.security.websocket.WebSocketChannelInterceptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * Unit tests for {@link WebSocketConfig}.
 *
 * <p>Verifies configuration initialization and dependency injection.</p>
 *
 * @author Koduck Team
 */
class WebSocketConfigTest {

    /**
     * Default STOMP broker port for RabbitMQ STOMP plugin.
     */
    private static final int DEFAULT_STOMP_PORT = 61613;

    /**
     * Tests that WebSocketConfig can be created with valid dependencies
     * when STOMP relay is disabled (default development mode).
     */
    @Test
    @DisplayName("shouldCreateWebSocketConfigWithSimpleBrokerWhenRelayDisabled")
    void shouldCreateWebSocketConfigWithSimpleBrokerWhenRelayDisabled() {
        // Given
        WebSocketProperties webSocketProperties = new WebSocketProperties();
        StompRelayProperties stompRelayProperties = new StompRelayProperties();
        stompRelayProperties.setEnabled(false); // Default: use SimpleBroker
        WebSocketChannelInterceptor interceptor = mock(WebSocketChannelInterceptor.class);

        // When
        WebSocketConfig config = new WebSocketConfig(
            webSocketProperties,
            stompRelayProperties,
            interceptor
        );

        // Then
        assertThat(config).isNotNull();
    }

    /**
     * Tests that WebSocketConfig can be created with valid dependencies
     * when STOMP relay is enabled (production mode).
     */
    @Test
    @DisplayName("shouldCreateWebSocketConfigWithStompRelayWhenRelayEnabled")
    void shouldCreateWebSocketConfigWithStompRelayWhenRelayEnabled() {
        // Given
        WebSocketProperties webSocketProperties = new WebSocketProperties();
        StompRelayProperties stompRelayProperties = new StompRelayProperties();
        stompRelayProperties.setEnabled(true); // Production: use STOMP relay
        stompRelayProperties.setHost("rabbitmq");
        stompRelayProperties.setPort(DEFAULT_STOMP_PORT);
        WebSocketChannelInterceptor interceptor = mock(WebSocketChannelInterceptor.class);

        // When
        WebSocketConfig config = new WebSocketConfig(
            webSocketProperties,
            stompRelayProperties,
            interceptor
        );

        // Then
        assertThat(config).isNotNull();
    }

    /**
     * Tests that WebSocketConfig throws NullPointerException when
     * webSocketProperties is null.
     */
    @Test
    @DisplayName("shouldThrowExceptionWhenWebSocketPropertiesIsNull")
    void shouldThrowExceptionWhenWebSocketPropertiesIsNull() {
        // Given
        StompRelayProperties stompRelayProperties = new StompRelayProperties();
        WebSocketChannelInterceptor interceptor = mock(WebSocketChannelInterceptor.class);

        // When/Then
        assertThatThrownBy(() -> new WebSocketConfig(
            null,
            stompRelayProperties,
            interceptor
        )).isInstanceOf(NullPointerException.class)
          .hasMessageContaining("webSocketProperties must not be null");
    }

    /**
     * Tests that WebSocketConfig throws NullPointerException when
     * stompRelayProperties is null.
     */
    @Test
    @DisplayName("shouldThrowExceptionWhenStompRelayPropertiesIsNull")
    void shouldThrowExceptionWhenStompRelayPropertiesIsNull() {
        // Given
        WebSocketProperties webSocketProperties = new WebSocketProperties();
        WebSocketChannelInterceptor interceptor = mock(WebSocketChannelInterceptor.class);

        // When/Then
        assertThatThrownBy(() -> new WebSocketConfig(
            webSocketProperties,
            null,
            interceptor
        )).isInstanceOf(NullPointerException.class)
          .hasMessageContaining("stompRelayProperties must not be null");
    }

    /**
     * Tests that WebSocketConfig throws NullPointerException when
     * webSocketChannelInterceptor is null.
     */
    @Test
    @DisplayName("shouldThrowExceptionWhenInterceptorIsNull")
    void shouldThrowExceptionWhenInterceptorIsNull() {
        // Given
        WebSocketProperties webSocketProperties = new WebSocketProperties();
        StompRelayProperties stompRelayProperties = new StompRelayProperties();

        // When/Then
        assertThatThrownBy(() -> new WebSocketConfig(
            webSocketProperties,
            stompRelayProperties,
            null
        )).isInstanceOf(NullPointerException.class)
          .hasMessageContaining("webSocketChannelInterceptor must not be null");
    }
}
