package com.koduck.service;

import java.util.List;
import java.util.Set;

import com.koduck.market.dto.TickDto;
import com.koduck.market.entity.StockRealtime;

/**
 * 合成Tick服务接口。
 * 提供股票实时数据追踪和合成Tick生成功能。
 *
 * @author GitHub Copilot
 */
public interface SyntheticTickService {

    /**
     * 追踪指定股票代码。
     *
     * @param symbol 股票代码
     */
    void trackSymbol(String symbol);

    /**
     * 获取当前追踪的股票代码快照。
     *
     * @return 追踪的股票代码集合
     */
    Set<String> snapshotTrackedSymbols();

    /**
     * 从实时数据追加合成Tick。
     *
     * @param realtime 实时股票数据
     * @return Tick数据传输对象
     */
    TickDto appendSyntheticTickFromRealtime(StockRealtime realtime);

    /**
     * 获取指定股票的最新Tick数据。
     *
     * @param symbol 股票代码
     * @param limit  返回记录数限制
     * @return Tick数据传输对象列表
     */
    List<TickDto> getLatestTicks(String symbol, int limit);
}
