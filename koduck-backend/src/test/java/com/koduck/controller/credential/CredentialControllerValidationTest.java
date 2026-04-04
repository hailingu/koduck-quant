package com.koduck.controller.credential;
import com.koduck.controller.credential.CredentialController;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.koduck.controller.support.AuthenticatedUserResolver;
import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialListResponse;
import com.koduck.entity.auth.User;
import com.koduck.security.JwtAuthenticationFilter;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CredentialService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * MockMvc validation tests for {@link CredentialController} pagination parameters.
 *
 * <p>These tests verify boundary validation at HTTP layer and ensure invalid
 * requests are rejected with 400 before service execution.</p>
 *
 * @author GitHub Copilot
 */
@WebMvcTest(controllers = CredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class CredentialControllerValidationTest {

    /** Default page size for tests. */
    private static final int DEFAULT_PAGE_SIZE = 20;

    /** Test user ID. */
    private static final Long USER_ID = 1001L;

    /** MockMvc for HTTP request testing. */
    private final MockMvc mockMvc;

    /** Mock service for credentials. */
    @MockitoBean
    private CredentialService credentialService;

    /** Mock filter for JWT authentication. */
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    /** Mock resolver for authenticated user. */
    @MockitoBean
    private AuthenticatedUserResolver authenticatedUserResolver;

    /**
     * Constructs test with MockMvc.
     *
     * @param mockMvc the mock MVC
     */
    CredentialControllerValidationTest(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenPageIsNegativeForCredentials")
    void shouldReturnBadRequestWhenPageIsNegativeForCredentials() throws Exception {
        mockMvc.perform(get("/api/v1/credentials")
                        .param("page", "-1")
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(credentialService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenSizeIsOutOfRangeForCredentials")
    void shouldReturnBadRequestWhenSizeIsOutOfRangeForCredentials() throws Exception {
        mockMvc.perform(get("/api/v1/credentials")
                        .param("page", "0")
                        .param("size", "101"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(credentialService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenPageIsNegativeForAuditLogs")
    void shouldReturnBadRequestWhenPageIsNegativeForAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/credentials/audit-logs")
                        .param("page", "-1")
                        .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(credentialService);
    }

    @Test
    @DisplayName("shouldReturnBadRequestWhenSizeIsOutOfRangeForAuditLogs")
    void shouldReturnBadRequestWhenSizeIsOutOfRangeForAuditLogs() throws Exception {
        mockMvc.perform(get("/api/v1/credentials/audit-logs")
                        .param("page", "0")
                        .param("size", "101"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(credentialService);
    }

    @Test
    @DisplayName("shouldReturnOkWhenPagingParamsAreValidForCredentials")
    void shouldReturnOkWhenPagingParamsAreValidForCredentials() throws Exception {
        CredentialListResponse listResponse = CredentialListResponse.builder()
                .items(List.of())
                .total(0L)
                .page(0)
                .size(DEFAULT_PAGE_SIZE)
                .build();
        when(authenticatedUserResolver.requireUserId(any())).thenReturn(USER_ID);
        when(credentialService.getCredentials(USER_ID, 0, DEFAULT_PAGE_SIZE))
            .thenReturn(listResponse);

        SecurityContextHolder.getContext().setAuthentication(buildAuthentication(USER_ID));
        try {
            mockMvc.perform(get("/api/v1/credentials")
                            .param("page", "0")
                            .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(0));
        }
        finally {
            SecurityContextHolder.clearContext();
        }

        verify(credentialService).getCredentials(USER_ID, 0, DEFAULT_PAGE_SIZE);
    }

    @Test
    @DisplayName("shouldReturnOkWhenPagingParamsAreValidForAuditLogs")
    void shouldReturnOkWhenPagingParamsAreValidForAuditLogs() throws Exception {
        when(authenticatedUserResolver.requireUserId(any())).thenReturn(USER_ID);
        when(credentialService.getAuditLogs(USER_ID, 0, DEFAULT_PAGE_SIZE))
            .thenReturn(List.<CredentialAuditLogResponse>of());

        SecurityContextHolder.getContext().setAuthentication(buildAuthentication(USER_ID));
        try {
            mockMvc.perform(get("/api/v1/credentials/audit-logs")
                            .param("page", "0")
                            .param("size", String.valueOf(DEFAULT_PAGE_SIZE)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(0));
        }
        finally {
            SecurityContextHolder.clearContext();
        }

        verify(credentialService).getAuditLogs(USER_ID, 0, DEFAULT_PAGE_SIZE);
    }

    private Authentication buildAuthentication(Long userId) {
        User user = User.builder()
                .id(userId)
                .email("user@example.com")
                .username("user")
                .passwordHash("hash")
                .nickname("user")
                .status(User.UserStatus.ACTIVE)
                .build();
        UserPrincipal principal = new UserPrincipal(
                user,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        return new UsernamePasswordAuthenticationToken(
            principal, null, principal.getAuthorities());
    }
}
