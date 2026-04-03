package com.koduck.common.constants;

/**
 * Shared market and timeframe constants.
 *
 * @author Koduck Team
 */
public final class MarketConstants {

    /** Default market identifier (A-Share). */
    public static final String DEFAULT_MARKET = "AShare";

    /** Default timeframe (1 day). */
    public static final String DEFAULT_TIMEFRAME = "1D";

    /** Weekly timeframe identifier. */
    public static final String WEEKLY_TIMEFRAME = "1W";

    /** Monthly timeframe identifier. */
    public static final String MONTHLY_TIMEFRAME = "1M";

    /** Default market code for data queries. */
    public static final String DEFAULT_MARKET_CODE = "a_share";

    /** Default technical indicator type. */
    public static final String DEFAULT_INDICATOR = "TODAY";

    /** Default capital flow type (main force). */
    public static final String DEFAULT_FLOW_TYPE = "MAIN_FORCE";

    /** Default market breadth type (all A-shares). */
    public static final String DEFAULT_BREADTH_TYPE = "ALL_A";

    /** Stock type identifier. */
    public static final String STOCK_TYPE = "STOCK";

    /** A-Share index symbol (上证指数). */
    public static final String A_SHARE_INDEX_SYMBOL = "000001";

    /** All supported timeframe values (immutable). */
    private static final String[] ALL_TIMEFRAMES = {
        "1m", "5m", "15m", "30m", "60m", "1D", "1W", "1M"
    };

    /** Immutable list of all supported timeframes. */
    public static final java.util.List<String> ALL_TIMEFRAMES_LIST = java.util.List.of(ALL_TIMEFRAMES);

    private MarketConstants() {
    }
}
