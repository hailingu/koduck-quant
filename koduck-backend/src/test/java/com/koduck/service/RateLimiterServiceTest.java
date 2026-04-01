package com.koduck.service;

import com.koduck.config.properties.RateLimitProperties;
import com.koduck.service.impl.RateLimiterServiceImpl;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link RateLimiterService}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@SuppressWarnings("null")
class RateLimiterServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private RateLimiterServiceImpl rateLimiterService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        rateLimiterService = new RateLimiterServiceImpl(redisTemplate, createRateLimitProperties());
    }

    @Test
    @DisplayName("shouldAllowRequestWhenUnderLimit")
    void shouldAllowRequestWhenUnderLimit() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.increment(anyString())).thenReturn(1L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(userId, email, ip);

        // Then
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenIpLimitExceeded")
    void shouldBlockRequestWhenIpLimitExceeded() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.increment(contains("ip:"))).thenReturn(11L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(userId, email, ip);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenEmailLimitExceeded")
    void shouldBlockRequestWhenEmailLimitExceeded() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.increment(contains("ip:"))).thenReturn(1L);
        when(valueOperations.increment(contains("email:"))).thenReturn(6L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(userId, email, ip);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenUserLimitExceeded")
    void shouldBlockRequestWhenUserLimitExceeded() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.increment(contains("ip:"))).thenReturn(1L);
        when(valueOperations.increment(contains("email:"))).thenReturn(1L);
        when(valueOperations.increment(contains("user:"))).thenReturn(4L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(userId, email, ip);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldAllowRequestWhenRedisFails")
    void shouldAllowRequestWhenRedisFails() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.increment(anyString())).thenThrow(new RuntimeException("Redis connection failed"));

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(userId, email, ip);

        // Then - should allow request on failure (fail-open strategy)
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("shouldAllowRequestWhenNoUserIdProvided")
    void shouldAllowRequestWhenNoUserId() {
        // Given
        String email = "user@example.com";
        String ip = "192.168.1.1";

        when(valueOperations.increment(anyString())).thenReturn(1L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(null, email, ip);

        // Then
        assertThat(result).isTrue();
        // Should only check IP and email, not user
        verify(valueOperations, never()).increment(contains("user:"));
    }

    @Test
    @DisplayName("shouldResetRateLimitCounters")
    void shouldResetRateLimitCounters() {
        // Given
        String userId = "1";
        String email = "user@example.com";
        String ip = "192.168.1.1";

        // When
        rateLimiterService.resetRateLimit(userId, email, ip);

        // Then
        verify(redisTemplate, times(3)).delete(anyString());
    }

    @Test
    @DisplayName("shouldGetCurrentCount")
    void shouldGetCurrentCount() {
        // Given
        String key = "rate_limit:test";
        when(valueOperations.get(key)).thenReturn("5");

        // When
        long count = rateLimiterService.getCurrentCount(key);

        // Then
        assertThat(count).isEqualTo(5);
    }

    @Test
    @DisplayName("shouldReturnZeroWhenKeyNotExists")
    void shouldReturnZeroWhenKeyNotExists() {
        // Given
        String key = "rate_limit:nonexistent";
        when(valueOperations.get(key)).thenReturn(null);

        // When
        long count = rateLimiterService.getCurrentCount(key);

        // Then
        assertThat(count).isZero();
    }

    @Test
    @DisplayName("shouldBlockLoginAttemptWhenConfiguredUserFailureThresholdReached")
    void shouldBlockLoginAttemptWhenConfiguredUserFailureThresholdReached() {
        // Given
        String loginIdentifier = "trader@example.com";
        String ip = "192.168.1.1";

        RateLimitProperties properties = new RateLimitProperties(
            new RateLimitProperties.LoginFailure(2, 20, Duration.ofMinutes(15)),
            new RateLimitProperties.PasswordReset(3, 5, 10, Duration.ofHours(1)));
        RateLimiterServiceImpl customRateLimiterService = new RateLimiterServiceImpl(redisTemplate, properties);

        when(valueOperations.get(contains("login_failure:"))).thenReturn("2");

        // When
        boolean allowed = customRateLimiterService.allowLoginAttempt(loginIdentifier, ip);

        // Then
        assertThat(allowed).isFalse();
    }

    private RateLimitProperties createRateLimitProperties() {
        return new RateLimitProperties(
                new RateLimitProperties.LoginFailure(5, 20, Duration.ofMinutes(15)),
                new RateLimitProperties.PasswordReset(3, 5, 10, Duration.ofHours(1)));
    }
}
