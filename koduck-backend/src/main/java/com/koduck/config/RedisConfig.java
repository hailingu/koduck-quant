package com.koduck.config;

import java.util.Objects;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Redis configuration for low-level Redis operations.
 * Provides {@link RedisTemplate} and {@link StringRedisTemplate} beans.
 *
 * @author GitHub Copilot
 */
@Configuration
public class RedisConfig {

    /**
     * Global ObjectMapper injected by Spring Boot auto-configuration.
     */
    private final ObjectMapper objectMapper;

    /**
     * Constructs {@link RedisConfig} with injected ObjectMapper.
     *
     * @param objectMapper global Jackson object mapper (must not be {@code null})
     */
    public RedisConfig(ObjectMapper objectMapper) {
        this.objectMapper = Objects.requireNonNull(objectMapper);
    }

    /**
     * Creates a Redis template with String key serializers and JSON value serializers.
     *
     * @param connectionFactory Redis connection factory
     * @return configured RedisTemplate instance
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        ObjectMapper copy = objectMapper.copy().registerModule(new JavaTimeModule());
        StringRedisSerializer stringRedisSerializer = new StringRedisSerializer();
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(copy);

        template.setKeySerializer(stringRedisSerializer);
        template.setHashKeySerializer(stringRedisSerializer);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * Creates a String-based Redis template for simple key-value operations.
     *
     * @param connectionFactory Redis connection factory
     * @return configured StringRedisTemplate instance
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        return template;
    }
}
