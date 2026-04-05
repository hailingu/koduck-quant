package com.koduck.market.dto;

import java.util.List;

/**
 * 股票行业信息数据传输对象。
 *
 * <p>不可变对象，使用 Java Record 实现。</p>
 *
 * @param symbol      股票代码
 * @param industry    所属行业
 * @param sector      所属板块
 * @param subSectors  子板块列表
 * @param conceptTags 概念标签
 * @author Koduck Team
 */
public record StockIndustryDto(
        String symbol,
        String industry,
        String sector,
        List<String> subSectors,
        List<String> conceptTags
) {
}
