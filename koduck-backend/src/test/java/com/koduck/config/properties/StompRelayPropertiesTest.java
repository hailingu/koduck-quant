package com.koduck.config.properties;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link StompRelayProperties}.
 *
 * <p>Verifies default values and getter/setter behavior.</p>
 *
 * @author Koduck Team
 */
class StompRelayPropertiesTest {

    /**
     * Tests that default values are set correctly.
     */
    @Test
    @DisplayName("shouldHaveCorrectDefaultValues")
    void shouldHaveCorrectDefaultValues() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();

        // Then
        assertThat(properties.isEnabled()).isFalse();
        assertThat(properties.getHost()).isEqualTo("localhost");
        assertThat(properties.getPort()).isEqualTo(61613);
        assertThat(properties.getUsername()).isEqualTo("guest");
        assertThat(properties.getPassword()).isEqualTo("guest");
        assertThat(properties.getVirtualHost()).isEqualTo("/");

        assertThat(properties.getSystemHeartbeatSendInterval()).isEqualTo(10000L);
        assertThat(properties.getSystemHeartbeatReceiveInterval()).isEqualTo(10000L);
    }

    /**
     * Tests that system login defaults to username when not explicitly set.
     */
    @Test
    @DisplayName("shouldDefaultSystemLoginToUsername")
    void shouldDefaultSystemLoginToUsername() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setUsername("custom-user");

        // Then
        assertThat(properties.getSystemLogin()).isEqualTo("custom-user");
    }

    /**
     * Tests that system login returns explicitly set value when provided.
     */
    @Test
    @DisplayName("shouldReturnExplicitSystemLoginWhenSet")
    void shouldReturnExplicitSystemLoginWhenSet() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setUsername("username");
        properties.setSystemLogin("system-login");

        // Then
        assertThat(properties.getSystemLogin()).isEqualTo("system-login");
    }

    /**
     * Tests that system passcode defaults to password when not explicitly set.
     */
    @Test
    @DisplayName("shouldDefaultSystemPasscodeToPassword")
    void shouldDefaultSystemPasscodeToPassword() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setPassword("custom-pass");

        // Then
        assertThat(properties.getSystemPasscode()).isEqualTo("custom-pass");
    }

    /**
     * Tests that system passcode returns explicitly set value when provided.
     */
    @Test
    @DisplayName("shouldReturnExplicitSystemPasscodeWhenSet")
    void shouldReturnExplicitSystemPasscodeWhenSet() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setPassword("password");
        properties.setSystemPasscode("system-passcode");

        // Then
        assertThat(properties.getSystemPasscode()).isEqualTo("system-passcode");
    }

    /**
     * Tests that all properties can be customized.
     */
    @Test
    @DisplayName("shouldAllowCustomizingAllProperties")
    void shouldAllowCustomizingAllProperties() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();

        // When
        properties.setEnabled(true);
        properties.setHost("rabbitmq-prod");
        properties.setPort(61614);
        properties.setUsername("admin");
        properties.setPassword("secret");
        properties.setVirtualHost("/vhost");
        properties.setSystemLogin("system");
        properties.setSystemPasscode("system-secret");

        properties.setSystemHeartbeatSendInterval(5000L);
        properties.setSystemHeartbeatReceiveInterval(5000L);

        // Then
        assertThat(properties.isEnabled()).isTrue();
        assertThat(properties.getHost()).isEqualTo("rabbitmq-prod");
        assertThat(properties.getPort()).isEqualTo(61614);
        assertThat(properties.getUsername()).isEqualTo("admin");
        assertThat(properties.getPassword()).isEqualTo("secret");
        assertThat(properties.getVirtualHost()).isEqualTo("/vhost");
        assertThat(properties.getSystemLogin()).isEqualTo("system");
        assertThat(properties.getSystemPasscode()).isEqualTo("system-secret");

        assertThat(properties.getSystemHeartbeatSendInterval()).isEqualTo(5000L);
        assertThat(properties.getSystemHeartbeatReceiveInterval()).isEqualTo(5000L);
    }

    /**
     * Tests that empty string system login falls back to username.
     */
    @Test
    @DisplayName("shouldFallbackToUsernameWhenSystemLoginIsEmpty")
    void shouldFallbackToUsernameWhenSystemLoginIsEmpty() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setUsername("default-user");
        properties.setSystemLogin("");

        // Then
        assertThat(properties.getSystemLogin()).isEqualTo("default-user");
    }

    /**
     * Tests that empty string system passcode falls back to password.
     */
    @Test
    @DisplayName("shouldFallbackToPasswordWhenSystemPasscodeIsEmpty")
    void shouldFallbackToPasswordWhenSystemPasscodeIsEmpty() {
        // Given
        StompRelayProperties properties = new StompRelayProperties();
        properties.setPassword("default-pass");
        properties.setSystemPasscode("");

        // Then
        assertThat(properties.getSystemPasscode()).isEqualTo("default-pass");
    }
}
