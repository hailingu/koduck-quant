package com.koduck.common.constants;

/**
 * Common HTTP header and token prefix constants.
 *
 * @author GitHub Copilot
 */
public final class HttpHeaderConstants {

    /**
     * HTTP Authorization header name.
     */
    public static final String AUTHORIZATION = "Authorization";

    /**
     * Bearer token prefix.
     */
    public static final String BEARER_PREFIX = "Bearer ";

    /**
     * HTTP User-Agent header name.
     */
    public static final String USER_AGENT = "User-Agent";

    /**
     * X-Forwarded-For header for identifying client IP.
     */
    public static final String X_FORWARDED_FOR = "X-Forwarded-For";

    /**
     * X-Real-IP header for client real IP address.
     */
    public static final String X_REAL_IP = "X-Real-IP";

    /**
     * Proxy-Client-IP header for proxy client identification.
     */
    public static final String PROXY_CLIENT_IP = "Proxy-Client-IP";

    /**
     * WL-Proxy-Client-IP header for WebLogic proxy client identification.
     */
    public static final String WL_PROXY_CLIENT_IP = "WL-Proxy-Client-IP";

    private HttpHeaderConstants() {
    }
}
