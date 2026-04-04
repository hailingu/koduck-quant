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
 * 共享 WebClient Bean 配置。
 *
 * @author Koduck Team
 */
@Configuration
public class WebClientConfig {

    /**
     * 默认 WebClient 构建器。
     *
     * @return WebClient.Builder 实例
     */
    @Bean
    WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    /**
     * 默认 WebClient Bean。
     *
     * @param builder WebClient 构建器
     * @return 默认 WebClient 实例
     */
    @Bean
    WebClient webClient(WebClient.Builder builder) {
        return builder.build();
    }

    /**
     * 用于数据服务 HTTP 调用的 WebClient，配置了超时。
     *
     * @param builder WebClient 构建器
     * @param properties 数据服务超时属性
     * @return 用于数据服务的配置 WebClient 实例
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
     * 用于 Finnhub API 调用的 WebClient，配置了超时。
     *
     * @param builder WebClient 构建器
     * @param properties Finnhub timeout properties
     * @return 用于 Finnhub API 的配置 WebClient 实例
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
