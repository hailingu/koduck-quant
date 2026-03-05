package com.koduck.config;

import com.koduck.config.properties.DataServiceProperties;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Configuration for RestTemplate instances used by external API clients.
 *
 * <p>Defines a bean with custom connection and read timeouts pulled from
 * {@link DataServiceProperties} and wraps the underlying request factory with
 * buffering capabilities to support logging of response bodies.</p>
 */
@Configuration
public class RestTemplateConfig {
    
    /**
     * Creates a RestTemplate preconfigured for the data service.
     *
     * @param builder    spring-provided RestTemplateBuilder
     * @param properties configuration object holding timeout values
     * @return a RestTemplate instance with buffering request factory and
     * configured timeouts
     */
    @Bean
    public RestTemplate dataServiceRestTemplate(RestTemplateBuilder builder, DataServiceProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeoutMs());
        factory.setReadTimeout(properties.getReadTimeoutMs());
        
        // Use buffering factory to allow response body to be read multiple times (for logging)
        BufferingClientHttpRequestFactory bufferingFactory = new BufferingClientHttpRequestFactory(factory);
        
        return builder
                .requestFactory(() -> bufferingFactory)
                .build();
    }
}
