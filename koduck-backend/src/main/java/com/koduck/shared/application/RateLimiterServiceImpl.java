package com.koduck.shared.application;

import com.koduck.config.properties.RateLimitProperties;
import com.koduck.service.RateLimiterService;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 限流服务实现类。
 *
 * <p>基于 Redis 的限流器实现，用于控制密码重置请求频率。</p>
 *
 * @author Koduck Team
 * @date 2026-03-31
 */
@Slf4j
@Service
public class RateLimiterServiceImpl implements RateLimiterService {

    private static final String IP_KEY_SEGMENT = "ip:";
    private static final String USER_KEY_SEGMENT = "user:";

    private final StringRedisTemplate redisTemplate;

    // 限流 key 前缀
    private static final String KEY_PREFIX = "rate_limit:";
    private static final String LOGIN_FAILURE_PREFIX = KEY_PREFIX + "login_failure:";
    private static final String LOGIN_FAILURE_IP_PREFIX = KEY_PREFIX + "login_failure_ip:";
    private static final String PASSWORD_RESET_PREFIX = KEY_PREFIX + "password_reset:";
    private static final String PASSWORD_RESET_EMAIL_PREFIX = KEY_PREFIX + "password_reset_email:";

    private final RateLimitProperties rateLimitProperties;

    public RateLimiterServiceImpl(
            StringRedisTemplate redisTemplate,
            RateLimitProperties rateLimitProperties) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
        this.rateLimitProperties = Objects.requireNonNull(
                rateLimitProperties, "rateLimitProperties must not be null");
    }

    @Override
    public boolean allowLoginAttempt(String loginIdentifier, String ip) {
        try {
            RateLimitProperties.LoginFailure loginFailure = rateLimitProperties.getLoginFailure();
            if (StringUtils.hasText(loginIdentifier)) {
                long userFailureCount = getCounterValue(LOGIN_FAILURE_PREFIX + hashLoginIdentifier(loginIdentifier));
                if (userFailureCount >= loginFailure.getMaxFailuresPerUser()) {
                    log.warn("Login temporarily locked due to repeated failures, loginIdentifier={}", loginIdentifier);
                    return false;
                }
            }
            if (StringUtils.hasText(ip)) {
                long ipFailureCount = getCounterValue(LOGIN_FAILURE_IP_PREFIX + hashIp(ip));
                if (ipFailureCount >= loginFailure.getMaxFailuresPerIp()) {
                    log.warn("Login temporarily locked due to repeated failures from ip={}", ip);
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            log.error("Login rate limiter check failed, allowing request", ex);
            return true;
        }
    }

    @Override
    public void recordLoginFailure(String loginIdentifier, String ip) {
        try {
            Duration windowDuration = rateLimitProperties.getLoginFailure().getWindowDuration();
            if (StringUtils.hasText(loginIdentifier)) {
                incrementCounter(LOGIN_FAILURE_PREFIX + hashLoginIdentifier(loginIdentifier), windowDuration);
            }
            if (StringUtils.hasText(ip)) {
                incrementCounter(LOGIN_FAILURE_IP_PREFIX + hashIp(ip), windowDuration);
            }
        } catch (Exception ex) {
            log.error("Failed to record login failure", ex);
        }
    }

    @Override
    public void recordLoginSuccess(String loginIdentifier, String ip) {
        if (StringUtils.hasText(loginIdentifier)) {
            redisTemplate.delete(LOGIN_FAILURE_PREFIX + hashLoginIdentifier(loginIdentifier));
        }
        if (StringUtils.hasText(ip)) {
            redisTemplate.delete(LOGIN_FAILURE_IP_PREFIX + hashIp(ip));
        }
    }

    /**
     * 检查是否允许密码重置请求。
     *
     * @param userId 用户ID（可为空）
     * @param email  邮箱
     * @param ip     IP 地址
     * @return true 允许请求，false 拒绝请求
     */
    @Override
    public boolean allowPasswordResetRequest(String userId, String email, String ip) {
        try {
            RateLimitProperties.PasswordReset passwordReset = rateLimitProperties.getPasswordReset();
            if (ip == null || ip.isBlank()) {
                log.warn("Password reset rate limit check skipped due to blank ip");
                return true;
            }
            // 1. 检查 IP 限制
            String ipKey = PASSWORD_RESET_PREFIX + IP_KEY_SEGMENT + hashIp(ip);
            if (!incrementAndCheckLimit(
                    ipKey,
                    passwordReset.getMaxRequestsPerIp(),
                    passwordReset.getWindowDuration())) {
                log.warn("Password reset rate limit exceeded for IP: {}", ip);
                return false;
            }
            // 2. 检查邮箱限制
            if (email != null && !email.isBlank()) {
                String emailKey = PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email);
                if (!incrementAndCheckLimit(
                        emailKey,
                        passwordReset.getMaxRequestsPerEmail(),
                        passwordReset.getWindowDuration())) {
                    log.warn("Password reset rate limit exceeded for email: {}", email);
                    return false;
                }
            }
            // 3. 检查用户限制（如果提供了 userId）
            if (userId != null && !userId.isBlank()) {
                String userKey = PASSWORD_RESET_PREFIX + USER_KEY_SEGMENT + userId;
                if (!incrementAndCheckLimit(
                        userKey,
                        passwordReset.getMaxRequestsPerUser(),
                        passwordReset.getWindowDuration())) {
                    log.warn("Password reset rate limit exceeded for user: {}", userId);
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            // Redis 异常时，允许请求通过（降级处理）
            log.error("Rate limiter check failed, allowing request", e);
            return true;
        }
    }
    /**
     * 增加计数并检查是否超过限制。
     *
     * @param key      Redis key
     * @param maxCount 最大允许次数
     * @param window   时间窗口
     * @return true 未超过限制
     */
    private boolean incrementAndCheckLimit(String key, int maxCount, Duration window) {
        // 使用 Redis INCR 原子操作
        String nonNullKey = requireNonNullKey(key);
        Long newCount = redisTemplate.opsForValue().increment(nonNullKey);
        if (newCount == null) {
            log.warn("Rate limiter increment returned null, key={}", key);
            return true;
        }
        // 首次设置过期时间
        if (newCount == 1L) {
            redisTemplate.expire(nonNullKey, window.getSeconds(), TimeUnit.SECONDS);
        }
        return newCount <= maxCount;
    }

    private long getCounterValue(String key) {
        String counter = redisTemplate.opsForValue().get(requireNonNullKey(key));
        if (counter == null) {
            return 0L;
        }
        return Long.parseLong(counter);
    }

    private void incrementCounter(String key, Duration window) {
        String nonNullKey = requireNonNullKey(key);
        Long newCount = redisTemplate.opsForValue().increment(nonNullKey);
        if (newCount != null && newCount == 1L) {
            redisTemplate.expire(nonNullKey, window.getSeconds(), TimeUnit.SECONDS);
        }
    }
    /**
     * 获取当前计数（用于调试）。
     *
     * @param key Redis key
     * @return 当前计数
     */
    @Override
    public long getCurrentCount(String key) {
        String countStr = redisTemplate.opsForValue().get(requireNonNullKey(key));
        return countStr != null ? Long.parseLong(countStr) : 0;
    }
    /**
     * 重置限流计数（用于测试或手动解锁）。
     *
     * @param userId 用户ID
     * @param email  邮箱
     * @param ip     IP 地址
     */
    @Override
    public void resetRateLimit(String userId, String email, String ip) {
        if (ip != null && !ip.isBlank()) {
            redisTemplate.delete(PASSWORD_RESET_PREFIX + IP_KEY_SEGMENT + hashIp(ip));
        }
        if (email != null && !email.isBlank()) {
            redisTemplate.delete(PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email));
        }
        if (userId != null && !userId.isBlank()) {
            redisTemplate.delete(PASSWORD_RESET_PREFIX + USER_KEY_SEGMENT + userId);
        }
    }
    /**
     * 对 IP 进行简单哈希（避免暴露原始 IP）
     */
    private String hashIp(String ip) {
        return String.valueOf(ip.hashCode());
    }
    /**
     * 对邮箱进行简单哈希
     */
    private String hashEmail(String email) {
        return String.valueOf(email.toLowerCase(Locale.ROOT).hashCode());
    }

    private String hashLoginIdentifier(String loginIdentifier) {
        return String.valueOf(loginIdentifier.toLowerCase(Locale.ROOT).hashCode());
    }

    
    private static String requireNonNullKey(String key) {
        return Objects.requireNonNull(key, "key must not be null");
    }
}
