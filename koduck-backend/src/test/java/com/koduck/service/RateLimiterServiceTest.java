package com.koduck.service;

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
import org.springframework.test.util.ReflectionTestUtils;
import com.koduck.service.impl.RateLimiterServiceImpl;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link RateLimiterService}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RateLimiterServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private RateLimiterServiceImpl rateLimiterService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        rateLimiterService = new RateLimiterServiceImpl();
        ReflectionTestUtils.setField(rateLimiterService, "redisTemplate", redisTemplate);
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

        when(valueOperations.get(contains("ip:"))).thenReturn("10");

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

        when(valueOperations.get(contains("ip:"))).thenReturn(null);
        when(valueOperations.increment(contains("ip:"))).thenReturn(1L);
        when(valueOperations.get(contains("email:"))).thenReturn("5");

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

        when(valueOperations.get(contains("ip:"))).thenReturn(null);
        when(valueOperations.increment(contains("ip:"))).thenReturn(1L);
        when(valueOperations.get(contains("email:"))).thenReturn(null);
        when(valueOperations.increment(contains("email:"))).thenReturn(1L);
        when(valueOperations.get(contains("user:"))).thenReturn("3");

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

        when(valueOperations.get(anyString())).thenThrow(new RuntimeException("Redis connection failed"));

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

        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.increment(anyString())).thenReturn(1L);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(null, email, ip);

        // Then
        assertThat(result).isTrue();
        // Should only check IP and email, not user
        verify(valueOperations, never()).get(contains("user:"));
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
        assertThat(count).isEqualTo(0);
    }
}
