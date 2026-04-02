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
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.security")
public class SecurityEndpointProperties {

    private static final List<String> DEFAULT_PERMIT_ALL_PATTERNS = List.of(
            "/api/v1/auth/**",
            "/actuator/health",
            "/api/v1/health/**",
            "/api/v1/monitoring/**",
            "/ws/**",
            "/api/v1/a-share/**"
    );

    private static final List<String> DEFAULT_PERMIT_ALL_GET_PATTERNS = List.of("/api/v1/market/**");

    private List<String> permitAllPatterns = new ArrayList<>(DEFAULT_PERMIT_ALL_PATTERNS);

    private List<String> permitAllGetPatterns = new ArrayList<>(DEFAULT_PERMIT_ALL_GET_PATTERNS);

    public List<String> getPermitAllPatterns() {
        return permitAllPatterns;
    }

    public void setPermitAllPatterns(List<String> permitAllPatterns) {
        this.permitAllPatterns = permitAllPatterns;
    }

    public List<String> getPermitAllGetPatterns() {
        return permitAllGetPatterns;
    }

    public void setPermitAllGetPatterns(List<String> permitAllGetPatterns) {
        this.permitAllGetPatterns = permitAllGetPatterns;
    }
}
