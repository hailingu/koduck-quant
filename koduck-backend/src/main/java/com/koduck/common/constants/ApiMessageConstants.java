package com.koduck.common.constants;

/**
 * Shared API message constants for frequently repeated response texts.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class ApiMessageConstants {

    public static final String NO_PRICE_DATA_FOUND = "No price data found";
    public static final String DATA_SERVICE_DISABLED = "数据服务未启用";
    public static final String INVALID_DATE_RANGE = "参数错误: to 不能早于 from";
    public static final String FEAR_GREED_FETCH_FAILED = "获取恐惧贪婪指数失败";
    public static final String BREADTH_FETCH_FAILED = "获取市场宽度失败";
    public static final String STOCK_NOT_FOUND_PREFIX = "股票代码不存在: ";
    public static final String STOCK_STATS_NOT_FOUND_PREFIX = "股票统计信息不存在: ";
    public static final String STOCK_VALUATION_NOT_FOUND_PREFIX = "股票估值不存在: ";
    public static final String STOCK_INDUSTRY_NOT_FOUND_PREFIX = "股票行业信息不存在: ";
    public static final String MARKET_NET_FLOW_NOT_FOUND = "未找到市场净流入数据";
    public static final String MARKET_BREADTH_NOT_FOUND = "未找到市场涨跌宽度数据";
    public static final String SECTOR_NET_FLOW_NOT_FOUND = "未找到板块净流向数据";
    public static final String CAPITAL_RIVER_NOT_FOUND = "未找到资金河流图数据";

    private ApiMessageConstants() {
    }
}
