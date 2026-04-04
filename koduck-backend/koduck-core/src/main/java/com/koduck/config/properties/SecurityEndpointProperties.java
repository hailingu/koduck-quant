package com.koduck.config.properties;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Security endpoint authorization properties.
 *
 * <p>Defines endpoint patterns that can bypass authentication. The
 * configuration is externalized under {@code koduck.security} so endpoint
 * maintenance does not require Java code changes.</p>
 *
 * @author GitHub Copilot
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.security")
public class SecurityEndpointProperties {

    /**
     * Default patterns that permit all HTTP methods.
     */
    private static final List<String> DEFAULT_PERMIT_ALL_PATTERNS = List.of(
            "/api/v1/auth/**",
            "/actuator/health",
            "/api/v1/health/**",
            "/api/v1/monitoring/**",
            "/ws/**",
            "/api/v1/a-share/**"
    );

    /**
     * Default patterns that permit only GET requests.
     */
    private static final List<String> DEFAULT_PERMIT_ALL_GET_PATTERNS = List.of("/api/v1/market/**");

    /**
     * Patterns that permit all HTTP methods without authentication.
     */
    private List<String> permitAllPatterns = new ArrayList<>(DEFAULT_PERMIT_ALL_PATTERNS);

    /**
     * Patterns that permit only GET requests without authentication.
     */
    private List<String> permitAllGetPatterns = new ArrayList<>(DEFAULT_PERMIT_ALL_GET_PATTERNS);

    /**
     * Gets permit all patterns.
     *
     * @return defensive copy of permit all patterns
     */
    public List<String> getPermitAllPatterns() {
        return new ArrayList<>(permitAllPatterns);
    }

    /**
     * Sets permit all patterns.
     *
     * @param permitAllPatterns patterns to set
     */
    public void setPermitAllPatterns(List<String> permitAllPatterns) {
        this.permitAllPatterns = permitAllPatterns != null
            ? new ArrayList<>(permitAllPatterns)
            : new ArrayList<>(DEFAULT_PERMIT_ALL_PATTERNS);
    }

    /**
     * Gets permit all GET patterns.
     *
     * @return defensive copy of permit all GET patterns
     */
    public List<String> getPermitAllGetPatterns() {
        return new ArrayList<>(permitAllGetPatterns);
    }

    /**
     * Sets permit all GET patterns.
     *
     * @param permitAllGetPatterns patterns to set
     */
    public void setPermitAllGetPatterns(List<String> permitAllGetPatterns) {
        this.permitAllGetPatterns = permitAllGetPatterns != null
            ? new ArrayList<>(permitAllGetPatterns)
            : new ArrayList<>(DEFAULT_PERMIT_ALL_GET_PATTERNS);
    }
}
