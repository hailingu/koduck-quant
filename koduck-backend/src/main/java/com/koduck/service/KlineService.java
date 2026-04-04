package com.koduck.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.market.KlineData;

/**
 * K线数据操作服务接口。
 *
 * @author Koduck Team
 */
public interface KlineService {

    /**
     * 获取指定股票的K线数据。
     * 缓存1分钟。
     *
     * @param market     市场代码
     * @param symbol     股票代码
     * @param timeframe  时间周期（例如 "1d", "1h"）
     * @param limit      最大记录数
     * @param beforeTime 查询该时间戳之前的数据
     * @return K线数据DTO列表
     */
    List<KlineDataDto> getKlineData(String market, String symbol, String timeframe,
                                    Integer limit, Long beforeTime);

    /**
     * 获取指定股票的最新价格。
     * 缓存30秒。
     *
     * @param market    市场代码
     * @param symbol    股票代码
     * @param timeframe 时间周期
     * @return 包含最新价格的Optional
     */
    Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe);

    /**
     * 获取指定股票的前收盘价（昨日收盘价）。
     * 用于计算涨跌幅。
     * 缓存1分钟。
     *
     * @param market    市场代码
     * @param symbol    股票代码
     * @param timeframe 时间周期
     * @return 包含前收盘价的Optional
     */
    Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe);

    /**
     * 获取指定股票的最新K线数据记录。
     *
     * @param market    市场代码
     * @param symbol    股票代码
     * @param timeframe 时间周期
     * @return 包含最新K线数据的Optional
     */
    Optional<KlineData> getLatestKline(String market, String symbol, String timeframe);

    /**
     * 保存K线数据。
     * 保存后清除该股票的缓存。
     *
     * @param dtos      K线数据DTO列表
     * @param market    市场代码
     * @param symbol    股票代码
     * @param timeframe 时间周期
     */
    void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe);

    /**
     * 从周期别名或显式时间周期中规范化时间周期。
     * <p>支持传统的周期别名（daily/weekly/monthly）和显式的时间周期值。</p>
     *
     * @param period    周期别名（daily/weekly/monthly），可能为null
     * @param timeframe 显式时间周期（1D/1W/1M），可能为null
     * @return 规范化后的时间周期
     */
    String normalizeTimeframe(String period, String timeframe);
}
