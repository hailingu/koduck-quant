package com.koduck.config;

import java.time.Duration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;

import com.koduck.config.properties.DataServiceProperties;
import com.koduck.config.properties.FinnhubProperties;

import io.netty.channel.ChannelOption;
import reactor.netty.http.client.HttpClient;

/**
 * Shared WebClient bean configuration.
 *
 * @author Koduck Team
 */
@Configuration
public class WebClientConfig {

    /**
     * Default WebClient builder.
     *
     * @return WebClient.Builder instance
     */
    @Bean
    WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    /**
     * Default WebClient bean.
     *
     * @param builder WebClient builder
     * @return default WebClient instance
     */
    @Bean
    WebClient webClient(WebClient.Builder builder) {
        return builder.build();
    }

    /**
     * WebClient for data-service HTTP calls with configured timeouts.
     *
     * @param builder WebClient builder
     * @param properties data-service timeout properties
     * @return configured WebClient instance for data service
     */
    @Bean
    public WebClient dataServiceWebClient(WebClient.Builder builder, DataServiceProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.getConnectTimeoutMs())
                .responseTimeout(Duration.ofMillis(properties.getReadTimeoutMs()));

        return builder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    /**
     * WebClient for Finnhub API calls with configured timeouts.
     *
     * @param builder WebClient builder
     * @param properties Finnhub timeout properties
     * @return configured WebClient instance for Finnhub API
     */
    @Bean
    public WebClient finnhubWebClient(WebClient.Builder builder, FinnhubProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, properties.getConnectTimeoutMs())
                .responseTimeout(Duration.ofMillis(properties.getReadTimeoutMs()));

        return builder
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
