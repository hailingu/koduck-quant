package com.koduck.common.constants;

import java.time.ZoneId;

/**
 * Common date-time pattern constants used across backend modules.
 *
 * @author GitHub Copilot
 */
public final class DateTimePatternConstants {

    /**
     * Standard date-time pattern.
     */
    public static final String STANDARD_DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    /**
     * Market time zone (Asia/Shanghai).
     */
    public static final ZoneId MARKET_ZONE_ID = ZoneId.of("Asia/Shanghai");

    /**
     * Market time zone string identifier.
     */
    public static final String TIMEZONE_ASIA_SHANGHAI = "Asia/Shanghai";

    private DateTimePatternConstants() {
    }
}
