package com.koduck.client;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * AuthClient 配置类。
 *
 * <p>仅在 {@code auth.introspection.enabled=true} 时激活，配置 RestTemplate Bean 和属性绑定。</p>
 */
@Configuration
@EnableConfigurationProperties(AuthClientProperties.class)
@ConditionalOnProperty(prefix = "auth.introspection", name = "enabled", havingValue = "true")
public class AuthClientConfig {

    @Bean
    public RestTemplate authRestTemplate(AuthClientProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.getConnectTimeout());
        factory.setReadTimeout(properties.getReadTimeout());
        return new RestTemplate(factory);
    }
}
