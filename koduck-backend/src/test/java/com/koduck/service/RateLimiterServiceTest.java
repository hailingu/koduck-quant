package com.koduck.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

import com.koduck.config.properties.RateLimitProperties;
import com.koduck.shared.application.RateLimiterServiceImpl;

/**
 * Unit tests for {@link RateLimiterService}.
 *
 * @author Koduck Team
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RateLimiterServiceTest {

    /** RedisTemplate mock. */
    @Mock
    private StringRedisTemplate redisTemplate;

    /** ValueOperations mock. */
    @Mock
    private ValueOperations<String, String> valueOperations;

    /** RateLimiterService instance. */
    private RateLimiterServiceImpl rateLimiterService;

    /** User ID constant. */
    private static final String USER_ID = "1";

    /** Email constant. */
    private static final String EMAIL = "user@example.com";

    /** IP address constant. */
    private static final String IP_ADDRESS = "192.168.1.1";

    /** Count value for one. */
    private static final Long COUNT_ONE = 1L;

    /** Count value for two. */
    private static final Long COUNT_TWO = 2L;

    /** Count value for four. */
    private static final Long COUNT_FOUR = 4L;

    /** Count value for five. */
    private static final Long COUNT_FIVE = 5L;

    /** Count value for six. */
    private static final Long COUNT_SIX = 6L;

    /** Count value for eleven. */
    private static final Long COUNT_ELEVEN = 11L;

    /** Expected delete count. */
    private static final int EXPECTED_DELETE_COUNT = 3;

    /** IP limit threshold. */
    private static final int IP_LIMIT_THRESHOLD = 10;

    /** Email limit threshold. */
    private static final int EMAIL_LIMIT_THRESHOLD = 5;

    /** User limit threshold. */
    private static final int USER_LIMIT_THRESHOLD = 3;

    /** Window size for login failure. */
    private static final int LOGIN_FAILURE_WINDOW_SIZE = 20;

    /** Block duration minutes. */
    private static final int BLOCK_DURATION_MINUTES = 15;

    /** Max attempts for password reset. */
    private static final int PASSWORD_RESET_MAX_ATTEMPTS = 3;

    /** Window hours for password reset. */
    private static final int PASSWORD_RESET_WINDOW_HOURS = 1;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        rateLimiterService = new RateLimiterServiceImpl(redisTemplate, createRateLimitProperties());
    }

    @Test
    @DisplayName("shouldAllowRequestWhenUnderLimit")
    void shouldAllowRequestWhenUnderLimit() {
        // Given
        when(valueOperations.get(anyString())).thenReturn(null);
        when(valueOperations.increment(anyString())).thenReturn(COUNT_ONE);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(USER_ID, EMAIL, IP_ADDRESS);

        // Then
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenIpLimitExceeded")
    void shouldBlockRequestWhenIpLimitExceeded() {
        // Given
        when(valueOperations.increment(contains("ip:"))).thenReturn(COUNT_ELEVEN);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(USER_ID, EMAIL, IP_ADDRESS);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenEmailLimitExceeded")
    void shouldBlockRequestWhenEmailLimitExceeded() {
        // Given
        when(valueOperations.increment(contains("ip:"))).thenReturn(COUNT_ONE);
        when(valueOperations.increment(contains("email:"))).thenReturn(COUNT_SIX);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(USER_ID, EMAIL, IP_ADDRESS);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldBlockRequestWhenUserLimitExceeded")
    void shouldBlockRequestWhenUserLimitExceeded() {
        // Given
        when(valueOperations.increment(contains("ip:"))).thenReturn(COUNT_ONE);
        when(valueOperations.increment(contains("email:"))).thenReturn(COUNT_ONE);
        when(valueOperations.increment(contains("user:"))).thenReturn(COUNT_FOUR);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(USER_ID, EMAIL, IP_ADDRESS);

        // Then
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("shouldAllowRequestWhenRedisFails")
    void shouldAllowRequestWhenRedisFails() {
        // Given
        when(valueOperations.increment(anyString())).thenThrow(
            new RuntimeException("Redis connection failed"));

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(USER_ID, EMAIL, IP_ADDRESS);

        // Then - should allow request on failure (fail-open strategy)
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("shouldAllowRequestWhenNoUserIdProvided")
    void shouldAllowRequestWhenNoUserId() {
        // Given
        when(valueOperations.increment(anyString())).thenReturn(COUNT_ONE);

        // When
        boolean result = rateLimiterService.allowPasswordResetRequest(null, EMAIL, IP_ADDRESS);

        // Then
        assertThat(result).isTrue();
        // Should only check IP and email, not user
        verify(valueOperations, never()).increment(contains("user:"));
    }

    @Test
    @DisplayName("shouldResetRateLimitCounters")
    void shouldResetRateLimitCounters() {
        // When
        rateLimiterService.resetRateLimit(USER_ID, EMAIL, IP_ADDRESS);

        // Then
        verify(redisTemplate, times(EXPECTED_DELETE_COUNT)).delete(anyString());
    }

    @Test
    @DisplayName("shouldGetCurrentCount")
    void shouldGetCurrentCount() {
        // Given
        String key = "rate_limit:test";
        when(valueOperations.get(key)).thenReturn(COUNT_FIVE.toString());

        // When
        long count = rateLimiterService.getCurrentCount(key);

        // Then
        assertThat(count).isEqualTo(COUNT_FIVE);
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

        RateLimitProperties properties = new RateLimitProperties(
            new RateLimitProperties.LoginFailure(
                COUNT_TWO.intValue(), LOGIN_FAILURE_WINDOW_SIZE, Duration.ofMinutes(BLOCK_DURATION_MINUTES)),
            new RateLimitProperties.PasswordReset(
                PASSWORD_RESET_MAX_ATTEMPTS, EMAIL_LIMIT_THRESHOLD, IP_LIMIT_THRESHOLD,
                Duration.ofHours(PASSWORD_RESET_WINDOW_HOURS)));
        RateLimiterServiceImpl customRateLimiterService = new RateLimiterServiceImpl(redisTemplate, properties);

        when(valueOperations.get(contains("login_failure:"))).thenReturn(COUNT_TWO.toString());

        // When
        boolean allowed = customRateLimiterService.allowLoginAttempt(loginIdentifier, IP_ADDRESS);

        // Then
        assertThat(allowed).isFalse();
    }

    private RateLimitProperties createRateLimitProperties() {
        return new RateLimitProperties(
                new RateLimitProperties.LoginFailure(
                    USER_LIMIT_THRESHOLD, LOGIN_FAILURE_WINDOW_SIZE, Duration.ofMinutes(BLOCK_DURATION_MINUTES)),
                new RateLimitProperties.PasswordReset(
                    PASSWORD_RESET_MAX_ATTEMPTS, EMAIL_LIMIT_THRESHOLD, IP_LIMIT_THRESHOLD,
                    Duration.ofHours(PASSWORD_RESET_WINDOW_HOURS)));
    }
}
