package com.koduck.config.properties;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for the external data service used by the
 * backend. Values are populated from application configuration with prefix
 * {@code koduck.data-service} and may be overridden by environment variables.
 *
 * <p>Includes timeouts, retry settings and base URL for HTTP calls.</p>
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.data-service")
@Slf4j
public class DataServiceProperties {
    
    private String baseUrl = "http://localhost:8000/api/v1";
    private int connectTimeoutMs = 10000;  // 10s connection timeout
    private int readTimeoutMs = 60000;     // 60s read timeout (for AKShare API calls)
    private int maxRetries = 3;
    private boolean enabled = true;
    
    /**
     * Post-construction hook that allows environment variables to override the
     * default base URL. Logs the effective configuration for visibility.
     */
    @PostConstruct
    public void init() {
        // Prefer reading from environment variable
        String envUrl = System.getenv("DATA_SERVICE_URL");
        if (envUrl != null && !envUrl.isEmpty()) {
            this.baseUrl = envUrl;
        }
        log.info("[DataServiceProperties] baseUrl={}, enabled={}", baseUrl, enabled);
    }
    
    public String getBaseUrl() {
        return baseUrl;
    }
    
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }
    
    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }
    
    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }
    
    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
    
    public int getMaxRetries() {
        return maxRetries;
    }
    
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }
    
    public boolean isEnabled() {
        return enabled;
    }
    
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
