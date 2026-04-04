package com.koduck.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.web.server.Compression;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for server compression property binding.
 *
 * @author Koduck Team
 */
class ServerCompressionPropertiesTest {

    /**
     * Minimum response size for compression in bytes.
     */
    private static final int MIN_RESPONSE_SIZE = 2048;

    /**
     * Context runner for testing server properties.
     */
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class);

    @Test
    @DisplayName("shouldBindCompressionPropertiesCorrectly")
    void shouldBindCompressionPropertiesCorrectly() {
        contextRunner
                .withPropertyValues(
                        "server.compression.enabled=true",
                        "server.compression.mime-types=text/html,text/xml,application/json",
                        "server.compression.min-response-size=" + MIN_RESPONSE_SIZE
                )
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    ServerProperties serverProperties = context.getBean(ServerProperties.class);
                    Compression compression = serverProperties.getCompression();

                    assertThat(compression.getEnabled()).isTrue();
                    assertThat(compression.getMimeTypes())
                            .containsExactly("text/html", "text/xml", "application/json");
                    assertThat(compression.getMinResponseSize().toBytes())
                            .isEqualTo(MIN_RESPONSE_SIZE);
                });
    }

    @Test
    @DisplayName("shouldDisableCompressionByDefault")
    void shouldDisableCompressionByDefault() {
        contextRunner
                .run(context -> {
                    assertThat(context.getStartupFailure()).isNull();

                    ServerProperties serverProperties = context.getBean(ServerProperties.class);
                    Compression compression = serverProperties.getCompression();

                    assertThat(compression.getEnabled()).isFalse();
                });
    }

    /**
     * Test configuration for server properties.
     */
    @Configuration
    @EnableConfigurationProperties(ServerProperties.class)
    static class TestConfiguration {
    }
}
