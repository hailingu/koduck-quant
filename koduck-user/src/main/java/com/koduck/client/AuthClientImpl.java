package com.koduck.client;

import com.koduck.client.dto.TokenIntrospectionResponse;
import com.koduck.client.dto.TokenRevocationRequest;
import com.koduck.client.exception.AuthClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * AuthClient 实现。
 *
 * <p>通过 APISIX 网关调用 koduck-auth 内部 API，携带 apikey 进行 key-auth 认证。
 * 401/403 不重试并记录安全审计日志；5xx/网络错误有限重试。</p>
 */
@Component
@ConditionalOnProperty(prefix = "auth.introspection", name = "enabled", havingValue = "true")
public class AuthClientImpl implements AuthClient {

    private static final Logger log = LoggerFactory.getLogger(AuthClientImpl.class);
    private static final String INTROSPECT_PATH = "/internal/tokens/validate";
    private static final String REVOKE_PATH = "/internal/tokens/revoke";

    private final RestTemplate restTemplate;
    private final AuthClientProperties properties;

    public AuthClientImpl(RestTemplate authRestTemplate, AuthClientProperties properties) {
        this.restTemplate = authRestTemplate;
        this.properties = properties;
    }

    @Override
    public TokenIntrospectionResponse introspectToken(String token) {
        validateApiKey();
        HttpHeaders headers = buildAuthHeaders();

        Map<String, String> body = Map.of("token", token);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        return executeWithRetry(INTROSPECT_PATH, HttpMethod.POST, entity,
                TokenIntrospectionResponse.class, "introspectToken");
    }

    @Override
    public void revokeTokens(TokenRevocationRequest request) {
        validateApiKey();
        HttpHeaders headers = buildAuthHeaders();

        HttpEntity<TokenRevocationRequest> entity = new HttpEntity<>(request, headers);

        executeWithRetry(REVOKE_PATH, HttpMethod.POST, entity, Void.class, "revokeTokens");
    }

    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", properties.getApiKey());
        return headers;
    }

    private void validateApiKey() {
        if (properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            String msg = "AuthClient apikey 未配置，无法调用 koduck-auth";
            logSecurity(msg);
            throw new AuthClientException(msg);
        }
    }

    private <T> T executeWithRetry(String path, HttpMethod method, HttpEntity<?> entity,
                                    Class<T> responseType, String operation) {
        String url = properties.getBaseUrl() + path;
        int maxAttempts = properties.getRetry().getMaxAttempts();
        long backoff = properties.getRetry().getBackoffMillis();
        AuthClientException lastException = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ResponseEntity<T> response = restTemplate.exchange(url, method, entity, responseType);
                return response.getBody();
            } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
                // 401/403: 认证失败，不重试，记录安全审计日志
                String msg = String.format("AuthClient %s 认证失败: %d %s - %s",
                        operation, e.getStatusCode().value(), e.getStatusCode(), e.getResponseBodyAsString());
                logSecurity(msg);
                throw new AuthClientException(msg, e);
            } catch (HttpClientErrorException e) {
                // 其他 4xx: 不重试
                log.warn("AuthClient {} 客户端错误: {} - {}", operation, e.getStatusCode(), e.getResponseBodyAsString());
                throw new AuthClientException("AuthClient " + operation + " 客户端错误: " + e.getStatusCode(), e);
            } catch (HttpServerErrorException e) {
                lastException = new AuthClientException("AuthClient " + operation + " 服务端错误: " + e.getStatusCode(), e);
                log.warn("AuthClient {} 服务端错误 (attempt {}/{}): {}",
                        operation, attempt, maxAttempts, e.getStatusCode());
                if (attempt < maxAttempts) {
                    sleep(backoff * attempt);
                }
            } catch (ResourceAccessException e) {
                lastException = new AuthClientException("AuthClient " + operation + " 网络错误: " + e.getMessage(), e);
                log.warn("AuthClient {} 网络错误 (attempt {}/{}): {}",
                        operation, attempt, maxAttempts, e.getMessage());
                if (attempt < maxAttempts) {
                    sleep(backoff * attempt);
                }
            }
        }

        throw lastException;
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AuthClientException("AuthClient 重试等待被中断", e);
        }
    }

    private void logSecurity(String message) {
        log.warn("[SECURITY-AUDIT] {}", message);
    }
}
