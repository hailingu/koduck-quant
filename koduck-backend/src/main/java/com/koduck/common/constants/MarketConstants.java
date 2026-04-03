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

    private MarketConstants() {
    }
}
