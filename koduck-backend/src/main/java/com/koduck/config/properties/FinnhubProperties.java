package com.koduck.config.properties;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * Configuration properties for Finnhub API.
 * Used for US stock market data.
 * 
 * @see <a href="https://finnhub.io/docs/api">Finnhub API Docs</a>
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.finnhub")
@Slf4j
public class FinnhubProperties {

    private static final String ENV_FINNHUB_API_KEY = "FINNHUB_API_KEY";
    private static final String DEFAULT_BASE_URL = "https://finnhub.io/api/v1";
    private static final int DEFAULT_CONNECT_TIMEOUT_MS = 10000;
    private static final int DEFAULT_READ_TIMEOUT_MS = 30000;

    /**
     * Finnhub API key (required)
     * Get free API key from: https://finnhub.io/register
     */
    private String apiKey = "";

    /**
     * Base URL for Finnhub API
     */
    private String baseUrl = DEFAULT_BASE_URL;

    /**
     * HTTP connection timeout in milliseconds
     */
    private int connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;

    /**
     * HTTP read timeout in milliseconds
     */
    private int readTimeoutMs = DEFAULT_READ_TIMEOUT_MS;

    /**
     * Enable/disable Finnhub integration
     */
    private boolean enabled = false;

    @PostConstruct
    public void init() {
        // Prefer reading API key from environment variable
        String envApiKey = System.getenv(ENV_FINNHUB_API_KEY);
        if (StringUtils.hasText(envApiKey)) {
            this.apiKey = envApiKey;
        }
        
        log.info("[FinnhubProperties] enabled={}, baseUrl={}, hasApiKey={}", 
                enabled, baseUrl, StringUtils.hasText(apiKey));
        
        if (enabled && !StringUtils.hasText(apiKey)) {
            log.warn("[FinnhubProperties] Finnhub is enabled but API key is not set! " +
                    "Set FINNHUB_API_KEY environment variable or koduck.finnhub.api-key property.");
        }
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
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

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
    
    /**
     * Check if Finnhub is properly configured and ready to use
     */
    public boolean isReady() {
        return enabled && StringUtils.hasText(apiKey);
    }
}
