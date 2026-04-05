package com.koduck.infrastructure.config.properties;

import jakarta.annotation.PostConstruct;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import lombok.extern.slf4j.Slf4j;

/**
 * Configuration properties for Finnhub API integration.
 * <p>
 * This class binds properties prefixed with {@code koduck.finnhub}. It also
 * supports overriding the API key via the {@code FINNHUB_API_KEY} environment
 * variable, and performs validation at initialization.
 * </p>
 *
 * @see <a href="https://finnhub.io/docs/api">Finnhub API Docs</a>
 * @author GitHub Copilot
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.finnhub")
@Slf4j
public class FinnhubProperties {

    /** Environment variable name for Finnhub API key. */
    private static final String ENV_FINNHUB_API_KEY = "FINNHUB_API_KEY";

    /** Default base URL for Finnhub API. */
    private static final String DEFAULT_BASE_URL = "https://finnhub.io/api/v1";

    /** Default HTTP connection timeout in milliseconds. */
    private static final int DEFAULT_CONNECT_TIMEOUT_MS = 10000;

    /** Default HTTP read timeout in milliseconds. */
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

    /**
     * Initialize and validate the Finnhub configuration after construction.
     * <p>
     * The method checks whether an API key is provided via environment variables
     * and logs the runtime configuration. If Finnhub is enabled, it warns when
     * the API key is missing.
     * </p>
     */
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

    /**
     * Gets the Finnhub API key.
     *
     * @return API key, may be empty if not configured
     */
    public String getApiKey() {
        return apiKey;
    }

    /**
     * Sets the Finnhub API key.
     *
     * @param apiKey API key value to set
     */
    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Gets the Finnhub base URL.
     *
     * @return base API URL
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Sets the Finnhub base URL.
     *
     * @param baseUrl base API URL to use
     */
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Gets HTTP connection timeout in milliseconds.
     *
     * @return connect timeout value
     */
    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    /**
     * Sets HTTP connection timeout in milliseconds.
     *
     * @param connectTimeoutMs connect timeout value
     */
    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    /**
     * Gets HTTP read timeout in milliseconds.
     *
     * @return read timeout value
     */
    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    /**
     * Sets HTTP read timeout in milliseconds.
     *
     * @param readTimeoutMs read timeout value
     */
    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }

    /**
     * Returns whether Finnhub integration is enabled.
     *
     * @return true if enabled; false otherwise
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Sets whether Finnhub integration is enabled.
     *
     * @param enabled true to enable; false to disable
     */
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * Check whether Finnhub integration is enabled and has a non-empty API key.
     *
     * @return true when the integration is configured properly; false otherwise
     */
    public boolean isReady() {
        return enabled && StringUtils.hasText(apiKey);
    }
}
