package com.koduck.config;

import java.util.Objects;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.config.properties.FinnhubProperties;

/**
 * RestTemplate configuration for external API calls.
 *
 * @author GitHub Copilot
 */
@Configuration
public class RestTemplateConfig {

    /**
     * Builds a dedicated {@link RestTemplate} for data-service HTTP calls.
     *
     * @param builder RestTemplate builder provided by Spring
     * @param properties data-service timeout properties
     * @return configured RestTemplate instance with buffering enabled
     */
    @Bean
    public RestTemplate dataServiceRestTemplate(
            RestTemplateBuilder builder,
            DataServiceProperties properties) {
        DataServiceProperties nonNullProperties =
                Objects.requireNonNull(properties, "properties must not be null");

        return buildBufferedRestTemplate(
                builder,
                nonNullProperties.getConnectTimeoutMs(),
                nonNullProperties.getReadTimeoutMs());
    }
    
    /**
     * Builds a dedicated {@link RestTemplate} for Finnhub API calls.
     *
     * @param builder RestTemplate builder provided by Spring
     * @param properties Finnhub timeout properties
     * @return configured RestTemplate instance
     */
    @Bean
    public RestTemplate finnhubRestTemplate(
            RestTemplateBuilder builder,
            FinnhubProperties properties) {
        FinnhubProperties nonNullProperties =
                Objects.requireNonNull(properties, "properties must not be null");

        return buildBufferedRestTemplate(
                builder,
                nonNullProperties.getConnectTimeoutMs(),
                nonNullProperties.getReadTimeoutMs());
    }

    private RestTemplate buildBufferedRestTemplate(
            RestTemplateBuilder builder,
            int connectTimeoutMs,
            int readTimeoutMs) {
        RestTemplateBuilder nonNullBuilder = Objects.requireNonNull(builder, "builder must not be null");

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        BufferingClientHttpRequestFactory bufferingFactory =
                new BufferingClientHttpRequestFactory(requestFactory);

        return nonNullBuilder.requestFactory(() -> bufferingFactory).build();
    }
}
