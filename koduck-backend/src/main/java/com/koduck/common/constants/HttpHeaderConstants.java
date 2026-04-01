package com.koduck.common.constants;

/**
 * Common HTTP header and token prefix constants.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public final class HttpHeaderConstants {

    public static final String AUTHORIZATION = "Authorization";
    public static final String BEARER_PREFIX = "Bearer ";
    public static final String USER_AGENT = "User-Agent";
    public static final String X_FORWARDED_FOR = "X-Forwarded-For";
    public static final String X_REAL_IP = "X-Real-IP";
    public static final String PROXY_CLIENT_IP = "Proxy-Client-IP";
    public static final String WL_PROXY_CLIENT_IP = "WL-Proxy-Client-IP";

    private HttpHeaderConstants() {
    }
}
