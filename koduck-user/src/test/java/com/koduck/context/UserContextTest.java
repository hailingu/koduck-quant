package com.koduck.context;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UserContextTest {

    @Test
    void shouldReturnTenantIdFromHeader() {
        HttpServletRequest request = buildRequestWithTenant("tenant-a");

        assertEquals("tenant-a", UserContext.getTenantId(request));
    }

    @Test
    void shouldFallbackToDefaultTenantWhenHeaderMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "1001");

        assertEquals("default", UserContext.getTenantId(request));
    }

    @Test
    void shouldFallbackToJwtClaimsWhenGatewayHeadersMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + buildJwt(
                "{\"sub\":\"1001\",\"tenant_id\":\"tenant-a\",\"username\":\"demo\",\"roles\":[\"ADMIN\",\"TRADER\"]}"
        ));

        assertEquals(1001L, UserContext.getUserId(request));
        assertEquals("tenant-a", UserContext.getTenantId(request));
        assertEquals("demo", UserContext.getUsername(request));
        assertEquals(2, UserContext.getRoles(request).size());
        assertEquals("ADMIN", UserContext.getRoles(request).getFirst());
    }

    private HttpServletRequest buildRequestWithTenant(String tenantId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "1001");
        request.addHeader("X-Tenant-Id", tenantId);
        return request;
    }

    private String buildJwt(String payloadJson) {
        String header = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        return header + "." + payload + ".signature";
    }
}
