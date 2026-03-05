package com.koduck.controller;

import com.koduck.dto.credential.CredentialAuditLogResponse;
import com.koduck.dto.credential.CredentialListResponse;
import com.koduck.entity.User;
import com.koduck.security.JwtAuthenticationFilter;
import com.koduck.security.UserPrincipal;
import com.koduck.service.CredentialService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

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
 * @date 2026-03-05
 */
@WebMvcTest(controllers = CredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class CredentialControllerValidationTest {

    private static final Long USER_ID = 1001L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CredentialService credentialService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Test
    @DisplayName("shouldReturnBadRequestWhenPageIsNegativeForCredentials")
    void shouldReturnBadRequestWhenPageIsNegativeForCredentials() throws Exception {
        mockMvc.perform(get("/api/v1/credentials")
                        .param("page", "-1")
                        .param("size", "20"))
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
                        .param("size", "20"))
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
                .size(20)
                .build();
        when(credentialService.getCredentials(USER_ID, 0, 20)).thenReturn(listResponse);

                SecurityContextHolder.getContext().setAuthentication(buildAuthentication(USER_ID));
                try {
                        mockMvc.perform(get("/api/v1/credentials")
                                                        .param("page", "0")
                                                        .param("size", "20"))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.code").value(0));
                } finally {
                        SecurityContextHolder.clearContext();
                }

        verify(credentialService).getCredentials(USER_ID, 0, 20);
    }

    @Test
    @DisplayName("shouldReturnOkWhenPagingParamsAreValidForAuditLogs")
    void shouldReturnOkWhenPagingParamsAreValidForAuditLogs() throws Exception {
        when(credentialService.getAuditLogs(USER_ID, 0, 20)).thenReturn(List.<CredentialAuditLogResponse>of());

                SecurityContextHolder.getContext().setAuthentication(buildAuthentication(USER_ID));
                try {
                        mockMvc.perform(get("/api/v1/credentials/audit-logs")
                                                        .param("page", "0")
                                                        .param("size", "20"))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.code").value(0));
                } finally {
                        SecurityContextHolder.clearContext();
                }

        verify(credentialService).getAuditLogs(USER_ID, 0, 20);
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
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
