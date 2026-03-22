package com.koduck.config;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.config.properties.FinnhubProperties;
import java.util.Objects;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * RestTemplate configuration for external API calls.
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
        RestTemplateBuilder nonNullBuilder = Objects.requireNonNull(builder, "builder must not be null");
        DataServiceProperties nonNullProperties =
                Objects.requireNonNull(properties, "properties must not be null");

        int connectTimeoutMs = nonNullProperties.getConnectTimeoutMs();
        int readTimeoutMs = nonNullProperties.getReadTimeoutMs();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        BufferingClientHttpRequestFactory bufferingFactory =
                new BufferingClientHttpRequestFactory(requestFactory);

        return nonNullBuilder.requestFactory(() -> bufferingFactory).build();
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
        RestTemplateBuilder nonNullBuilder = Objects.requireNonNull(builder, "builder must not be null");
        FinnhubProperties nonNullProperties =
                Objects.requireNonNull(properties, "properties must not be null");

        int connectTimeoutMs = nonNullProperties.getConnectTimeoutMs();
        int readTimeoutMs = nonNullProperties.getReadTimeoutMs();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        BufferingClientHttpRequestFactory bufferingFactory =
                new BufferingClientHttpRequestFactory(requestFactory);

        return nonNullBuilder.requestFactory(() -> bufferingFactory).build();
    }
}
