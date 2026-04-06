package com.koduck.config;

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
 * Unit tests for {@link JwtConfig} property binding and validation.
 *
 * @author GitHub Copilot
 */
class JwtConfigTest {

    /** Access token expiration for testing: 2 minutes in milliseconds. */
    private static final long TEST_ACCESS_TOKEN_EXPIRATION = 120_000L;

    /** Refresh token expiration for testing: 1 hour in milliseconds. */
    private static final long TEST_REFRESH_TOKEN_EXPIRATION = 3_600_000L;

    /** Default access token expiration: 1 day in milliseconds. */
    private static final long DEFAULT_ACCESS_TOKEN_EXPIRATION = 86_400_000L;

    /** Default refresh token expiration: 7 days in milliseconds. */
    private static final long DEFAULT_REFRESH_TOKEN_EXPIRATION = 604_800_000L;

    /**
     * Runner for testing application context with JWT configuration.
     */
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    ConfigurationPropertiesAutoConfiguration.class,
                    ValidationAutoConfiguration.class
            ))
            .withUserConfiguration(TestConfiguration.class);

    /**
     * Verifies all JWT properties can be bound when valid values are provided.
     */
    @Test
    @DisplayName("shouldBindJwtPropertiesWhenValidValuesProvided")
    void shouldBindJwtPropertiesWhenValidValuesProvided() {
        contextRunner
                .withPropertyValues(
                        "jwt.secret=test-secret-value",
                        "jwt.access-token-expiration=120000",
                        "jwt.refresh-token-expiration=3600000",
                    "jwt.token-prefix=Token-",
                        "jwt.header-name=X-Auth"
                )
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    JwtConfig jwtConfig = context.getBean(JwtConfig.class);
                    assertThat(jwtConfig.getSecret()).isEqualTo("test-secret-value");
                    assertThat(jwtConfig.getAccessTokenExpiration()).isEqualTo(TEST_ACCESS_TOKEN_EXPIRATION);
                    assertThat(jwtConfig.getRefreshTokenExpiration()).isEqualTo(TEST_REFRESH_TOKEN_EXPIRATION);
                    assertThat(jwtConfig.getTokenPrefix()).isEqualTo("Token-");
                    assertThat(jwtConfig.getHeaderName()).isEqualTo("X-Auth");
                });
    }

    /**
     * Verifies default values are applied when optional JWT properties are omitted.
     */
    @Test
    @DisplayName("shouldUseDefaultValuesWhenOptionalPropertiesMissing")
    void shouldUseDefaultValuesWhenOptionalPropertiesMissing() {
        contextRunner
                .withPropertyValues("jwt.secret=test-secret-value")
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    JwtConfig jwtConfig = context.getBean(JwtConfig.class);
                    assertThat(jwtConfig.getSecret()).isEqualTo("test-secret-value");
                    assertThat(jwtConfig.getAccessTokenExpiration()).isEqualTo(DEFAULT_ACCESS_TOKEN_EXPIRATION);
                    assertThat(jwtConfig.getRefreshTokenExpiration()).isEqualTo(DEFAULT_REFRESH_TOKEN_EXPIRATION);
                    assertThat(jwtConfig.getTokenPrefix()).isEqualTo("Bearer ");
                    assertThat(jwtConfig.getHeaderName()).isEqualTo("Authorization");
                });
    }

    /**
     * Verifies startup fails when JWT secret is missing.
     */
    @Test
    @DisplayName("shouldFailValidationWhenSecretMissing")
    void shouldFailValidationWhenSecretMissing() {
        contextRunner
                .run(context -> {
                    Throwable startupFailure = context.getStartupFailure();
                    assertThat(startupFailure).isNotNull();
                    assertThat(startupFailure.getMessage()).contains("Could not bind properties");
                });
    }

    /**
     * Minimal configuration used by the context runner to register the
     * {@link JwtConfig} properties bean.
     */
    @Configuration
    @EnableConfigurationProperties(JwtConfig.class)
    static class TestConfiguration {
    }
}