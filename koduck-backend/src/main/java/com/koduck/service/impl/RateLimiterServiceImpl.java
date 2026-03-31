package com.koduck.service.impl;

import com.koduck.service.RateLimiterService;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

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
    private static final String PASSWORD_RESET_PREFIX = KEY_PREFIX + "password_reset:";
    private static final String PASSWORD_RESET_EMAIL_PREFIX = KEY_PREFIX + "password_reset_email:";
    // 限流配置常量
    public static final int MAX_REQUESTS_PER_USER = 3;          // 每用户每小时最大请求数
    public static final int MAX_REQUESTS_PER_EMAIL = 5;         // 每邮箱每小时最大请求数
    public static final int MAX_REQUESTS_PER_IP = 10;           // 每 IP 每小时最大请求数
    public static final Duration WINDOW_DURATION = Duration.ofHours(1);

    public RateLimiterServiceImpl(StringRedisTemplate redisTemplate) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
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
            if (ip == null || ip.isBlank()) {
                log.warn("Password reset rate limit check skipped due to blank ip");
                return true;
            }
            // 1. 检查 IP 限制
            String ipKey = PASSWORD_RESET_PREFIX + IP_KEY_SEGMENT + hashIp(ip);
            if (!incrementAndCheckLimit(ipKey, MAX_REQUESTS_PER_IP, WINDOW_DURATION)) {
                log.warn("Password reset rate limit exceeded for IP: {}", ip);
                return false;
            }
            // 2. 检查邮箱限制
            if (email != null && !email.isBlank()) {
                String emailKey = PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email);
                if (!incrementAndCheckLimit(emailKey, MAX_REQUESTS_PER_EMAIL, WINDOW_DURATION)) {
                    log.warn("Password reset rate limit exceeded for email: {}", email);
                    return false;
                }
            }
            // 3. 检查用户限制（如果提供了 userId）
            if (userId != null && !userId.isBlank()) {
                String userKey = PASSWORD_RESET_PREFIX + USER_KEY_SEGMENT + userId;
                if (!incrementAndCheckLimit(userKey, MAX_REQUESTS_PER_USER, WINDOW_DURATION)) {
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
        Long newCount = redisTemplate.opsForValue().increment(key);
        if (newCount == null) {
            log.warn("Rate limiter increment returned null, key={}", key);
            return true;
        }
        // 首次设置过期时间
        if (newCount == 1L) {
            redisTemplate.expire(key, window.getSeconds(), TimeUnit.SECONDS);
        }
        return newCount <= maxCount;
    }
    /**
     * 获取当前计数（用于调试）。
     *
     * @param key Redis key
     * @return 当前计数
     */
    @Override
    public long getCurrentCount(String key) {
        String countStr = redisTemplate.opsForValue().get(key);
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
}
