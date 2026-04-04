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
 * 底层 Redis 操作的配置。
 * Provides {@link RedisTemplate} and {@link StringRedisTemplate} beans.
 *
 * @author GitHub Copilot
 */
@Configuration
public class RedisConfig {

    /**
     * Spring Boot 自动配置注入的全局 ObjectMapper。
     */
    private final ObjectMapper objectMapper;

    /**
     * 使用注入的 ObjectMapper 构造 {RedisConfig}。
     *
     * @param objectMapper 全局 Jackson 对象映射器 (must not be {@code null})
     */
    public RedisConfig(ObjectMapper objectMapper) {
        this.objectMapper = Objects.requireNonNull(objectMapper);
    }

    /**
     * 创建使用 String 键序列化和 JSON 值序列化的 Redis 模板。
     *
     * @param connectionFactory Redis 连接工厂
     * @return 配置的 RedisTemplate 实例
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
     * 创建用于简单键值操作的基于 String 的 Redis 模板。
     *
     * @param connectionFactory Redis 连接工厂
     * @return 配置的 StringRedisTemplate 实例
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        return template;
    }
}
