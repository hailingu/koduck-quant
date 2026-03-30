package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.ForgotPasswordRequest;
import com.koduck.dto.auth.LoginRequest;
import com.koduck.dto.auth.RefreshTokenRequest;
import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.auth.ResetPasswordRequest;
import com.koduck.dto.auth.SecurityConfigResponse;
import com.koduck.dto.auth.TokenResponse;
import com.koduck.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

/**
 * Authentication REST controller.
 *
 * <p>Provides endpoints for user login, registration, token refresh and
 * password management related operations.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-05
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "认证管理", description = "用户登录、注册、Token刷新等认证相关接口")
public class AuthController {

    private static final String HEADER_USER_AGENT = "User-Agent";
    private static final String HEADER_X_FORWARDED_FOR = "X-Forwarded-For";
    private static final String HEADER_X_REAL_IP = "X-Real-IP";

    private final AuthService authService;

    /**
     * Authenticate a user and issue JWT tokens.
     *
     * @param request login request payload
     * @param httpRequest servlet request carrying client metadata
     * @return token pair and user profile wrapped in {@link ApiResponse}
     */
    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "使用用户名和密码登录，返回 JWT Token")
    public ApiResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        String userAgent = httpRequest.getHeader(HEADER_USER_AGENT);
        TokenResponse response = authService.login(request, ipAddress, userAgent);
        return ApiResponse.success(response);
    }

    /**
     * Register a new user account.
     *
     * @param request registration request payload
     * @return token pair and user profile for the created account
     */
    @PostMapping("/register")
    @Operation(summary = "用户注册", description = "注册新用户账号")
    public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        TokenResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    /**
     * Refresh an access token using a valid refresh token.
     *
     * @param request refresh token request payload
     * @return newly issued token pair wrapped in {@link ApiResponse}
     */
    @PostMapping("/refresh")
    @Operation(summary = "刷新 Token", description = "使用 Refresh Token 获取新的 Access Token")
    public ApiResponse<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        TokenResponse response = authService.refreshToken(request);
        return ApiResponse.success(response);
    }

    /**
     * Logout current session by revoking refresh token when provided.
     *
     * @param request optional refresh token payload
     * @return empty success response
     */
    @PostMapping("/logout")
    @Operation(summary = "用户登出", description = "注销当前用户的登录状态")
    public ApiResponse<Void> logout(@Valid @RequestBody(required = false) RefreshTokenRequest request) {
        String refreshToken = normalizeRefreshToken(request);
        authService.logout(refreshToken);
        return ApiResponse.successNoContent();
    }

    /**
     * Retrieve security-related client configuration.
     *
     * @return security configuration payload
     */
    @GetMapping("/security-config")
    @Operation(summary = "获取安全配置", description = "获取前端需要的安全配置信息，如是否开启验证码等")
    public ApiResponse<SecurityConfigResponse> getSecurityConfig() {
        SecurityConfigResponse config = authService.getSecurityConfig();
        return ApiResponse.success(config);
    }

    /**
     * Trigger forgot-password flow for an email address.
     *
     * @param request forgot-password request payload
     * @param httpRequest servlet request carrying client metadata
     * @return empty success response
     */
    @PostMapping("/forgot-password")
    @Operation(summary = "忘记密码", description = "发送密码重置邮件到用户邮箱")
    public ApiResponse<Void> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        authService.forgotPassword(request, ipAddress);
        return ApiResponse.successNoContent();
    }

    /**
     * Reset password using a reset token.
     *
     * @param request reset-password request payload
     * @return empty success response
     */
    @PostMapping("/reset-password")
    @Operation(summary = "重置密码", description = "使用重置令牌设置新密码")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.successNoContent();
    }

    /**
     * Resolve client IP address from trusted proxy headers.
     *
     * @param request current HTTP request
     * @return resolved client IP address
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader(HEADER_X_FORWARDED_FOR);
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader(HEADER_X_REAL_IP);
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }

    private String normalizeRefreshToken(RefreshTokenRequest request) {
        if (request == null) {
            return null;
        }
        String refreshToken = request.getRefreshToken();
        if (refreshToken == null) {
            return null;
        }
        String trimmedToken = refreshToken.trim();
        return Objects.equals(trimmedToken, "") ? null : trimmedToken;
    }
}
