package com.koduck.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * 
 *
 * <p> Redis ，</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    // 
    private static final String KEY_PREFIX = "rate_limit:";
    private static final String PASSWORD_RESET_PREFIX = KEY_PREFIX + "password_reset:";
    private static final String PASSWORD_RESET_EMAIL_PREFIX = KEY_PREFIX + "password_reset_email:";

    // 
    public static final int MAX_REQUESTS_PER_USER = 3;          // 
    public static final int MAX_REQUESTS_PER_EMAIL = 5;         // 
    public static final int MAX_REQUESTS_PER_IP = 10;           // IP
    public static final Duration WINDOW_DURATION = Duration.ofHours(1);

    /**
     * 
     *
     * @param userId ID（）
     * @param email  
     * @param ip     IP
     * @return true ，false 
     */
    public boolean allowPasswordResetRequest(String userId, String email, String ip) {
        try {
            // 1.  IP 
            String ipKey = PASSWORD_RESET_PREFIX + "ip:" + hashIp(ip);
            if (!incrementAndCheckLimit(ipKey, MAX_REQUESTS_PER_IP, WINDOW_DURATION)) {
                log.warn("Password reset rate limit exceeded for IP: {}", ip);
                return false;
            }

            // 2. 
            if (email != null && !email.isBlank()) {
                String emailKey = PASSWORD_RESET_EMAIL_PREFIX + hashEmail(email);
                if (!incrementAndCheckLimit(emailKey, MAX_REQUESTS_PER_EMAIL, WINDOW_DURATION)) {
                    log.warn("Password reset rate limit exceeded for email: {}", email);
                    return false;
                }
            }

            // 3. （ userId）
            if (userId != null && !userId.isBlank()) {
                String userKey = PASSWORD_RESET_PREFIX + "user:" + userId;
                if (!incrementAndCheckLimit(userKey, MAX_REQUESTS_PER_USER, WINDOW_DURATION)) {
                    log.warn("Password reset rate limit exceeded for user: {}", userId);
                    return false;
                }
            }

            return true;
        } catch (Exception e) {
            // Redis ，（）
            log.error("Rate limiter check failed, allowing request", e);
            return true;
        }
    }

    /**
     * 
     *
     * @param key      Redis key
     * @param maxCount 
     * @param window   
     * @return true 
     */
    private boolean incrementAndCheckLimit(String key, int maxCount, Duration window) {
        String countStr = redisTemplate.opsForValue().get(key);
        long count = countStr != null ? Long.parseLong(countStr) : 0;

        if (count >= maxCount) {
            return false;
        }

        //  Redis INCR 
        Long newCount = redisTemplate.opsForValue().increment(key);

        // 
        if (newCount != null && newCount == 1) {
            redisTemplate.expire(key, window.getSeconds(), TimeUnit.SECONDS);
        }

        return newCount != null && newCount <= maxCount;
    }

    /**
     * （）
     *
     * @param key Redis key
     * @return 
     */
    public long getCurrentCount(String key) {
        String countStr = redisTemplate.opsForValue().get(key);
        return countStr != null ? Long.parseLong(countStr) : 0;
    }

    /**
     * （）
     *
     * @param userId ID
     * @param email  
     * @param ip     IP
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
     *  IP （）
     */
    private String hashIp(String ip) {
        return String.valueOf(ip.hashCode());
    }

    /**
     * （）
     */
    private String hashEmail(String email) {
        return String.valueOf(email.toLowerCase().hashCode());
    }
}
