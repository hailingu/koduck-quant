package com.koduck.config.properties;
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
 */
class DataServicePropertiesTest {

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
                        "koduck.data-service.connect-timeout-ms=1500",
                        "koduck.data-service.read-timeout-ms=45000",
                        "koduck.data-service.max-retries=5",
                        "koduck.data-service.enabled=false"
                )
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    DataServiceProperties properties = context.getBean(DataServiceProperties.class);
                    assertThat(properties.getBaseUrl()).isEqualTo("https://data-service.example.com/api/v1");
                    assertThat(properties.getConnectTimeoutMs()).isEqualTo(1500);
                    assertThat(properties.getReadTimeoutMs()).isEqualTo(45000);
                    assertThat(properties.getMaxRetries()).isEqualTo(5);
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

    @Configuration
    @EnableConfigurationProperties(DataServiceProperties.class)
    static class TestConfiguration {
    }
}
