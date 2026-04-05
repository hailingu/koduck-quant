package com.koduck.infrastructure.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link RedisConfig}. Uses an
 * {@link ApplicationContextRunner} to spin up a minimal context containing the
 * configuration under test and a dummy connection factory.
 *
 * @author GitHub Copilot
 */
class RedisConfigTest {

    /** Context runner for testing Redis configuration. */
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class, RedisConfig.class);

    /**
     * Confirms that RedisTemplate and StringRedisTemplate beans are created
     * with the expected serializers attached.
     */
    @Test
    @DisplayName("shouldBuildTemplatesWithProperSerializers")
    void shouldBuildTemplatesWithProperSerializers() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();

            RedisConnectionFactory factory = context.getBean(RedisConnectionFactory.class);
            assertThat(factory).isNotNull();

            ObjectMapper objectMapper = context.getBean(ObjectMapper.class);
            RedisConfig config = new RedisConfig(objectMapper);
            RedisTemplate<String, Object> redisTemplate = config.redisTemplate(factory);
            assertThat(redisTemplate.getConnectionFactory()).isSameAs(factory);

            assertThat(redisTemplate.getKeySerializer()).isInstanceOf(StringRedisSerializer.class);
            assertThat(redisTemplate.getHashKeySerializer()).isInstanceOf(StringRedisSerializer.class);
            assertThat(redisTemplate.getValueSerializer()).isInstanceOf(GenericJackson2JsonRedisSerializer.class);
            assertThat(redisTemplate.getHashValueSerializer()).isInstanceOf(GenericJackson2JsonRedisSerializer.class);

            StringRedisTemplate stringTemplate = config.stringRedisTemplate(factory);
            assertThat(stringTemplate.getConnectionFactory()).isSameAs(factory);
        });
    }

    @Configuration
    static class TestConfiguration {
        @Bean
        RedisConnectionFactory connectionFactory() {
            return org.mockito.Mockito.mock(RedisConnectionFactory.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }
}
