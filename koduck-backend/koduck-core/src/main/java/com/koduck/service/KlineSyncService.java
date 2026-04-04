package com.koduck.service;

import java.util.List;

/**
 * 从Python数据服务同步K线数据的服务。
 *
 * @author GitHub Copilot
 */
public interface KlineSyncService {

    /**
     * 同步热门股票的日K线数据。
     * 在工作日收盘后（15:05）运行。
     */
    void syncDailyKlineData();

    /**
     * 同步指定股票的K线数据。
     *
     * @param market    市场标识
     * @param symbol    股票代码
     * @param timeframe K线时间周期
     */
    void syncSymbolKline(String market, String symbol, String timeframe);

    /**
     * 异步批量同步股票数据，使用固定间隔以避免上游限流。
     *
     * @param market    市场标识
     * @param symbols   要同步的股票代码列表
     * @param timeframe K线时间周期
     */
    void syncBatchSymbols(String market, List<String> symbols, String timeframe);

    /**
     * 请求异步K线同步，带飞行中去重。
     *
     * @param market    市场标识
     * @param symbol    股票代码
     * @param timeframe K线时间周期
     * @return 如果启动新同步任务则返回true；如果跳过或已在运行则返回false
     */
    boolean requestSyncSymbolKline(String market, String symbol, String timeframe);

    /**
     * 回填新股票的历史数据。
     *
     * @param market    市场标识
     * @param symbol    股票代码
     * @param timeframe K线时间周期
     * @param days      要回填的天数
     */
    void backfillHistoricalData(String market, String symbol, String timeframe, int days);
}
