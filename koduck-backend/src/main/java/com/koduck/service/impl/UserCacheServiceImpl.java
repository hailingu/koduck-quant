package com.koduck.service.impl;

import com.koduck.config.RedisKeyConstants;
import com.koduck.service.UserCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;

import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * User watchlist caching service implementation using Redis.
 * Provides session-level caching for user tracking and watch lists.
 */
@Service
@Slf4j
public class UserCacheServiceImpl implements UserCacheService {
    private final RedisTemplate<String, Object> redisTemplate;

    public UserCacheServiceImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
    }

    // ==================== User Tracking List () ====================

    @Override
    public void addToUserTrackList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            redisTemplate.opsForSet().add(key, symbol);
            log.debug("Added to user track list: userId={}, symbol={}", userId, symbol);
        } catch (Exception e) {
            log.warn("Failed to add to user track list: userId={}, symbol={}, error={}", 
                    userId, symbol, e.getMessage());
        }
    }

    @Override
    public void removeFromUserTrackList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            redisTemplate.opsForSet().remove(key, symbol);
            log.debug("Removed from user track list: userId={}, symbol={}", userId, symbol);
        } catch (Exception e) {
            log.warn("Failed to remove from user track list: userId={}, symbol={}, error={}", 
                    userId, symbol, e.getMessage());
        }
    }

    @Override
    public Set<String> getUserTrackList(@NonNull Long userId) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            Set<Object> members = redisTemplate.opsForSet().members(key);
            if (members != null && !members.isEmpty()) {
                log.debug("Cache hit: user track list userId={}", userId);
                return members.stream()
                        .map(Object::toString)
                        .collect(Collectors.toSet());
            }
        } catch (Exception e) {
            log.warn("Failed to get user track list: userId={}, error={}", userId, e.getMessage());
        }
        return Set.of();
    }

    @Override
    public boolean isInUserTrackList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            Boolean isMember = redisTemplate.opsForSet().isMember(key, symbol);
            return Boolean.TRUE.equals(isMember);
        } catch (Exception e) {
            log.warn("Failed to check user track list: userId={}, symbol={}, error={}", 
                    userId, symbol, e.getMessage());
            return false;
        }
    }

    // ==================== User Watchlist () ====================

    @Override
    public void addToUserWatchList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            redisTemplate.opsForSet().add(key, symbol);
            log.debug("Added to user watch list: userId={}, symbol={}", userId, symbol);
        } catch (Exception e) {
            log.warn("Failed to add to user watch list: userId={}, symbol={}, error={}", 
                    userId, symbol, e.getMessage());
        }
    }

    @Override
    public void removeFromUserWatchList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            redisTemplate.opsForSet().remove(key, symbol);
            log.debug("Removed from user watch list: userId={}, symbol={}", userId, symbol);
        } catch (Exception e) {
            log.warn("Failed to remove from user watch list: userId={}, symbol={}, error={}", 
                    userId, symbol, e.getMessage());
        }
    }

    @Override
    public Set<String> getUserWatchList(@NonNull Long userId) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            Set<Object> members = redisTemplate.opsForSet().members(key);
            if (members != null && !members.isEmpty()) {
                log.debug("Cache hit: user watch list userId={}", userId);
                return members.stream()
                        .map(Object::toString)
                        .collect(Collectors.toSet());
            }
        } catch (Exception e) {
            log.warn("Failed to get user watch list: userId={}, error={}", userId, e.getMessage());
        }
        return Set.of();
    }

    // ==================== Bulk Operations ====================

    @Override
    public void cacheUserTrackList(@NonNull Long userId, Set<String> symbols) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            redisTemplate.delete(key);
            if (symbols != null && !symbols.isEmpty()) {
                for (String item : symbols) {
                    redisTemplate.opsForSet().add(key, item);
                }
            }
            log.debug("Cached user track list: userId={}, count={}", userId, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache user track list: userId={}, error={}", userId, e.getMessage());
        }
    }

    @Override
    public void cacheUserWatchList(@NonNull Long userId, Set<String> symbols) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            redisTemplate.delete(key);
            if (symbols != null && !symbols.isEmpty()) {
                for (String item : symbols) {
                    redisTemplate.opsForSet().add(key, item);
                }
            }
            log.debug("Cached user watch list: userId={}, count={}", userId, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache user watch list: userId={}, error={}", userId, e.getMessage());
        }
    }

    @Override
    public void invalidateUserCache(@NonNull Long userId) {
        try {
            String trackKey = RedisKeyConstants.userTrackKey(userId);
            String watchKey = RedisKeyConstants.userWatchKey(userId);
            redisTemplate.delete(trackKey);
            redisTemplate.delete(watchKey);
            log.debug("Invalidated user cache: userId={}", userId);
        } catch (Exception e) {
            log.warn("Failed to invalidate user cache: userId={}, error={}", userId, e.getMessage());
        }
    }
}
