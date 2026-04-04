package com.koduck.service;

import java.util.List;

import com.koduck.dto.market.PriceQuoteDto;

/**
 * 股票数据缓存服务接口。
 * 提供基于Redis的股票实时数据和K线数据缓存。
 *
 * @author GitHub Copilot
 */
public interface StockCacheService {

    // ==================== 股票追踪 ====================

    /**
     * 缓存股票实时行情数据。
     * 键：stock:track:{symbol}，TTL：10秒
     *
     * @param symbol 股票代码
     * @param quote  行情报价数据
     */
    void cacheStockTrack(String symbol, PriceQuoteDto quote);

    /**
     * 获取缓存的股票实时行情。
     *
     * @param symbol 股票代码
     * @return 缓存的行情报价，如未找到则返回null
     */
    PriceQuoteDto getCachedStockTrack(String symbol);

    /**
     * 获取多只股票缓存的行情。
     *
     * @param symbols 股票代码列表
     * @return 行情报价列表
     */
    List<PriceQuoteDto> getCachedStockTracks(List<String> symbols);

    // ==================== 热门股票 ====================

    /**
     * 缓存热门股票列表。
     * 键：hot:stocks:{type}，TTL：60秒
     *
     * @param type    热门股票类型（volume, gain, loss）
     * @param symbols 股票代码列表
     */
    void cacheHotStocks(String type, List<String> symbols);

    /**
     * 获取缓存的热门股票列表。
     *
     * @param type 热门股票类型（volume, gain, loss）
     * @return 股票代码列表，如未找到则返回null
     */
    List<String> getCachedHotStocks(String type);

    // ==================== 批量操作 ====================

    /**
     * 批量缓存股票行情。
     *
     * @param quotes 行情报价列表
     */
    void cacheBatchStockTracks(List<PriceQuoteDto> quotes);

    /**
     * 检查股票数据是否已缓存。
     *
     * @param symbol 股票代码
     * @return 如果已缓存则返回true
     */
    boolean isStockTrackCached(String symbol);
}
