package com.koduck.controller.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RefreshTokenRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.dto.auth.SecurityConfigResponse;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.security.AuthUserPrincipal;
import com.koduck.service.AuthService;

/**
 * 认证相关 HTTP 接口。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService<AuthUserPrincipal> authService;

    public AuthController(AuthService<AuthUserPrincipal> authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<TokenResponse<AuthUserPrincipal>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        return ApiResponse.success(authService.login(request, ipAddress, userAgent));
    }

    @PostMapping("/register")
    public ApiResponse<TokenResponse<AuthUserPrincipal>> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.success(authService.register(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<TokenResponse<AuthUserPrincipal>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request
    ) {
        return ApiResponse.success(authService.refreshToken(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        authService.logout(request == null ? null : request.getRefreshToken());
        return ApiResponse.success();
    }

    @GetMapping("/security-config")
    public ApiResponse<SecurityConfigResponse> getSecurityConfig() {
        return ApiResponse.success(authService.getSecurityConfig());
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.forgotPassword(request, resolveClientIp(httpRequest));
        return ApiResponse.success();
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.success();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] ips = forwardedFor.split(",");
            if (ips.length > 0 && !ips[0].isBlank()) {
                return ips[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
