package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.*;
import com.koduck.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 认证控制器
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * 用户登录
     */
    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        TokenResponse response = authService.login(request, ipAddress, userAgent);
        return ApiResponse.success(response);
    }

    /**
     * 用户注册
     */
    @PostMapping("/register")
    public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        TokenResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    /**
     * 刷新 Token
     */
    @PostMapping("/refresh")
    public ApiResponse<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        TokenResponse response = authService.refreshToken(request);
        return ApiResponse.success(response);
    }

    /**
     * 用户登出
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        String refreshToken = request != null ? request.getRefreshToken() : null;
        authService.logout(refreshToken);
        return ApiResponse.success();
    }

    /**
     * 获取安全配置
     */
    @GetMapping("/security-config")
    public ApiResponse<SecurityConfigResponse> getSecurityConfig() {
        SecurityConfigResponse config = authService.getSecurityConfig();
        return ApiResponse.success(config);
    }

    /**
     * 忘记密码
     */
    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        // TODO: 实现发送重置密码邮件逻辑
        return ApiResponse.success();
    }

    /**
     * 重置密码
     */
    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        // TODO: 实现重置密码逻辑
        return ApiResponse.success();
    }

    /**
     * 获取客户端 IP 地址
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
