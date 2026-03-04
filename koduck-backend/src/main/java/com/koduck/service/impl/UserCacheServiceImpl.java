package com.koduck.service.impl;

import com.koduck.config.RedisKeyConstants;
import com.koduck.service.UserCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

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
        this.redisTemplate = redisTemplate;
    }

    // ==================== User Tracking List (盯盘列表) ====================

    @Override
    public void addToUserTrackList(Long userId, String symbol) {
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
    public void removeFromUserTrackList(Long userId, String symbol) {
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
    @SuppressWarnings("unchecked")
    public Set<String> getUserTrackList(Long userId) {
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
        return null;
    }

    @Override
    public boolean isInUserTrackList(Long userId, String symbol) {
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

    // ==================== User Watchlist (观察列表) ====================

    @Override
    public void addToUserWatchList(Long userId, String symbol) {
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
    public void removeFromUserWatchList(Long userId, String symbol) {
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
    @SuppressWarnings("unchecked")
    public Set<String> getUserWatchList(Long userId) {
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
        return null;
    }

    // ==================== Bulk Operations ====================

    @Override
    public void cacheUserTrackList(Long userId, Set<String> symbols) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            redisTemplate.delete(key);
            if (symbols != null && !symbols.isEmpty()) {
                redisTemplate.opsForSet().add(key, symbols.toArray());
            }
            log.debug("Cached user track list: userId={}, count={}", userId, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache user track list: userId={}, error={}", userId, e.getMessage());
        }
    }

    @Override
    public void cacheUserWatchList(Long userId, Set<String> symbols) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            redisTemplate.delete(key);
            if (symbols != null && !symbols.isEmpty()) {
                redisTemplate.opsForSet().add(key, symbols.toArray());
            }
            log.debug("Cached user watch list: userId={}, count={}", userId, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache user watch list: userId={}, error={}", userId, e.getMessage());
        }
    }

    @Override
    public void invalidateUserCache(Long userId) {
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
