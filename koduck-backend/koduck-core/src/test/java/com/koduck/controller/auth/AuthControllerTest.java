package com.koduck.controller.auth;

import jakarta.servlet.http.HttpServletRequest;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RefreshTokenRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.dto.auth.SecurityConfigResponse;
import com.koduck.dto.UserInfo;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.service.AuthService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthController}.
 *
 * @author GitHub Copilot
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    /** The authService. */
    @Mock
    private AuthService authService;

    /** The httpServletRequest. */
    @Mock
    private HttpServletRequest httpServletRequest;

    /** The authController. */
    @InjectMocks
    private AuthController authController;

    /**
     * Verifies login delegates to service and resolves client IP from
     * X-Forwarded-For header.
     */
    @Test
    @DisplayName("shouldLoginWhenRequestIsValid")
    void shouldLoginWhenRequestIsValid() {
        LoginRequest request = new LoginRequest();
        request.setUsername("demo");
        request.setPassword("password123");

        TokenResponse<UserInfo> tokenResponse = TokenResponse.<UserInfo>builder()
                .accessToken("access-token")
                .refreshToken("refresh-token")
                .build();

        when(httpServletRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        when(httpServletRequest.getHeader("X-Forwarded-For")).thenReturn("10.0.0.1, 10.0.0.2");
        when(httpServletRequest.getHeader("User-Agent")).thenReturn("JUnit-Agent");
        when(authService.login(request, "10.0.0.1", "JUnit-Agent")).thenReturn(tokenResponse);

        ApiResponse<TokenResponse<UserInfo>> response = authController.login(request, httpServletRequest);

        assertEquals(0, response.getCode());
        assertEquals("access-token", response.getData().getAccessToken());
        verify(authService).login(request, "10.0.0.1", "JUnit-Agent");
    }

    /**
     * Verifies registration delegates to auth service.
     */
    @Test
    @DisplayName("shouldRegisterWhenRequestIsValid")
    void shouldRegisterWhenRequestIsValid() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("new-user");
        request.setEmail("new@koduck.dev");
        request.setPassword("password123");
        request.setConfirmPassword("password123");

        TokenResponse<UserInfo> tokenResponse = TokenResponse.<UserInfo>builder().accessToken("token").build();
        when(authService.register(request)).thenReturn(tokenResponse);

        ApiResponse<TokenResponse<UserInfo>> response = authController.register(request);

        assertEquals(0, response.getCode());
        assertEquals("token", response.getData().getAccessToken());
        verify(authService).register(request);
    }

    /**
     * Verifies refresh-token endpoint delegates to auth service.
     */
    @Test
    @DisplayName("shouldRefreshTokenWhenRequestIsValid")
    void shouldRefreshTokenWhenRequestIsValid() {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("refresh-token");

        TokenResponse<UserInfo> tokenResponse = TokenResponse.<UserInfo>builder().accessToken("new-access").build();
        when(authService.refreshToken(request)).thenReturn(tokenResponse);

        ApiResponse<TokenResponse<UserInfo>> response = authController.refreshToken(request);

        assertEquals(0, response.getCode());
        assertEquals("new-access", response.getData().getAccessToken());
        verify(authService).refreshToken(request);
    }

    /**
     * Verifies logout delegates null token when request payload is absent.
     */
    @Test
    @DisplayName("shouldLogoutWithNullTokenWhenRequestIsNull")
    void shouldLogoutWithNullTokenWhenRequestIsNull() {
        ApiResponse<Void> response = authController.logout(null);

        assertEquals(0, response.getCode());
        verify(authService).logout(null);
    }

    /**
     * Verifies forgot-password endpoint delegates to auth service.
     */
    @Test
    @DisplayName("shouldDelegateForgotPasswordToService")
    void shouldDelegateForgotPasswordToService() {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("user@koduck.dev");

        when(httpServletRequest.getRemoteAddr()).thenReturn("192.168.1.100");

        ApiResponse<Void> response = authController.forgotPassword(request, httpServletRequest);

        assertEquals(0, response.getCode());
        verify(authService).forgotPassword(any(ForgotPasswordRequest.class), eq("192.168.1.100"));
    }

    /**
     * Verifies reset-password endpoint delegates to auth service.
     */
    @Test
    @DisplayName("shouldDelegateResetPasswordToService")
    void shouldDelegateResetPasswordToService() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("reset-token");
        request.setNewPassword("password123");
        request.setConfirmPassword("password123");

        ApiResponse<Void> response = authController.resetPassword(request);

        assertEquals(0, response.getCode());
        verify(authService).resetPassword(request);
    }

    /**
     * Verifies security-config endpoint returns service response.
     */
    @Test
    @DisplayName("shouldReturnSecurityConfig")
    void shouldReturnSecurityConfig() {
        SecurityConfigResponse serviceResponse = SecurityConfigResponse.builder()
                .registrationEnabled(true)
                .build();
        when(authService.getSecurityConfig()).thenReturn(serviceResponse);

        ApiResponse<SecurityConfigResponse> response = authController.getSecurityConfig();

        assertEquals(0, response.getCode());
        assertEquals(true, response.getData().getRegistrationEnabled());
        verify(authService).getSecurityConfig();
    }
}
