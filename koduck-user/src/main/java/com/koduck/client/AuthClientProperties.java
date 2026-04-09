package com.koduck.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AuthClient 配置属性。
 *
 * <p>绑定 {@code auth.*} 前缀的配置项。</p>
 */
@ConfigurationProperties(prefix = "auth")
public class AuthClientProperties {

    private String baseUrl = "http://apisix:9080";
    private String apiKey = "";
    private int connectTimeout = 3000;
    private int readTimeout = 5000;
    private Retry retry = new Retry();
    private Introspection introspection = new Introspection();

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public int getConnectTimeout() {
        return connectTimeout;
    }

    public void setConnectTimeout(int connectTimeout) {
        this.connectTimeout = connectTimeout;
    }

    public int getReadTimeout() {
        return readTimeout;
    }

    public void setReadTimeout(int readTimeout) {
        this.readTimeout = readTimeout;
    }

    public Retry getRetry() {
        return retry;
    }

    public void setRetry(Retry retry) {
        this.retry = retry;
    }

    public Introspection getIntrospection() {
        return introspection;
    }

    public void setIntrospection(Introspection introspection) {
        this.introspection = introspection;
    }

    public static class Retry {
        private int maxAttempts = 2;
        private long backoffMillis = 500;

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public long getBackoffMillis() {
            return backoffMillis;
        }

        public void setBackoffMillis(long backoffMillis) {
            this.backoffMillis = backoffMillis;
        }
    }

    public static class Introspection {
        private boolean enabled = false;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }
    }
}
