package com.koduck.infrastructure.config.properties;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link DataServiceProperties} binding and validation.
 *
 * <p>Exercises property binding rules as well as Bean Validation constraints
 * declared in the class. Each test runs in a fresh minimal Spring context
 * using {@link ApplicationContextRunner}.</p>
 *
 * @author Koduck Team
 */
class DataServicePropertiesTest {

    /** Connect timeout in milliseconds for testing. */
    private static final int CONNECT_TIMEOUT_MS = 1500;

    /** Read timeout in milliseconds for testing. */
    private static final int READ_TIMEOUT_MS = 45000;

    /** Max retries for testing. */
    private static final int MAX_RETRIES = 5;

    /** Context runner for testing. */
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    ConfigurationPropertiesAutoConfiguration.class,
                    ValidationAutoConfiguration.class
            ))
            .withUserConfiguration(TestConfiguration.class);

    /**
     * When all configuration values are valid, the properties object should
     * be bound correctly and values accessible via getters.
     */
    @Test
    @DisplayName("shouldBindPropertiesWhenValidValuesProvided")
    void shouldBindPropertiesWhenValidValuesProvided() {
        contextRunner
                .withPropertyValues(
                        "koduck.data-service.base-url=https://data-service.example.com/api/v1",
                        "koduck.data-service.connect-timeout-ms=" + CONNECT_TIMEOUT_MS,
                        "koduck.data-service.read-timeout-ms=" + READ_TIMEOUT_MS,
                        "koduck.data-service.max-retries=" + MAX_RETRIES,
                        "koduck.data-service.enabled=false"
                )
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    DataServiceProperties properties = context.getBean(DataServiceProperties.class);
                    assertThat(properties.getBaseUrl())
                        .isEqualTo("https://data-service.example.com/api/v1");
                    assertThat(properties.getConnectTimeoutMs()).isEqualTo(CONNECT_TIMEOUT_MS);
                    assertThat(properties.getReadTimeoutMs()).isEqualTo(READ_TIMEOUT_MS);
                    assertThat(properties.getMaxRetries()).isEqualTo(MAX_RETRIES);
                    assertThat(properties.isEnabled()).isFalse();
                });
    }

    /**
     * A non-positive connect timeout should trigger a binding/validation error
     * during context startup.
     */
    @Test
    @DisplayName("shouldFailValidationWhenConnectTimeoutIsNonPositive")
    void shouldFailValidationWhenConnectTimeoutIsNonPositive() {
        contextRunner
                .withPropertyValues("koduck.data-service.connect-timeout-ms=0")
                .run(context -> {
                    Throwable startupFailure = context.getStartupFailure();
                    assertThat(startupFailure).isNotNull();
                    assertThat(startupFailure.getMessage()).contains("Could not bind properties");
                });
    }

    /**
     * A negative retry count should fail validation when the context starts.
     */
    @Test
    @DisplayName("shouldFailValidationWhenMaxRetriesIsNegative")
    void shouldFailValidationWhenMaxRetriesIsNegative() {
        contextRunner
                .withPropertyValues("koduck.data-service.max-retries=-1")
                .run(context -> {
                    Throwable startupFailure = context.getStartupFailure();
                    assertThat(startupFailure).isNotNull();
                    assertThat(startupFailure.getMessage()).contains("Could not bind properties");
                });
    }

    /**
     * Realtime update path should have a default value and can be bound from
     * configuration properties.
     */
    @Test
    @DisplayName("shouldBindRealtimeUpdatePathWithDefaultValue")
    void shouldBindRealtimeUpdatePathWithDefaultValue() {
        contextRunner
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    DataServiceProperties properties = context.getBean(DataServiceProperties.class);
                    assertThat(properties.getRealtimeUpdatePath())
                        .isEqualTo("/market/realtime/update");
                });
    }

    /**
     * Realtime update path should be bound correctly when custom value is provided.
     */
    @Test
    @DisplayName("shouldBindRealtimeUpdatePathWhenCustomValueProvided")
    void shouldBindRealtimeUpdatePathWhenCustomValueProvided() {
        contextRunner
                .withPropertyValues("koduck.data-service.realtime-update-path=/custom/path")
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    DataServiceProperties properties = context.getBean(DataServiceProperties.class);
                    assertThat(properties.getRealtimeUpdatePath())
                        .isEqualTo("/custom/path");
                });
    }

    /**
     * Test configuration for properties.
     */
    @Configuration
    @EnableConfigurationProperties(DataServiceProperties.class)
    static class TestConfiguration {
    }
}
