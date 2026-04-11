package com.koduck.client;

import com.koduck.client.dto.TokenIntrospectionResponse;
import com.koduck.client.dto.TokenRevocationRequest;
import com.koduck.client.exception.AuthClientException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthClientTest {

    private RestTemplate restTemplate;
    private AuthClientProperties properties;
    private AuthClientImpl authClient;

    @BeforeEach
    void setUp() {
        restTemplate = mock(RestTemplate.class);
        properties = new AuthClientProperties();
        properties.setBaseUrl("http://apisix:9080");
        properties.setApiKey("uk_test_key_12345678");
        properties.getRetry().setMaxAttempts(2);
        properties.getRetry().setBackoffMillis(100);
        authClient = new AuthClientImpl(restTemplate, properties);
    }

    // === Feature toggle: NoOp ===

    @Test
    void noOpShouldRejectIntrospection() {
        AuthClientNoOp noOp = new AuthClientNoOp();
        assertThrows(AuthClientException.class,
                () -> noOp.introspectToken("some-token"));
    }

    @Test
    void noOpShouldRejectRevocation() {
        AuthClientNoOp noOp = new AuthClientNoOp();
        assertThrows(AuthClientException.class,
                () -> noOp.revokeTokens(TokenRevocationRequest.builder().userId(1L).build()));
    }

    // === apikey validation ===

    @Test
    void shouldThrowWhenApiKeyMissing() {
        properties.setApiKey("");
        assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("some-token"));
    }

    @Test
    void shouldThrowWhenApiKeyBlank() {
        properties.setApiKey("   ");
        assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("some-token"));
    }

    // === Successful introspection ===

    @Test
    void shouldIntrospectTokenSuccessfully() {
        TokenIntrospectionResponse expected = TokenIntrospectionResponse.builder()
                .valid(true)
                .userId(1001L)
                .username("demo")
                .tenantId("default")
                .roles(List.of("ROLE_USER"))
                .expiresAt(Instant.now().plusSeconds(900))
                .build();

        when(restTemplate.exchange(
                eq("http://apisix:9080/internal/tokens/validate"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(TokenIntrospectionResponse.class)))
                .thenReturn(ResponseEntity.ok(expected));

        TokenIntrospectionResponse result = authClient.introspectToken("valid-token");

        assertTrue(result.isValid());
        assertEquals(1001L, result.getUserId());
        assertEquals("demo", result.getUsername());
        assertEquals("default", result.getTenantId());

        // Verify apikey header was set
        @SuppressWarnings("unchecked")
        HttpEntity<Map<String, String>> captured = captureHttpEntity();
        assertEquals("uk_test_key_12345678", captured.getHeaders().getFirst("apikey"));
    }

    // === Successful revocation ===

    @Test
    void shouldRevokeTokensSuccessfully() {
        when(restTemplate.exchange(
                eq("http://apisix:9080/internal/tokens/revoke"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Void.class)))
                .thenReturn(ResponseEntity.ok().build());

        assertDoesNotThrow(() -> authClient.revokeTokens(
                TokenRevocationRequest.builder().userId(1001L).reason("password-changed").build()));
    }

    // === 401: no retry, security log ===

    @Test
    void shouldNotRetryOn401() {
        HttpClientErrorException ex = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED, "Unauthorized",
                HttpHeaders.EMPTY, "{\"error\":\"invalid key\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), any(), any(), any(Class.class)))
                .thenThrow(ex);

        AuthClientException thrown = assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("token"));

        assertTrue(thrown.getMessage().contains("认证失败"));
        assertTrue(thrown.getMessage().contains("401"));

        // Verify only one call (no retry)
        verify(restTemplate, times(1)).exchange(anyString(), any(), any(), any(Class.class));
    }

    // === 403: no retry, security log ===

    @Test
    void shouldNotRetryOn403() {
        HttpClientErrorException ex = HttpClientErrorException.create(
                HttpStatus.FORBIDDEN, "Forbidden",
                HttpHeaders.EMPTY, "{\"error\":\"access denied\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), any(), any(), any(Class.class)))
                .thenThrow(ex);

        AuthClientException thrown = assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("token"));

        assertTrue(thrown.getMessage().contains("认证失败"));
        assertTrue(thrown.getMessage().contains("403"));

        verify(restTemplate, times(1)).exchange(anyString(), any(), any(), any(Class.class));
    }

    // === 400: no retry (other 4xx) ===

    @Test
    void shouldNotRetryOn400() {
        HttpClientErrorException ex = HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST, "Bad Request",
                HttpHeaders.EMPTY, "{\"error\":\"invalid token\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), any(), any(), any(Class.class)))
                .thenThrow(ex);

        AuthClientException thrown = assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("token"));

        assertTrue(thrown.getMessage().contains("客户端错误"));
        verify(restTemplate, times(1)).exchange(anyString(), any(), any(), any(Class.class));
    }

    // === 5xx: retry with backoff ===

    @Test
    void shouldRetryOn5xx() {
        HttpServerErrorException ex = HttpServerErrorException.create(
                HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                HttpHeaders.EMPTY, "{\"error\":\"upstream failure\"}".getBytes(), null);

        when(restTemplate.exchange(anyString(), any(), any(), any(Class.class)))
                .thenThrow(ex);

        AuthClientException thrown = assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("token"));

        assertTrue(thrown.getMessage().contains("服务端错误"));
        // maxAttempts=2, so should be called twice
        verify(restTemplate, times(2)).exchange(anyString(), any(), any(), any(Class.class));
    }

    // === Network error: retry with backoff ===

    @Test
    void shouldRetryOnNetworkError() {
        ResourceAccessException ex = new ResourceAccessException("Connection refused");

        when(restTemplate.exchange(anyString(), any(), any(), any(Class.class)))
                .thenThrow(ex);

        AuthClientException thrown = assertThrows(AuthClientException.class,
                () -> authClient.introspectToken("token"));

        assertTrue(thrown.getMessage().contains("网络错误"));
        verify(restTemplate, times(2)).exchange(anyString(), any(), any(), any(Class.class));
    }

    // === APISIX routing (not direct auth connection) ===

    @Test
    void shouldCallViaApisixBaseUrl() {
        properties.setBaseUrl("http://apisix-gateway:9080");

        when(restTemplate.exchange(
                eq("http://apisix-gateway:9080/internal/tokens/validate"),
                any(), any(), eq(TokenIntrospectionResponse.class)))
                .thenReturn(ResponseEntity.ok(TokenIntrospectionResponse.builder().valid(true).build()));

        authClient.introspectToken("token");

        // Verify URL goes through APISIX, not directly to koduck-auth
        verify(restTemplate).exchange(
                eq("http://apisix-gateway:9080/internal/tokens/validate"),
                any(), any(), any(Class.class));
    }

    @SuppressWarnings("unchecked")
    private HttpEntity<Map<String, String>> captureHttpEntity() {
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<HttpEntity> captor = org.mockito.ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(anyString(), any(HttpMethod.class), captor.capture(), any(Class.class));
        return (HttpEntity<Map<String, String>>) captor.getValue();
    }
}
