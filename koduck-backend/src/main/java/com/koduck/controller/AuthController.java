package com.koduck.controller;

import com.koduck.dto.ApiResponse;
import com.koduck.dto.auth.*;
import com.koduck.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "认证管理", description = "用户登录、注册、Token刷新等认证相关接口")
public class AuthController {

    private final AuthService authService;

    /**
     * 用户登录
     */
    @PostMapping("/login")
    @Operation(summary = "用户登录", description = "使用用户名和密码登录，返回 JWT Token")
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
    @Operation(summary = "用户注册", description = "注册新用户账号")
    public ApiResponse<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        TokenResponse response = authService.register(request);
        return ApiResponse.success(response);
    }

    /**
     * 刷新 Token
     */
    @PostMapping("/refresh")
    @Operation(summary = "刷新 Token", description = "使用 Refresh Token 获取新的 Access Token")
    public ApiResponse<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        TokenResponse response = authService.refreshToken(request);
        return ApiResponse.success(response);
    }

    /**
     * 用户登出
     */
    @PostMapping("/logout")
    @Operation(summary = "用户登出", description = "注销当前用户的登录状态")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        String refreshToken = request != null ? request.getRefreshToken() : null;
        authService.logout(refreshToken);
        return ApiResponse.success();
    }

    /**
     * 获取安全配置
     */
    @GetMapping("/security-config")
    @Operation(summary = "获取安全配置", description = "获取前端需要的安全配置信息，如是否开启验证码等")
    public ApiResponse<SecurityConfigResponse> getSecurityConfig() {
        SecurityConfigResponse config = authService.getSecurityConfig();
        return ApiResponse.success(config);
    }

    /**
     * 忘记密码
     */
    @PostMapping("/forgot-password")
    @Operation(summary = "忘记密码", description = "发送密码重置邮件到用户邮箱")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        // TODO: 实现发送重置密码邮件逻辑
        return ApiResponse.success();
    }

    /**
     * 重置密码
     */
    @PostMapping("/reset-password")
    @Operation(summary = "重置密码", description = "使用重置令牌设置新密码")
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
