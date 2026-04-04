package com.koduck.service;

import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;

/**
 * 技术指标计算服务接口。
 *
 * @author koduck
 */
public interface TechnicalIndicatorService {

    /**
     * 获取可用指标。
     *
     * @return 可用技术指标列表
     */
    IndicatorListResponse getAvailableIndicators();

    /**
     * 计算指定股票的技术指标。
     *
     * @param market    市场标识
     * @param symbol    股票代码
     * @param indicator 指标名称
     * @param period    计算周期
     * @return 计算后的指标响应
     */
    IndicatorResponse calculateIndicator(
            String market, String symbol, String indicator, Integer period);
}
