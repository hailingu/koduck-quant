package com.koduck.service.impl;

import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.RedisKeyConstants;
import com.koduck.service.UserCacheService;
import com.koduck.service.cache.CacheLayer;

import lombok.extern.slf4j.Slf4j;

/**
 * User watchlist caching service implementation using Redis.
 * Provides session-level caching for user tracking and watch lists.
 */
@Service
@Slf4j
public class UserCacheServiceImpl implements UserCacheService {
    private final CacheLayer cacheLayer;

    public UserCacheServiceImpl(CacheLayer cacheLayer) {
        this.cacheLayer = Objects.requireNonNull(cacheLayer, "cacheLayer must not be null");
    }

    // ==================== User Tracking List () ====================

    @Override
    public void addToUserTrackList(@NonNull Long userId, @NonNull String symbol) {
        String key = RedisKeyConstants.userTrackKey(userId);
        try {
            cacheLayer.addSetMember(key, symbol);
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
            cacheLayer.removeSetMember(key, symbol);
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
            Set<Object> members = cacheLayer.getSetMembers(key);
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
            Set<Object> members = cacheLayer.getSetMembers(key);
            return members != null && members.contains(symbol);
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
            cacheLayer.addSetMember(key, symbol);
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
            cacheLayer.removeSetMember(key, symbol);
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
            Set<Object> members = cacheLayer.getSetMembers(key);
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
            cacheLayer.replaceSet(key, symbols);
            log.debug("Cached user track list: userId={}, count={}", userId, symbols != null ? symbols.size() : 0);
        } catch (Exception e) {
            log.warn("Failed to cache user track list: userId={}, error={}", userId, e.getMessage());
        }
    }

    @Override
    public void cacheUserWatchList(@NonNull Long userId, Set<String> symbols) {
        String key = RedisKeyConstants.userWatchKey(userId);
        try {
            cacheLayer.replaceSet(key, symbols);
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
            cacheLayer.delete(trackKey);
            cacheLayer.delete(watchKey);
            log.debug("Invalidated user cache: userId={}", userId);
        } catch (Exception e) {
            log.warn("Failed to invalidate user cache: userId={}, error={}", userId, e.getMessage());
        }
    }
}
