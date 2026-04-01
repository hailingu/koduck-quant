package com.koduck.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Test configuration providing WebClient bean for integration tests.
 * Required by components like {@link com.koduck.service.support.AiStreamRelaySupport}.
 */
@TestConfiguration
public class TestWebClientConfig {

    /**
     * Provides a mock WebClient for test contexts.
     * Tests using WebClient should mock its behavior as needed.
     *
     * @return web client builder that can be used to create test instances
     */
    @Bean
    @Primary
    WebClient webClient() {
        return WebClient.builder()
                .baseUrl("http://localhost:8000")
                .build();
    }
}
