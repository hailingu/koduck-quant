package com.koduck.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * 限流服务
 *
 * <p>基于 Redis 实现滑动窗口限流，用于保护敏感接口免受暴力攻击。</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    // 限流配置
    private static final String KEY_PREFIX = "rate_limit:";
    private static final String PASSWORD_RESET_PREFIX = KEY_PREFIX + "password_reset:";
    private static final String PASSWORD_RESET_EMAIL_PREFIX = KEY_PREFIX + "password_reset_email:";

    // 限流阈值
    public static final int MAX_REQUESTS_PER_USER = 3;          // 每用户每小时最大请求次数
    public static final int MAX_REQUESTS_PER_EMAIL = 5;         // 每邮箱每小时最大请求次数
    public static final int MAX_REQUESTS_PER_IP = 10;           // 每IP每小时最大请求次数
    public static final Duration WINDOW_DURATION = Duration.ofHours(1);

    /**
     * 检查密码重置请求是否超过限流阈值
     *
     * @param userId 用户ID（如果存在）
     * @param email  邮箱地址
     * @param ip     IP地址
     * @return true 如果请求被允许，false 如果触发限流
     */
    public boolean allowPasswordResetRequest(String userId, String email, String ip) {
        try {
            // 1. 检查 IP 限流
            String ipKey = PASSWORD_RESET_PREFIX + "ip:" + hashIp(ip);
            if (!incrementAndCheckLimit(ipKey, MAX_REQUESTS_PER_IP, WINDOW_DURATION)) {
                log.warn("Password reset rate limit exceeded for IP: {}", ip);
                return false;
            }

            // 2. 检查邮箱限流
            if (email != null && !email.isBlank()) {
                String emailKey = PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email);
                if (!incrementAndCheckLimit(emailKey, MAX_REQUESTS_PER_EMAIL, WINDOW_DURATION)) {
                    log.warn("Password reset rate limit exceeded for email: {}", email);
                    return false;
                }
            }

            // 3. 检查用户限流（如果提供了 userId）
            if (userId != null && !userId.isBlank()) {
                String userKey = PASSWORD_RESET_PREFIX + "user:" + userId;
                if (!incrementAndCheckLimit(userKey, MAX_REQUESTS_PER_USER, WINDOW_DURATION)) {
                    log.warn("Password reset rate limit exceeded for user: {}", userId);
                    return false;
                }
            }

            return true;
        } catch (Exception e) {
            // Redis 故障时，记录错误但允许请求（降级策略）
            log.error("Rate limiter check failed, allowing request", e);
            return true;
        }
    }

    /**
     * 增加计数并检查是否超过限制
     *
     * @param key      Redis key
     * @param maxCount 最大允许次数
     * @param window   时间窗口
     * @return true 如果未超过限制
     */
    private boolean incrementAndCheckLimit(String key, int maxCount, Duration window) {
        String countStr = redisTemplate.opsForValue().get(key);
        long count = countStr != null ? Long.parseLong(countStr) : 0;

        if (count >= maxCount) {
            return false;
        }

        // 使用 Redis INCR 原子操作
        Long newCount = redisTemplate.opsForValue().increment(key);

        // 第一次设置过期时间
        if (newCount != null && newCount == 1) {
            redisTemplate.expire(key, window.getSeconds(), TimeUnit.SECONDS);
        }

        return newCount != null && newCount <= maxCount;
    }

    /**
     * 获取当前计数（用于日志和监控）
     *
     * @param key Redis key
     * @return 当前计数
     */
    public long getCurrentCount(String key) {
        String countStr = redisTemplate.opsForValue().get(key);
        return countStr != null ? Long.parseLong(countStr) : 0;
    }

    /**
     * 重置限流计数（主要用于测试）
     *
     * @param userId 用户ID
     * @param email  邮箱
     * @param ip     IP地址
     */
    public void resetRateLimit(String userId, String email, String ip) {
        if (ip != null) {
            redisTemplate.delete(PASSWORD_RESET_PREFIX + "ip:" + hashIp(ip));
        }
        if (email != null) {
            redisTemplate.delete(PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email));
        }
        if (userId != null) {
            redisTemplate.delete(PASSWORD_RESET_PREFIX + "user:" + userId);
        }
    }

    /**
     * 对 IP 进行简单哈希（隐私保护）
     */
    private String hashIp(String ip) {
        return String.valueOf(ip.hashCode());
    }

    /**
     * 对邮箱进行简单哈希（隐私保护）
     */
    private String hashEmail(String email) {
        return String.valueOf(email.toLowerCase().hashCode());
    }
}
