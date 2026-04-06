package com.koduck.infrastructure.config.properties;

import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;

import lombok.extern.slf4j.Slf4j;

/**
 * Configuration properties for the external data service used by the
 * backend. Values are populated from application configuration with prefix
 * {@code koduck.data-service} and may be overridden by environment variables.
 *
 * <p>Includes timeouts, retry settings and base URL for HTTP calls.</p>
 *
 * @author GitHub Copilot
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.data-service")
@Validated
@Slf4j
public class DataServiceProperties {

    /**
     * Environment variable name for data service URL.
     */
    private static final String ENV_DATA_SERVICE_URL = "DATA_SERVICE_URL";

    /**
     * Default base URL for data service.
     */
    private static final String DEFAULT_BASE_URL = "http://localhost:8000/api/v1";

    /**
     * Default connection timeout in milliseconds.
     */
    private static final int DEFAULT_CONNECT_TIMEOUT_MS = 10000;

    /**
     * Default read timeout in milliseconds.
     */
    private static final int DEFAULT_READ_TIMEOUT_MS = 60000;

    /**
     * Default maximum number of retries.
     */
    private static final int DEFAULT_MAX_RETRIES = 3;

    /**
     * Default realtime update path.
     */
    private static final String DEFAULT_REALTIME_UPDATE_PATH = "/market/realtime/update";

    /**
     * Base URL for the external data service.
     */
    @NotBlank
    private String baseUrl = DEFAULT_BASE_URL;

    /**
     * HTTP connection timeout in milliseconds.
     */
    @Min(1)
    private int connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;

    /**
     * HTTP read timeout in milliseconds.
     */
    @Min(1)
    private int readTimeoutMs = DEFAULT_READ_TIMEOUT_MS;

    /**
     * Maximum retry attempts for downstream data service calls.
     */
    @Min(0)
    private int maxRetries = DEFAULT_MAX_RETRIES;

    /**
     * Path used by the data service to trigger realtime updates.
     */
    @NotBlank
    private String realtimeUpdatePath = DEFAULT_REALTIME_UPDATE_PATH;

    /**
     * Flag to enable or disable data service integration.
     */
    private boolean enabled = true;

    /**
     * Post-construction hook that allows environment variables to override the
     * default base URL. Logs the effective configuration for visibility.
     */
    @PostConstruct
    public void init() {
        // Prefer reading from environment variable
        String envUrl = System.getenv(ENV_DATA_SERVICE_URL);
        if (StringUtils.hasText(envUrl)) {
            this.baseUrl = envUrl;
        }
        log.info("[DataServiceProperties] baseUrl={}, enabled={}", baseUrl, enabled);
    }

    /**
     * Gets the base URL for the external data service.
     *
     * @return configured base URL, never blank after validation
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Sets the base URL for the external data service.
     *
     * @param baseUrl base URL value
     */
    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Gets the HTTP connection timeout in milliseconds.
     *
     * @return connection timeout in milliseconds
     */
    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    /**
     * Sets the HTTP connection timeout in milliseconds.
     *
     * @param connectTimeoutMs timeout value in milliseconds
     */
    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    /**
     * Gets the HTTP read timeout in milliseconds.
     *
     * @return read timeout in milliseconds
     */
    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    /**
     * Sets the HTTP read timeout in milliseconds.
     *
     * @param readTimeoutMs timeout value in milliseconds
     */
    public void setReadTimeoutMs(int readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }

    /**
     * Gets maximum retry attempts for downstream data service calls.
     *
     * @return maximum retry count
     */
    public int getMaxRetries() {
        return maxRetries;
    }

    /**
     * Sets maximum retry attempts for downstream data service calls.
     *
     * @param maxRetries retry count
     */
    public void setMaxRetries(int maxRetries) {
        this.maxRetries = maxRetries;
    }

    /**
     * Checks whether data service integration is enabled.
     *
     * @return true if enabled; otherwise false
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Enables or disables data service integration.
     *
     * @param enabled true to enable integration; false to disable
     */
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * Gets the path used by the data service to trigger realtime updates.
     *
     * @return realtime update path
     */
    public String getRealtimeUpdatePath() {
        return realtimeUpdatePath;
    }

    /**
     * Sets the path used by the data service to trigger realtime updates.
     *
     * @param realtimeUpdatePath realtime update path
     */
    public void setRealtimeUpdatePath(String realtimeUpdatePath) {
        this.realtimeUpdatePath = realtimeUpdatePath;
    }
}
