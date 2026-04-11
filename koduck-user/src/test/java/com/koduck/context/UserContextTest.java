package com.koduck.context;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

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

    private HttpServletRequest buildRequestWithTenant(String tenantId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "1001");
        request.addHeader("X-Tenant-Id", tenantId);
        return request;
    }
}
