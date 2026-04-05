package com.koduck.service;

import com.koduck.market.dto.MarketSentimentDto;
import com.koduck.market.MarketType;

/**
 * 市场情绪分析服务接口。
 * 计算用于市场分析的六维情绪指标。
 *
 * @author GitHub Copilot
 */
public interface MarketSentimentService {

    /**
     * 获取综合市场情绪分析。
     *
     * @param marketType 市场类型（A_SHARE, HK, US）
     * @return 包含六个维度的MarketSentimentDto
     */
    MarketSentimentDto getMarketSentiment(MarketType marketType);
}
