package com.koduck.service;

import java.util.Set;

import org.springframework.lang.NonNull;

/**
 * 用户自选股缓存服务接口。
 * 提供基于Redis的用户追踪列表和自选股列表缓存。
 *
 * @author GitHub Copilot
 */
public interface UserCacheService {

    // ==================== 用户追踪列表 ====================

    /**
     * 添加股票到用户的追踪列表。
     * 键：user:track:{userId}
     *
     * @param userId 用户ID
     * @param symbol 要添加的股票代码
     */
    void addToUserTrackList(@NonNull Long userId, @NonNull String symbol);

    /**
     * 从用户的追踪列表中移除股票。
     *
     * @param userId 用户ID
     * @param symbol 要移除的股票代码
     */
    void removeFromUserTrackList(@NonNull Long userId, @NonNull String symbol);

    /**
     * 从缓存中获取用户的追踪列表。
     *
     * @param userId 用户ID
     * @return 股票代码集合
     */
    Set<String> getUserTrackList(@NonNull Long userId);

    /**
     * 检查股票是否在用户的追踪列表中。
     *
     * @param userId 用户ID
     * @param symbol 股票代码
     * @return 如果存在则返回true
     */
    boolean isInUserTrackList(@NonNull Long userId, @NonNull String symbol);

    // ==================== 用户自选股 ====================

    /**
     * 添加股票到用户的自选股。
     * 键：user:watch:{userId}
     *
     * @param userId 用户ID
     * @param symbol 要添加的股票代码
     */
    void addToUserWatchList(@NonNull Long userId, @NonNull String symbol);

    /**
     * 从用户的自选股中移除股票。
     *
     * @param userId 用户ID
     * @param symbol 要移除的股票代码
     */
    void removeFromUserWatchList(@NonNull Long userId, @NonNull String symbol);

    /**
     * 从缓存中获取用户的自选股列表。
     *
     * @param userId 用户ID
     * @return 股票代码集合
     */
    Set<String> getUserWatchList(@NonNull Long userId);

    // ==================== 批量操作 ====================

    /**
     * 缓存用户的追踪列表（全量替换）。
     *
     * @param userId  用户ID
     * @param symbols 股票代码列表
     */
    void cacheUserTrackList(@NonNull Long userId, Set<String> symbols);

    /**
     * 缓存用户的自选股列表（全量替换）。
     *
     * @param userId  用户ID
     * @param symbols 股票代码列表
     */
    void cacheUserWatchList(@NonNull Long userId, Set<String> symbols);

    /**
     * 使用户的所有缓存数据失效。
     *
     * @param userId 用户ID
     */
    void invalidateUserCache(@NonNull Long userId);
}
