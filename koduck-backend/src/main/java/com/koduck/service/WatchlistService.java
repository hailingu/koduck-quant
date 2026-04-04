package com.koduck.service;

import java.util.List;

import com.koduck.dto.watchlist.AddWatchlistRequest;
import com.koduck.dto.watchlist.SortWatchlistRequest;
import com.koduck.dto.watchlist.WatchlistItemDto;

/**
 * 自选股操作服务接口。
 *
 * @author GitHub Copilot
 */
public interface WatchlistService {

    /**
     * 获取用户的自选股列表（含实时价格）。
     *
     * @param userId 用户ID
     * @return 自选股项目列表（含实时价格）
     */
    List<WatchlistItemDto> getWatchlist(Long userId);

    /**
     * 添加股票到用户自选股。
     *
     * @param userId  用户ID
     * @param request 添加请求，包含代码、市场、名称和备注
     * @return 创建的自选股项目
     */
    WatchlistItemDto addToWatchlist(Long userId, AddWatchlistRequest request);

    /**
     * 从自选股中移除股票。
     *
     * @param userId 用户ID
     * @param itemId 要移除的自选股项目ID
     */
    void removeFromWatchlist(Long userId, Long itemId);

    /**
     * 更新自选股项目的排序。
     *
     * @param userId  用户ID
     * @param request 排序请求，包含项目ID和新的排序顺序
     */
    void sortWatchlist(Long userId, SortWatchlistRequest request);

    /**
     * 更新自选股项目的备注。
     *
     * @param userId 用户ID
     * @param itemId 自选股项目ID
     * @param notes  新备注
     * @return 更新后的自选股项目
     */
    WatchlistItemDto updateNotes(Long userId, Long itemId, String notes);
}
